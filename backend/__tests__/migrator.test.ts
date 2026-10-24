/**
 * backend/__tests__/migrator.test.ts
 *
 * Tests del migrador propio (backend/db/migrator.ts), que aplica las
 * migraciones de Prisma al iniciar la app empaquetada (donde no existe el CLI).
 *
 * Grupo A — splitSqlStatements (puro): BOM, comentarios, strings, identificadores
 * Grupo B — helpers de URL (puros): sqliteFilePathFromUrl, withSingleConnection
 * Grupo C — readMigrations: orden, checksum, carpeta inexistente
 * Grupo D — runMigrations sobre DB nueva: mismo schema y checksums que el CLI,
 *           timestamps en ms (INTEGER), idempotencia
 * Grupo E — compatibilidad con el CLI de Prisma en ambos sentidos
 * Grupo F — migración parcial CON datos: detecta pérdida de datos por
 *           PRAGMA foreign_keys + ON DELETE CASCADE, y verifica el backup
 * Grupo G — errores: NO_MIGRATIONS, APPLY_FAILED, FAILED_PREVIOUS,
 *           UNKNOWN_APPLIED y checksum distinto (solo warning)
 *
 * Ningún caso toca dev.db: las DBs del migrador viven en una carpeta temporal
 * del sistema y las de referencia se crean con createMigratedTestDb.
 */

import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { PrismaClient } from "@prisma/client"
import { createMigratedTestDb, type TestDb } from "./helpers/testDb"
import {
  MigrationError,
  readMigrations,
  runMigrations,
  splitSqlStatements,
  sqliteFilePathFromUrl,
  withSingleConnection,
  type MigrationErrorCode,
  type MigrationLogger,
} from "../db/migrator"

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..", "..")
const migrationsDir = path.join(repoRoot, "backend", "prisma", "migrations")
const schemaPath = path.join("backend", "prisma", "schema.prisma")

/** Cantidad de sentencias por migración (ver plan.md, sección 0). */
const EXPECTED_STATEMENTS: Record<string, number> = {
  "20260210182056_init_stock_schema": 10,
  "20260210200802_change_barcode_to_int": 12,
  "20260213143709_barcode_to_bigint": 12,
  "20260402171906_add_applied_delta_to_stock_movement": 1,
  "20260419180243_add_sales": 17,
  "20260425220943_add_sale_discount_pct": 9,
  "20260426014247_allow_null_product_in_sale_item": 10,
  "20260426182258_add_purchase_price_snapshot": 1,
  "20260504202127_add_expiry_to_stock_movement": 3,
}

// ---------------------------------------------------------------------------
// Utilidades de assert
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
}

function logStep(step: string) {
  console.log(`  PASS: ${step}`)
}

/** Verifica que `fn` lance (o rechace) un MigrationError con el código dado y lo devuelve. */
async function expectMigrationError(
  fn: () => unknown,
  code: MigrationErrorCode,
  label: string
): Promise<MigrationError> {
  try {
    await fn()
  } catch (error) {
    assert(error instanceof MigrationError, `${label}: se esperaba MigrationError, got ${String(error)}`)
    assert(error.code === code, `${label}: se esperaba code ${code}, got ${error.code} (${error.message})`)
    return error
  }
  throw new Error(`ASSERT FAILED: ${label}: se esperaba MigrationError ${code} y no lanzó`)
}

// ---------------------------------------------------------------------------
// Helpers de archivos y DB
// ---------------------------------------------------------------------------

/** Logger que acumula los mensajes para poder inspeccionarlos (y no ensucia la salida). */
function makeLogger(): MigrationLogger & { infos: string[]; warns: string[] } {
  const infos: string[] = []
  const warns: string[] = []
  return { infos, warns, info: (m) => infos.push(m), warn: (m) => warns.push(m) }
}

/** URL `file:` absoluta con barras `/` (formato que usa la app). */
function urlFor(dbPath: string): string {
  return `file:${dbPath.replace(/\\/g, "/")}`
}

