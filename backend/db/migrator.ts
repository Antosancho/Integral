/**
 * backend/db/migrator.ts
 *
 * Migrador propio: aplica al iniciar la app los `migration.sql` de Prisma que
 * todavía no estén aplicados en la base SQLite.
 *
 * Motivación: la app empaquetada no incluye el CLI de Prisma (`prisma migrate
 * deploy`), pero tiene que poder crear la base en una instalación nueva y
 * actualizarla cuando una versión nueva trae migraciones. Las migraciones
 * viajan en el instalador como `resources/migrations/<timestamp_nombre>/`.
 *
 * Compatibilidad con el CLI: cada migración se registra en `_prisma_migrations`
 * con **el mismo formato que Prisma** (mismo DDL, checksum sha256 de los bytes
 * crudos del archivo, timestamps como INTEGER en ms). Así:
 *   - una `dev.db` migrada por `prisma migrate deploy` se reconoce como al día;
 *   - el CLI de Prisma sigue funcionando sobre una base migrada por la app.
 *
 * Reglas de seguridad de los datos (NO cambiar sin releer plan.md, sección 0):
 *   - Se usa un PrismaClient propio con `connection_limit=1`: `PRAGMA
 *     foreign_keys=OFF` es por conexión, y si las sentencias de una migración
 *     corrieran en conexiones distintas, un `DROP TABLE "Sale"` borraría en
 *     cascada los `SaleItem`.
 *   - Las sentencias NO se envuelven en una transacción: dentro de una
 *     transacción `PRAGMA foreign_keys` no tiene efecto.
 *   - Antes de migrar una base que ya tenía migraciones (o sea, con datos
 *     potenciales) se hace un backup con `VACUUM INTO`.
 *
 * Este archivo no importa nada de `electron`: se puede correr con ts-node.
 */

import crypto from "crypto"
import fs from "fs"
import path from "path"
import { PrismaClient } from "@prisma/client"

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Una migración leída del disco. `checksum` = sha256 hex de los bytes crudos (con BOM si lo hay). */
export type MigrationFile = { name: string; sql: string; checksum: string }

/** Destino de los mensajes del migrador (por defecto, `console`). */
export type MigrationLogger = { info(message: string): void; warn(message: string): void }

export type RunMigrationsOptions = {
  /** `"file:<ruta ABSOLUTA>"` (lo que deja setupEnv en `process.env.DATABASE_URL`). */
  databaseUrl: string
  /** Carpeta con subcarpetas `<timestamp_nombre>/migration.sql`. */
  migrationsDir: string
  /** Default: `console`. */
  logger?: MigrationLogger
  /** Reloj en ms. Default: `Date.now` (inyectable para tests). */
  now?: () => number
}

export type RunMigrationsResult = {
  /** Nombres de las migraciones aplicadas en ESTA corrida, en orden. */
  applied: string[]
  /** Ruta del backup si se hizo; si no, `null`. */
  backupPath: string | null
  /** `true` si el archivo de la base no existía o estaba vacío (0 bytes). */
  dbCreated: boolean
}

/**
 * Códigos de error:
 * - `NO_MIGRATIONS`: la carpeta de migraciones está vacía o no existe (instalación rota).
 * - `FAILED_PREVIOUS`: una corrida anterior dejó una migración empezada y sin terminar.
 * - `UNKNOWN_APPLIED`: la base tiene migraciones que esta versión no conoce (la abrió una versión más nueva).
 * - `APPLY_FAILED`: falló una sentencia al aplicar una migración.
 * - `INVALID_URL`: la URL no es `file:` con ruta absoluta.
 */
export type MigrationErrorCode = "NO_MIGRATIONS" | "FAILED_PREVIOUS" | "UNKNOWN_APPLIED" | "APPLY_FAILED" | "INVALID_URL"

