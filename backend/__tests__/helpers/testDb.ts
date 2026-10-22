/**
 * backend/__tests__/helpers/testDb.ts
 *
 * Helper compartido para crear una DB SQLite de test **aislada y vacía**.
 *
 * Motivación: antes los tests copiaban `backend/prisma/dev.db` (que tenía datos
 * reales del negocio) o directamente escribían sobre ella. Con este helper
 * ningún test depende de `dev.db`: cada uno obtiene un archivo nuevo creado
 * aplicando las migraciones reales con `prisma migrate deploy`, de modo que el
 * schema es idéntico al de producción pero no hay ninguna fila.
 *
 * El archivo se crea en `backend/prisma/` con un nombre que empieza con `test`,
 * así lo cubre la regla `backend/prisma/test*.db` del `.gitignore` y nunca se
 * versiona por accidente.
 */

import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/**
 * DB de test lista para usar.
 *
 * - `dbPath`: ruta absoluta del archivo SQLite.
 * - `databaseUrl`: URL `file:` absoluta (con `/`) para `DATABASE_URL` o para
 *   `new PrismaClient({ datasources: { db: { url } } })`.
 * - `cleanup`: borra el archivo y su journal. Llamarla **después** de hacer
 *   `$disconnect()` de cualquier PrismaClient que apunte a la DB.
 */
export type TestDb = { dbPath: string; databaseUrl: string; cleanup: () => void }

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

// El helper vive un nivel más adentro que los demás tests
// (backend/__tests__/helpers/), por eso sube tres niveles hasta la raíz.
const repoRoot = path.resolve(__dirname, "..", "..", "..")
const schemaPath = path.join(repoRoot, "backend", "prisma", "schema.prisma")

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Crea una DB SQLite nueva aplicando todas las migraciones de
 * `backend/prisma/migrations/` y devuelve su ruta, su URL y una función de
 * limpieza.
 *
 * La ejecución es **sincrónica** a propósito: permite usar el helper en
 * módulos de efecto secundario (ver `useIsolatedDb.ts`) que tienen que dejar
 * `DATABASE_URL` configurada antes de que se evalúe el siguiente import.
 *
 * @param label Texto corto que identifica al consumidor (queda en el nombre
 *              del archivo, útil para diagnosticar archivos huérfanos).
 * @throws Error si `prisma migrate deploy` falla o si el archivo no se creó.
 */
export function createMigratedTestDb(label: string): TestDb {
  // pid + timestamp: nombres únicos aunque varios tests corran en paralelo
  // o el mismo proceso cree varias DBs seguidas.
  const dbPath = path.join(
    repoRoot,
    "backend",
    "prisma",
    `test-${label}.${process.pid}.${Date.now()}.db`
  )
  // Ruta absoluta: Prisma resuelve las rutas relativas desde backend/prisma/,
  // no desde el CWD; con una absoluta evitamos esa trampa.
  const databaseUrl = `file:${dbPath.replace(/\\/g, "/")}`

  // shell: true es necesario en Windows para resolver npx desde PATH.
  // DATABASE_URL del env tiene prioridad sobre la del .env, así que nunca
  // se migra dev.db por error.
  const result = spawnSync(`npx prisma migrate deploy --schema "${schemaPath}"`, [], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf-8",
    shell: true,
    // Timeout generoso: la primera corrida de npx puede ser lenta
    timeout: 120_000,
  })

  if (result.status !== 0) {
    throw new Error(
      `createMigratedTestDb("${label}"): prisma migrate deploy falló (status ${result.status})\n` +
        `stdout: ${result.stdout || ""}\nstderr: ${result.stderr || ""}`
    )
  }

  if (!fs.existsSync(dbPath)) {
    throw new Error(`createMigratedTestDb("${label}"): la DB no se creó en ${dbPath}`)
  }

  /**
   * Borra la DB y su journal. Nunca lanza: en Windows `rmSync` puede dar
   * `EBUSY` si quedó un cliente abierto; en ese caso solo avisamos para no
   * tapar el resultado real del test.
   */
  function cleanup(): void {
    for (const candidate of [dbPath, `${dbPath}-journal`]) {
      try {
        fs.rmSync(candidate, { force: true })
      } catch (error) {
        console.warn(
          `WARN: no se pudo borrar ${candidate}: ${error instanceof Error ? error.message : error}`
        )
      }
    }
  }

  return { dbPath, databaseUrl, cleanup }
}