/** Nombres de las carpetas de migración reales, en orden. */
function realMigrationNames(): string[] {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

/** Copia las migraciones reales indicadas a `targetDir` (creándolo si hace falta). */
function copyMigrations(names: string[], targetDir: string) {
  fs.mkdirSync(targetDir, { recursive: true })
  for (const name of names) {
    fs.cpSync(path.join(migrationsDir, name), path.join(targetDir, name), { recursive: true })
  }
}

/** Ejecuta el CLI de Prisma contra la DB indicada (shell: true para resolver npx en Windows). */
function runPrismaCli(args: string, databaseUrl: string) {
  return spawnSync(`npx prisma ${args} --schema ${schemaPath}`, [], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf-8",
    shell: true,
    timeout: 120_000,
  })
}

// Clientes abiertos durante el test: se desconectan todos en el finally
// (en Windows un archivo SQLite abierto no se puede borrar → EBUSY).
const openClients: PrismaClient[] = []

function openClient(databaseUrl: string): PrismaClient {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  openClients.push(client)
  return client
}

async function disconnectAll() {
  while (openClients.length > 0) await openClients.pop()!.$disconnect()
}

/** Schema de la DB sin tablas internas, para comparar migrador vs CLI. */
async function readSchema(client: PrismaClient): Promise<string> {
  const rows = await client.$queryRawUnsafe<unknown[]>(
    "SELECT type, name, tbl_name, sql FROM sqlite_master " +
      "WHERE name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY type, name"
  )
  return JSON.stringify(rows)
}

async function readChecksums(client: PrismaClient): Promise<Map<string, string>> {
  const rows = await client.$queryRawUnsafe<{ migration_name: string; checksum: string }[]>(
    'SELECT "migration_name", "checksum" FROM "_prisma_migrations"'
  )
  return new Map(rows.map((r) => [r.migration_name, r.checksum]))
}

async function countRows(client: PrismaClient, sql: string): Promise<number> {
  const rows = await client.$queryRawUnsafe<{ n: bigint | number }[]>(sql)
  return Number(rows[0].n)
}

// ---------------------------------------------------------------------------
// Grupos de tests
// ---------------------------------------------------------------------------

function groupA() {
  console.log("Grupo A — splitSqlStatements")

  const a1 = splitSqlStatements("\uFEFFCREATE TABLE a (x INT);")
  assert(JSON.stringify(a1) === JSON.stringify(["CREATE TABLE a (x INT)"]), `A1 got ${JSON.stringify(a1)}`)
  logStep("A1 quita el BOM y el ; final")

  const a2 = splitSqlStatements("-- comentario; con punto y coma\nSELECT 1;")
  assert(JSON.stringify(a2) === JSON.stringify(["SELECT 1"]), `A2 got ${JSON.stringify(a2)}`)
  logStep("A2 ignora ; dentro de comentarios de línea")

  const a3 = splitSqlStatements("/* a; b */ SELECT 1; SELECT 2")
  assert(JSON.stringify(a3) === JSON.stringify(["SELECT 1", "SELECT 2"]), `A3 got ${JSON.stringify(a3)}`)
  logStep("A3 ignora comentarios de bloque y acepta la última sentencia sin ;")

  const a4 = splitSqlStatements("INSERT INTO t VALUES ('a;b'); SELECT 1;")
  assert(a4.length === 2 && a4[0] === "INSERT INTO t VALUES ('a;b')", `A4 got ${JSON.stringify(a4)}`)
  logStep("A4 respeta ; dentro de strings")

  const a5 = splitSqlStatements("INSERT INTO t VALUES ('it''s;');")
  assert(a5.length === 1, `A5 got ${JSON.stringify(a5)}`)
  logStep("A5 respeta comillas simples escapadas ('')")

  const a6 = splitSqlStatements('CREATE TABLE "we;ird" (x INT);')
  assert(a6.length === 1, `A6 got ${JSON.stringify(a6)}`)
  logStep("A6 respeta ; dentro de identificadores entre comillas dobles")

  const a7 = splitSqlStatements("   \n -- solo comentario\n")
  assert(a7.length === 0, `A7 got ${JSON.stringify(a7)}`)
  logStep("A7 un archivo con solo comentarios no produce sentencias")

  const names = realMigrationNames()
  assert(names.length === Object.keys(EXPECTED_STATEMENTS).length, `A8: se esperaban ${Object.keys(EXPECTED_STATEMENTS).length} migraciones, hay ${names.length}`)
  for (const name of names) {
    const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf-8")
    const count = splitSqlStatements(sql).length
    assert(count === EXPECTED_STATEMENTS[name], `A8 ${name}: esperadas ${EXPECTED_STATEMENTS[name]}, got ${count}`)
  }
  logStep("A8 cantidad de sentencias de cada migración real")
}