/** Error del migrador. El `message` está pensado para mostrarse al usuario final. */
export class MigrationError extends Error {
  constructor(public readonly code: MigrationErrorCode, message: string) {
    super(message)
    this.name = "MigrationError"
  }
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** DDL de `_prisma_migrations` idéntico al que crea Prisma CLI en SQLite (copiado de dev.db). */
const MIGRATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`

/** Fila de `_prisma_migrations` tal como la devuelve `$queryRawUnsafe` (los INTEGER pueden venir como bigint). */
type MigrationRow = {
  id: string
  migration_name: string
  checksum: string
  finished_at: number | bigint | null
  rolled_back_at: number | bigint | null
}

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

/**
 * Divide un script SQL en sentencias individuales (`$executeRawUnsafe` de
 * Prisma sobre SQLite ejecuta una sola sentencia por llamada).
 *
 * Máquina de estados carácter por carácter:
 * - `normal`: `--` abre comentario de línea, `/*` abre comentario de bloque
 *   (ninguno se copia), `'` y `"` abren string/identificador (se copian) y
 *   `;` cierra la sentencia actual (el `;` no se incluye).
 * - `comillaSimple` / `comillaDoble`: la comilla duplicada (`''` o `""`) es un
 *   escape y no cierra; una sola comilla cierra.
 * - `comentarioLinea` termina en `\n` (el `\n` se copia como separador).
 * - `comentarioBloque` termina en `*\/`.
 *
 * Un BOM UTF-8 inicial (`﻿`) se descarta. Las sentencias vacías (solo
 * espacios o comentarios) no se devuelven.
 */
export function splitSqlStatements(sql: string): string[] {
  type State = "normal" | "comillaSimple" | "comillaDoble" | "comentarioLinea" | "comentarioBloque"

  const text = sql.startsWith("﻿") ? sql.slice(1) : sql
  const statements: string[] = []
  let current = ""
  let state: State = "normal"

  /** Cierra la sentencia acumulada si tiene contenido. */
  const flush = () => {
    const trimmed = current.trim()
    if (trimmed) statements.push(trimmed)
    current = ""
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    switch (state) {
      case "normal":
        if (ch === "-" && next === "-") {
          state = "comentarioLinea"
          i++
        } else if (ch === "/" && next === "*") {
          state = "comentarioBloque"
          i++
        } else if (ch === "'") {
          state = "comillaSimple"
          current += ch
        } else if (ch === '"') {
          state = "comillaDoble"
          current += ch
        } else if (ch === ";") {
          flush()
        } else {
          current += ch
        }
        break

      case "comillaSimple":
      case "comillaDoble": {
        const quote = state === "comillaSimple" ? "'" : '"'
        current += ch
        if (ch === quote) {
          if (next === quote) {
            // Comilla duplicada = escape: se copia y seguimos dentro del string
            current += next
            i++
          } else {
            state = "normal"
          }
        }
        break
      }

      case "comentarioLinea":
        if (ch === "\n") {
          current += ch
          state = "normal"
        }
        break

      case "comentarioBloque":
        if (ch === "*" && next === "/") {
          state = "normal"
          i++
        }
        break
    }
  }

  flush()
  return statements
}

/**
 * Extrae la ruta del archivo SQLite de una URL `file:<ruta absoluta>[?query]`.
 *
 * Las rutas relativas se rechazan a propósito: Prisma las resuelve respecto de
 * la carpeta del schema y no del CWD, y esa ambigüedad podría hacer que el
 * migrador y la app abran archivos distintos. La app siempre pasa absolutas.
 *
 * @throws MigrationError("INVALID_URL") si no es `file:` o la ruta no es absoluta.
 */
export function sqliteFilePathFromUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new MigrationError("INVALID_URL", `DATABASE_URL debe empezar con "file:" (recibido: ${databaseUrl})`)
  }
  const withoutPrefix = databaseUrl.slice("file:".length)
  const queryIndex = withoutPrefix.indexOf("?")
  const filePath = queryIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, queryIndex)
  if (!path.isAbsolute(filePath)) {
    throw new MigrationError("INVALID_URL", `DATABASE_URL debe tener una ruta absoluta (recibido: ${databaseUrl})`)
  }
  return filePath
}

/** Agrega `connection_limit=1` a la URL (con `?` o `&` según si ya tiene query). */
export function withSingleConnection(databaseUrl: string): string {
  const separator = databaseUrl.includes("?") ? "&" : "?"
  return `${databaseUrl}${separator}connection_limit=1`
}

/**
 * Lee las migraciones de `migrationsDir`, ordenadas por nombre (empiezan con
 * timestamp, así que el orden alfabético es el cronológico). Solo cuenta las
 * subcarpetas que tienen `migration.sql` (ignora `migration_lock.toml`).
 *
 * Devuelve `[]` si la carpeta no existe: decidir si eso es un error le
 * corresponde a `runMigrations`.
 */
export function readMigrations(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) return []

  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationsDir, entry.name, "migration.sql")))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      // El checksum se calcula sobre los bytes crudos (incluido el BOM), igual que Prisma.
      const buffer = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"))
      return {
        name,
        sql: buffer.toString("utf-8"),
        checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
      }
    })
}