async function groupB() {
  console.log("Grupo B — helpers de URL")

  assert(sqliteFilePathFromUrl("file:C:/x/y.db") === "C:/x/y.db", "B1 sin query")
  assert(sqliteFilePathFromUrl("file:C:/x/y.db?connection_limit=5") === "C:/x/y.db", "B1 con query")
  logStep("B1 sqliteFilePathFromUrl extrae la ruta y descarta la query")

  await expectMigrationError(() => sqliteFilePathFromUrl("file:./dev.db"), "INVALID_URL", "B2 relativa")
  await expectMigrationError(() => sqliteFilePathFromUrl("postgres://u:p@host/db"), "INVALID_URL", "B2 postgres")
  logStep("B2 rechaza rutas relativas y URLs que no son file:")

  assert(withSingleConnection("file:C:/a.db") === "file:C:/a.db?connection_limit=1", "B3 sin query")
  assert(withSingleConnection("file:C:/a.db?foo=1") === "file:C:/a.db?foo=1&connection_limit=1", "B3 con query")
  logStep("B3 withSingleConnection agrega connection_limit=1")
}

function groupC(tmpRoot: string) {
  console.log("Grupo C — readMigrations")

  const migrations = readMigrations(migrationsDir)
  const names = migrations.map((m) => m.name)
  assert(migrations.length === 9, `C1 se esperaban 9, got ${migrations.length}`)
  assert(JSON.stringify(names) === JSON.stringify([...names].sort()), "C1 deben venir ordenadas")
  assert(!names.includes("migration_lock.toml"), "C1 no debe incluir migration_lock.toml")
  const init = migrations.find((m) => m.name === "20260210182056_init_stock_schema")
  assert(
    init?.checksum === "704d76ae990e6a2829952f13344c050cc1aac831f5e88bf76164caf2e08e85a5",
    `C1 checksum de init_stock_schema: ${init?.checksum}`
  )
  logStep("C1 lee las 9 migraciones ordenadas con el checksum del CLI")

  const missing = readMigrations(path.join(tmpRoot, "no-existe"))
  assert(Array.isArray(missing) && missing.length === 0, "C2 carpeta inexistente → []")
  logStep("C2 carpeta inexistente devuelve []")
}

/** Devuelve la URL de la DB creada en D1 (la usan los grupos E y G). */
async function groupD(tmpRoot: string, refDb: TestDb): Promise<string> {
  console.log("Grupo D — runMigrations sobre DB nueva")

  // Subcarpeta inexistente: el migrador tiene que crearla.
  const dbPath = path.join(tmpRoot, "nueva", "app.db")
  const url = urlFor(dbPath)

  const first = await runMigrations({ databaseUrl: url, migrationsDir, logger: makeLogger() })
  assert(first.applied.length === 9, `D1 applied ${first.applied.length}`)
  assert(first.dbCreated === true, "D1 dbCreated")
  assert(first.backupPath === null, "D1 sin backup en DB nueva")
  assert(fs.existsSync(dbPath), "D1 el archivo existe")
  logStep("D1 crea la DB y aplica las 9 migraciones")

  const mine = openClient(url)
  const ref = openClient(refDb.databaseUrl)

  assert((await readSchema(mine)) === (await readSchema(ref)), "D2 el schema difiere del creado por el CLI")
  logStep("D2 schema idéntico al que genera prisma migrate deploy")

  const mineChecksums = await readChecksums(mine)
  const refChecksums = await readChecksums(ref)
  assert(mineChecksums.size === refChecksums.size, "D3 misma cantidad de filas en _prisma_migrations")
  for (const [name, checksum] of refChecksums) {
    assert(mineChecksums.get(name) === checksum, `D3 checksum distinto en ${name}`)
  }
  logStep("D3 checksums idénticos a los del CLI")

  const types = await mine.$queryRawUnsafe<{ ts: string; tf: string; applied_steps_count: bigint | number }[]>(
    "SELECT typeof(started_at) AS ts, typeof(finished_at) AS tf, applied_steps_count FROM _prisma_migrations"
  )
  for (const row of types) {
    assert(row.ts === "integer" && row.tf === "integer", `D4 tipos ${row.ts}/${row.tf}`)
    assert(Number(row.applied_steps_count) === 1, `D4 applied_steps_count ${row.applied_steps_count}`)
  }
  logStep("D4 started_at/finished_at guardados como INTEGER (ms) y applied_steps_count = 1")

  await disconnectAll()

  const second = await runMigrations({ databaseUrl: url, migrationsDir, logger: makeLogger() })
  assert(second.applied.length === 0, `D5 applied ${second.applied.length}`)
  assert(second.dbCreated === false, "D5 dbCreated")
  assert(second.backupPath === null, "D5 sin backup")
  logStep("D5 idempotente: la segunda corrida no hace nada")

  return url
}

async function groupE(migratorDbUrl: string) {
  console.log("Grupo E — compatibilidad con el CLI de Prisma")

  const cliDb = createMigratedTestDb("migrator-cli")
  try {
    const result = await runMigrations({ databaseUrl: cliDb.databaseUrl, migrationsDir, logger: makeLogger() })
    assert(result.applied.length === 0, `E1 applied ${result.applied.length}`)
    assert(result.backupPath === null, "E1 sin backup")
    logStep("E1 una DB migrada por el CLI se reconoce como al día")
  } finally {
    cliDb.cleanup()
  }

  const status = runPrismaCli("migrate status", migratorDbUrl)
  assert(status.status === 0, `E2 status ${status.status}\n${status.stdout}\n${status.stderr}`)
  assert(status.stdout.includes("Database schema is up to date"), `E2 stdout: ${status.stdout}`)
  logStep("E2 prisma migrate status reconoce la DB migrada por la app")

  const deploy = runPrismaCli("migrate deploy", migratorDbUrl)
  assert(deploy.status === 0, `E3 status ${deploy.status}\n${deploy.stdout}\n${deploy.stderr}`)
  assert(deploy.stdout.includes("No pending migrations to apply"), `E3 stdout: ${deploy.stdout}`)
  logStep("E3 prisma migrate deploy no encuentra nada pendiente")
}