/** `AAAAMMDD-HHmmss` en hora local, para el nombre del backup. */
function formatBackupStamp(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

// ---------------------------------------------------------------------------
// API principal
// ---------------------------------------------------------------------------

/**
 * Aplica las migraciones pendientes sobre la base indicada.
 *
 * Algoritmo:
 * 1. Lee las migraciones (si no hay ninguna → `NO_MIGRATIONS`).
 * 2. Crea la carpeta y un archivo vacío si la base no existe (0 bytes = SQLite válido).
 * 3. Crea `_prisma_migrations` si no existe y lee sus filas.
 * 4. Corta si hay una migración empezada sin terminar (`FAILED_PREVIOUS`) o si
 *    hay aplicadas que esta versión no conoce (`UNKNOWN_APPLIED`).
 * 5. Avisa (sin fallar) si una migración aplicada cambió de checksum.
 * 6. Si hay pendientes y la base ya tenía migraciones, hace backup con `VACUUM INTO`.
 * 7. Aplica cada pendiente sentencia por sentencia, registrándola en
 *    `_prisma_migrations` al empezar y marcándola como terminada al final.
 *    Si una sentencia falla, guarda el error en `logs` y lanza `APPLY_FAILED`.
 */
export async function runMigrations(options: RunMigrationsOptions): Promise<RunMigrationsResult> {
  const { databaseUrl, migrationsDir, logger = console, now = Date.now } = options

  // 1. Migraciones disponibles
  const migrations = readMigrations(migrationsDir)
  if (migrations.length === 0) {
    throw new MigrationError("NO_MIGRATIONS", `No se encontraron migraciones en ${migrationsDir}`)
  }

  // 2. Archivo de la base
  const dbPath = sqliteFilePathFromUrl(databaseUrl)
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const dbCreated = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, "")

  // 3. Cliente propio con UNA sola conexión (ver cabecera del archivo)
  const prisma = new PrismaClient({ datasources: { db: { url: withSingleConnection(databaseUrl) } } })

  try {
    await prisma.$executeRawUnsafe(MIGRATIONS_TABLE_DDL)
    const rows = await prisma.$queryRawUnsafe<MigrationRow[]>(
      'SELECT "id", "migration_name", "checksum", "finished_at", "rolled_back_at" FROM "_prisma_migrations"'
    )

    // 4a. Migraciones empezadas y nunca terminadas (ni revertidas)
    const failed = rows.filter((r) => r.finished_at == null && r.rolled_back_at == null)
    if (failed.length > 0) {
      const names = failed.map((r) => r.migration_name).join(", ")
      throw new MigrationError(
        "FAILED_PREVIOUS",
        `Una actualización anterior de la base de datos quedó incompleta (${names}). ` +
          `Restaurá el backup más reciente (${dbPath}.backup-*) o contactá a soporte.`
      )
    }

    // 4b. Migraciones aplicadas que esta versión de la app no trae
    const applied = new Map<string, string>()
    for (const r of rows) {
      if (r.finished_at != null && r.rolled_back_at == null) applied.set(r.migration_name, r.checksum)
    }
    const known = new Set(migrations.map((m) => m.name))
    const unknown = [...applied.keys()].filter((name) => !known.has(name))
    if (unknown.length > 0) {
      throw new MigrationError(
        "UNKNOWN_APPLIED",
        `La base de datos fue actualizada por una versión más nueva de Integral (${unknown.join(", ")}). ` +
          "Instalá la versión más reciente."
      )
    }

    // 5. Checksum distinto: alguien editó un migration.sql ya publicado. No se re-aplica.
    for (const m of migrations) {
      const appliedChecksum = applied.get(m.name)
      if (appliedChecksum !== undefined && appliedChecksum !== m.checksum) {
        logger.warn(`[migrator] checksum distinto en ${m.name} (ya aplicada; no se re-aplica)`)
      }
    }

    const pending = migrations.filter((m) => !applied.has(m.name))
    if (pending.length === 0) {
      logger.info("[migrator] base de datos al día")
      return { applied: [], backupPath: null, dbCreated }
    }

    // 6. Backup previo (solo si la base ya tenía migraciones: una base nueva no tiene nada que perder)
    let backupPath: string | null = null
    if (applied.size > 0) {
      backupPath = `${dbPath}.backup-${formatBackupStamp(now())}`
      const sqlLiteral = backupPath.replace(/\\/g, "/").replace(/'/g, "''")
      await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlLiteral}'`)
      logger.info(`[migrator] backup creado en ${backupPath}`)
    }

    // 7. Aplicar pendientes, en orden y SIN transacción
    const appliedNow: string[] = []
    for (const m of pending) {
      const id = crypto.randomUUID()
      await prisma.$executeRaw`INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "started_at", "applied_steps_count")
                               VALUES (${id}, ${m.checksum}, ${m.name}, ${now()}, 0)`
      try {
        for (const statement of splitSqlStatements(m.sql)) {
          await prisma.$executeRawUnsafe(statement)
        }
      } catch (error) {
        // La fila queda con finished_at NULL: la próxima corrida corta con FAILED_PREVIOUS.
        await prisma.$executeRaw`UPDATE "_prisma_migrations" SET "logs" = ${String(error)} WHERE "id" = ${id}`
        const detail = error instanceof Error ? error.message : String(error)
        throw new MigrationError(
          "APPLY_FAILED",
          `Falló la migración ${m.name}: ${detail}.` + (backupPath ? ` Backup previo: ${backupPath}` : "")
        )
      }
      await prisma.$executeRaw`UPDATE "_prisma_migrations" SET "finished_at" = ${now()}, "applied_steps_count" = 1 WHERE "id" = ${id}`
      appliedNow.push(m.name)
    }

    logger.info(`[migrator] ${appliedNow.length} migración(es) aplicada(s)`)
    return { applied: appliedNow, backupPath, dbCreated }
  } finally {
    await prisma.$disconnect()
  }
}