async function groupF(tmpRoot: string) {
  console.log("Grupo F — migración parcial con datos")

  const names = realMigrationNames()
  const cut = names.indexOf("20260419180243_add_sales") + 1
  const firstBatch = names.slice(0, cut)
  const secondBatch = names.slice(cut)
  const dir = path.join(tmpRoot, "parcial-migrations")
  const dbPath = path.join(tmpRoot, "parcial.db")
  const url = urlFor(dbPath)

  copyMigrations(firstBatch, dir)
  const first = await runMigrations({ databaseUrl: url, migrationsDir: dir, logger: makeLogger() })
  assert(first.applied.length === 5, `F1 applied ${first.applied.length}`)
  logStep("F1 aplica las 5 primeras migraciones")

  // Raw SQL: el Prisma Client tipado corresponde al schema final, que tiene
  // columnas que en este punto todavía no existen.
  const seed = openClient(url)
  const inserts = [
    `INSERT INTO "Category" ("id", "name") VALUES (1, 'Bebidas')`,
    `INSERT INTO "Supplier" ("id", "name") VALUES (1, 'Proveedor')`,
    `INSERT INTO "Product" ("id", "name", "barcode", "purchasePrice", "salePrice", "stock", "minStock", "categoryId", "supplierId")
       VALUES (1, 'Agua', 7790001000011, 50, 100, 10, 0, 1, 1)`,
    `INSERT INTO "Sale" ("id", "total") VALUES (1, 100)`,
    `INSERT INTO "SaleItem" ("saleId", "productId", "quantity", "unitPrice") VALUES (1, 1, 1, 50)`,
    `INSERT INTO "SaleItem" ("saleId", "productId", "quantity", "unitPrice") VALUES (1, 1, 1, 50)`,
    `INSERT INTO "SalePayment" ("saleId", "method", "amount") VALUES (1, 'CASH', 100)`,
    `INSERT INTO "StockMovement" ("productId", "type", "quantity", "saleId") VALUES (1, 'SALE', 2, 1)`,
  ]
  for (const sql of inserts) await seed.$executeRawUnsafe(sql)
  await disconnectAll()
  logStep("F2 datos de prueba insertados (venta con ítems, pago y movimiento)")

  copyMigrations(secondBatch, dir)
  const second = await runMigrations({ databaseUrl: url, migrationsDir: dir, logger: makeLogger() })
  assert(JSON.stringify(second.applied) === JSON.stringify(secondBatch), `F3 applied ${JSON.stringify(second.applied)}`)
  logStep("F3 aplica exactamente las 4 migraciones restantes, en orden")

  const after = openClient(url)
  assert((await countRows(after, 'SELECT COUNT(*) AS n FROM "SaleItem"')) === 2, "F4 SaleItem debe seguir con 2 filas")
  assert((await countRows(after, 'SELECT COUNT(*) AS n FROM "SalePayment"')) === 1, "F4 SalePayment debe seguir con 1 fila")
  assert(
    (await countRows(after, 'SELECT COUNT(*) AS n FROM "StockMovement" WHERE "saleId" IS NULL')) === 0,
    "F4 StockMovement.saleId no debe quedar NULL"
  )
  const product = await after.$queryRawUnsafe<{ barcode: string }[]>('SELECT CAST("barcode" AS TEXT) AS barcode FROM "Product"')
  assert(product[0]?.barcode === "7790001000011", `F4 barcode ${product[0]?.barcode}`)
  const sale = await after.$queryRawUnsafe<{ d: number }[]>('SELECT CAST("discountPct" AS REAL) AS d FROM "Sale"')
  assert(Number(sale[0]?.d) === 0, `F4 discountPct ${sale[0]?.d}`)
  logStep("F4 los datos quedan intactos (sin borrados en cascada)")

  const fkErrors = await after.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check")
  assert(fkErrors.length === 0, `F5 foreign_key_check devolvió ${JSON.stringify(fkErrors)}`)
  logStep("F5 PRAGMA foreign_key_check sin violaciones")
  await disconnectAll()

  assert(second.backupPath !== null, "F6 debe haber backup")
  assert(fs.existsSync(second.backupPath), `F6 el backup no existe: ${second.backupPath}`)
  assert(
    path.basename(second.backupPath).startsWith(`${path.basename(dbPath)}.backup-`),
    `F6 nombre del backup: ${second.backupPath}`
  )
  const backup = openClient(urlFor(second.backupPath))
  assert((await countRows(backup, 'SELECT COUNT(*) AS n FROM "SaleItem"')) === 2, "F6 backup con 2 SaleItem")
  assert((await countRows(backup, 'SELECT COUNT(*) AS n FROM "_prisma_migrations"')) === 5, "F6 backup con 5 migraciones")
  await disconnectAll()
  logStep("F6 backup creado con el estado anterior a migrar")
}

async function groupG(tmpRoot: string) {
  console.log("Grupo G — errores")

  const emptyDir = path.join(tmpRoot, "vacia")
  fs.mkdirSync(emptyDir, { recursive: true })
  await expectMigrationError(
    () => runMigrations({ databaseUrl: urlFor(path.join(tmpRoot, "g1.db")), migrationsDir: emptyDir, logger: makeLogger() }),
    "NO_MIGRATIONS",
    "G1"
  )
  logStep("G1 carpeta sin migraciones → NO_MIGRATIONS")

  // G2/G3: migración rota al final
  const brokenDir = path.join(tmpRoot, "rota-migrations")
  const brokenName = "99999999999999_broken"
  copyMigrations(realMigrationNames(), brokenDir)
  fs.mkdirSync(path.join(brokenDir, brokenName))
  fs.writeFileSync(path.join(brokenDir, brokenName, "migration.sql"), 'CREATE TABLE "Rota" (;')
  const brokenUrl = urlFor(path.join(tmpRoot, "rota.db"))

  const applyError = await expectMigrationError(
    () => runMigrations({ databaseUrl: brokenUrl, migrationsDir: brokenDir, logger: makeLogger() }),
    "APPLY_FAILED",
    "G2"
  )
  assert(applyError.message.includes(brokenName), `G2 mensaje: ${applyError.message}`)
  const failedClient = openClient(brokenUrl)
  const failedRows = await failedClient.$queryRawUnsafe<{ finished_at: unknown; logs: string | null }[]>(
    `SELECT "finished_at", "logs" FROM "_prisma_migrations" WHERE "migration_name" = '${brokenName}'`
  )
  assert(failedRows.length === 1, `G2 filas de la migración rota: ${failedRows.length}`)
  assert(failedRows[0].finished_at === null, "G2 finished_at debe ser NULL")
  assert(typeof failedRows[0].logs === "string" && failedRows[0].logs.length > 0, "G2 logs no vacío")
  await disconnectAll()
  logStep("G2 migración rota → APPLY_FAILED y queda registrada sin terminar")

  fs.writeFileSync(path.join(brokenDir, brokenName, "migration.sql"), 'CREATE TABLE "Rota" ("id" INTEGER);')
  const logger = makeLogger()
  await expectMigrationError(
    () => runMigrations({ databaseUrl: brokenUrl, migrationsDir: brokenDir, logger }),
    "FAILED_PREVIOUS",
    "G3"
  )
  const g3Client = openClient(brokenUrl)
  const rotaTables = await countRows(g3Client, "SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'Rota'")
  assert(rotaTables === 0, "G3 no debe intentar aplicar nada")
  await disconnectAll()
  logStep("G3 una migración fallida previa bloquea nuevas corridas (FAILED_PREVIOUS)")

  // G4: la DB tiene una migración que esta versión no conoce
  const unknownUrl = urlFor(path.join(tmpRoot, "desconocida.db"))
  await runMigrations({ databaseUrl: unknownUrl, migrationsDir, logger: makeLogger() })
  const g4Client = openClient(unknownUrl)
  await g4Client.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
     VALUES ('x-1', 'abc', ${Date.now()}, '99999999999999_desde_version_nueva', ${Date.now()}, 1)`
  )
  await disconnectAll()
  await expectMigrationError(
    () => runMigrations({ databaseUrl: unknownUrl, migrationsDir, logger: makeLogger() }),
    "UNKNOWN_APPLIED",
    "G4"
  )
  logStep("G4 migración aplicada desconocida → UNKNOWN_APPLIED")

  // G5: checksum distinto en una migración ya aplicada → solo warning
  const editedDir = path.join(tmpRoot, "editada-migrations")
  const names = realMigrationNames()
  copyMigrations(names, editedDir)
  const editedUrl = urlFor(path.join(tmpRoot, "editada.db"))
  await runMigrations({ databaseUrl: editedUrl, migrationsDir: editedDir, logger: makeLogger() })
  const edited = names[names.length - 1]
  fs.appendFileSync(path.join(editedDir, edited, "migration.sql"), "\n-- comentario agregado después\n")
  const g5Logger = makeLogger()
  const g5 = await runMigrations({ databaseUrl: editedUrl, migrationsDir: editedDir, logger: g5Logger })
  assert(g5.applied.length === 0, `G5 applied ${g5.applied.length}`)
  assert(g5Logger.warns.some((w) => w.includes(edited)), `G5 warns: ${JSON.stringify(g5Logger.warns)}`)
  logStep("G5 checksum distinto → warning, no se re-aplica")
}

// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== migrator.test.ts ===")

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "integral-migrator-"))
  let refDb: TestDb | null = null

  try {
    groupA()
    await groupB()
    groupC(tmpRoot)
    refDb = createMigratedTestDb("migrator-ref")
    const migratorDbUrl = await groupD(tmpRoot, refDb)
    await groupE(migratorDbUrl)
    await groupF(tmpRoot)
    await groupG(tmpRoot)
  } finally {
    await disconnectAll()
    refDb?.cleanup()
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }

  console.log("\nSUCCESS: todos los tests del migrador pasaron.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
