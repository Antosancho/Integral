/**
 * backend/__tests__/wipe-test-data.test.ts
 *
 * Tests del script scripts/wipe-test-data.ts.
 * Cada test usa su propia DB SQLite aislada (DB nueva creada desde migraciones
 * con helpers/testDb.ts) para no leer ni modificar dev.db y no interferir con
 * otros tests que corren en paralelo.
 *
 * Test 1 — Dry run no borra nada
 * Test 2 — Confirm borra todo y resetea autoincrement
 * Test 3 — Sin flags aborta con exit code != 0
 * Test 4 — El orden de borrado respeta las FK con Restrict
 * Test 5 — DB ya vacía es idempotente (sin error por sqlite_sequence)
 * Test 6 — VACUUM elimina del archivo los residuos de las filas borradas
 * Test 7 — El wipe conserva el historial de migraciones (_prisma_migrations)
 * Test 8 — Dry run no compacta (el residuo sigue en el archivo)
 */

import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"
import { PrismaClient } from "@prisma/client"
import { createMigratedTestDb } from "./helpers/testDb"

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..", "..")
const wipeScript = path.join(repoRoot, "scripts", "wipe-test-data.ts")
const migrationsDir = path.join(repoRoot, "backend", "prisma", "migrations")

// ---------------------------------------------------------------------------
// Utilidades de assert
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
}

function logStep(step: string) {
  console.log(`  PASS: ${step}`)
}

// ---------------------------------------------------------------------------
// Helpers de DB (la creación de la DB aislada vive en helpers/testDb.ts)
// ---------------------------------------------------------------------------

/**
 * Crea un PrismaClient apuntando directamente a la URL dada.
 * Cada test instancia su propio cliente para evitar conflictos con el singleton
 * de backend/db/client.ts.
 */
function makePrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } })
}

/**
 * Corre el script de wipe como proceso hijo pasando DATABASE_URL por env.
 */
function runWipeScript(
  databaseUrl: string,
  args: string[]
): { status: number; stdout: string; stderr: string } {
  // shell: true es necesario en Windows para resolver npx desde PATH
  const result = spawnSync("npx ts-node " + [wipeScript, ...args].join(" "), [], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf-8",
    shell: true,
    // Timeout generoso para ts-node (compilación incluida)
    timeout: 120_000,
  })
  return {
    status: result.status ?? -1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  }
}

/**
 * Siembra el conjunto mínimo de datos de prueba en la DB aislada:
 *   1 Category → 1 Supplier → 1 Product → 1 Sale (1 SaleItem + 1 SalePayment) + 1 StockMovement
 * Este seed cubre todos los Restrict FK del schema.
 */
async function seedTestData(prisma: PrismaClient) {
  // La DB nace vacía desde migraciones: no hace falta limpiar antes de seedear.
  const category = await prisma.category.create({ data: { name: "Wipe test category" } })
  const supplier = await prisma.supplier.create({ data: { name: "Wipe test supplier" } })
  const product = await prisma.product.create({
    data: {
      name: "Wipe test product",
      purchasePrice: "10",
      salePrice: "20",
      stock: 5,
      minStock: 1,
      categoryId: category.id,
      supplierId: supplier.id,
    },
  })
  const sale = await prisma.sale.create({
    data: {
      total: "20",
      items: {
        create: [{ productId: product.id, quantity: 1, unitPrice: "20" }],
      },
      payments: {
        create: [{ method: "CASH", amount: "20" }],
      },
    },
  })
  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      type: "IN",
      quantity: 5,
      appliedDelta: 5,
    },
  })
  return { category, supplier, product, sale }
}

/**
 * Siembra el set mínimo (seedTestData) más un producto extra cuyo nombre es
 * un marcador único. Ese texto queda escrito en los bytes del archivo SQLite
 * y permite comprobar si sobrevive al wipe (residuo en páginas libres).
 */
async function seedWithMarker(prisma: PrismaClient, marker: string) {
  const seeded = await seedTestData(prisma)
  await prisma.product.create({
    data: {
      name: marker,
      purchasePrice: "1",
      salePrice: "2",
      stock: 1,
      minStock: 0,
      categoryId: seeded.category.id,
      supplierId: seeded.supplier.id,
    },
  })
  return seeded
}

/**
 * Indica si el texto aparece literalmente en los bytes del archivo.
 * Llamar solo con los PrismaClient desconectados, así el contenido ya está
 * volcado a disco y Windows no bloquea la lectura.
 */
function fileContainsText(filePath: string, text: string): boolean {
  return fs.readFileSync(filePath).includes(Buffer.from(text, "utf-8"))
}

/**
 * Cantidad de migraciones esperadas = cantidad de carpetas en
 * backend/prisma/migrations/ (migration_lock.toml es un archivo y no cuenta).
 */
function countMigrationFolders(): number {
  return fs.readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
    .length
}

// ---------------------------------------------------------------------------
// Test 1 — Dry run no borra nada
// ---------------------------------------------------------------------------

async function test1_dryRunNoDeletes() {
  console.log("\nTest 1 — Dry run no borra nada")
  const testDb = createMigratedTestDb("wipe")
  const { dbPath, databaseUrl } = testDb
  const prisma = makePrismaClient(databaseUrl)

  try {
    await seedTestData(prisma)

    const result = runWipeScript(databaseUrl, ["--dry-run"])

    assert(result.status === 0, `exit code debe ser 0, got ${result.status}\nstderr: ${result.stderr}`)
    assert(result.stdout.includes("DRY RUN"), `stdout debe incluir "DRY RUN", got: ${result.stdout}`)

    // Las filas deben seguir intactas
    assert((await prisma.category.count()) === 1, "Category debe seguir en 1 tras dry-run")
    assert((await prisma.product.count()) === 1, "Product debe seguir en 1 tras dry-run")
    assert((await prisma.sale.count()) === 1, "Sale debe seguir en 1 tras dry-run")

    logStep("dry-run no modifica datos")
    logStep("stdout contiene DRY RUN")
  } finally {
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Test 2 — Confirm borra todo y resetea autoincrement
// ---------------------------------------------------------------------------

async function test2_confirmDeletesAll() {
  console.log("\nTest 2 — Confirm borra todo y resetea autoincrement")
  const testDb = createMigratedTestDb("wipe")
  const { dbPath, databaseUrl } = testDb
  const prisma = makePrismaClient(databaseUrl)

  try {
    await seedTestData(prisma)

    const result = runWipeScript(databaseUrl, ["--confirm"])

    assert(result.status === 0, `exit code debe ser 0, got ${result.status}\nstderr: ${result.stderr}`)

    // Las 7 tablas deben estar en 0
    assert((await prisma.salePayment.count()) === 0, "SalePayment debe quedar en 0")
    assert((await prisma.saleItem.count()) === 0, "SaleItem debe quedar en 0")
    assert((await prisma.stockMovement.count()) === 0, "StockMovement debe quedar en 0")
    assert((await prisma.sale.count()) === 0, "Sale debe quedar en 0")
    assert((await prisma.product.count()) === 0, "Product debe quedar en 0")
    assert((await prisma.category.count()) === 0, "Category debe quedar en 0")
    assert((await prisma.supplier.count()) === 0, "Supplier debe quedar en 0")

    // Verificar que el autoincrement fue reseteado: el primer registro nuevo debe
    // tener id === 1 en cada tabla principal.
    const newCategory = await prisma.category.create({ data: { name: "Post-wipe category" } })
    assert(newCategory.id === 1, `Category.id debe ser 1 tras reset, got ${newCategory.id}`)

    const newSupplier = await prisma.supplier.create({ data: { name: "Post-wipe supplier" } })
    assert(newSupplier.id === 1, `Supplier.id debe ser 1 tras reset, got ${newSupplier.id}`)

    const newProduct = await prisma.product.create({
      data: {
        name: "Post-wipe product",
        purchasePrice: "5",
        salePrice: "10",
        stock: 0,
        minStock: 0,
        categoryId: newCategory.id,
        supplierId: newSupplier.id,
      },
    })
    assert(newProduct.id === 1, `Product.id debe ser 1 tras reset, got ${newProduct.id}`)

    logStep("las 7 tablas quedan en 0 filas")
    logStep("autoincrement reseteado (Category, Supplier, Product arrancan en id=1)")
  } finally {
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Test 3 — Sin flags aborta con exit code != 0
// ---------------------------------------------------------------------------

async function test3_noFlagsAborts() {
  console.log("\nTest 3 — Sin flags aborta con exit code != 0")
  const testDb = createMigratedTestDb("wipe")
  const { dbPath, databaseUrl } = testDb

  try {
    // No se seedea nada porque el script debe abortar antes de tocar la DB
    const result = runWipeScript(databaseUrl, [])

    assert(result.status !== 0, `exit code debe ser != 0 sin flags, got ${result.status}`)
    const combined = result.stdout + result.stderr
    assert(
      combined.includes("--dry-run") || combined.includes("--confirm"),
      `stderr/stdout debe mencionar --dry-run o --confirm, got: ${combined}`
    )

    logStep("sin flags el script aborta con exit code != 0")
    logStep("stderr menciona --dry-run / --confirm")
  } finally {
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Test 4 — El orden de borrado respeta las FK con Restrict
// ---------------------------------------------------------------------------

async function test4_deleteOrderRespectsRestrictFks() {
  console.log("\nTest 4 — Orden de borrado respeta FK Restrict")
  const testDb = createMigratedTestDb("wipe")
  const { dbPath, databaseUrl } = testDb
  const prisma = makePrismaClient(databaseUrl)

  try {
    // Seedear un escenario que rompe todos los Restrict en cadena:
    //   StockMovement → Product (Restrict)
    //   SaleItem      → Product (Restrict)
    //   Product       → Category (Restrict)
    //   Product       → Supplier (Restrict)
    await seedTestData(prisma)

    const result = runWipeScript(databaseUrl, ["--confirm"])

    // Si el orden de borrado fuera incorrecto, Prisma lanzaría un error de FK
    // constraint y el exit code sería != 0.
    assert(
      result.status === 0,
      `exit code debe ser 0 si el orden es correcto, got ${result.status}\nstderr: ${result.stderr}\nstdout: ${result.stdout}`
    )

    assert((await prisma.product.count()) === 0, "Product debe quedar en 0")
    assert((await prisma.category.count()) === 0, "Category debe quedar en 0")
    assert((await prisma.stockMovement.count()) === 0, "StockMovement debe quedar en 0")

    logStep("el orden de borrado no viola ninguna FK Restrict")
  } finally {
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Test 5 — DB ya vacía es idempotente (sin error por sqlite_sequence)
// ---------------------------------------------------------------------------

async function test5_emptyDbIsIdempotent() {
  console.log("\nTest 5 — DB vacía es idempotente (sqlite_sequence puede no existir)")
  const testDb = createMigratedTestDb("wipe")
  const { dbPath, databaseUrl } = testDb
  const prisma = makePrismaClient(databaseUrl)

  try {
    // Limpiar todo para dejar la DB vacía antes de correr el wipe
    await prisma.stockMovement.deleteMany()
    await prisma.salePayment.deleteMany()
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await prisma.supplier.deleteMany()

    const result = runWipeScript(databaseUrl, ["--confirm"])

    assert(
      result.status === 0,
      `exit code debe ser 0 con DB vacía, got ${result.status}\nstderr: ${result.stderr}`
    )

    // Todas las tablas siguen en 0 y no hay error por sqlite_sequence
    assert((await prisma.category.count()) === 0, "Category debe seguir en 0")
    assert((await prisma.product.count()) === 0, "Product debe seguir en 0")
    assert((await prisma.sale.count()) === 0, "Sale debe seguir en 0")

    logStep("DB vacía no lanza error por sqlite_sequence")
    logStep("todas las tablas siguen en 0 tras wipe de DB vacía")
  } finally {
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Test 6 — VACUUM elimina del archivo los residuos de las filas borradas
// ---------------------------------------------------------------------------

async function test6_vacuumRemovesResidue() {
  console.log("\nTest 6 — VACUUM elimina residuos del archivo")
  const testDb = createMigratedTestDb("wipe")
  const { dbPath, databaseUrl } = testDb
  const prisma = makePrismaClient(databaseUrl)
  const marker = `WIPE-RESIDUE-MARKER-${Date.now()}`

  try {
    await seedWithMarker(prisma, marker)
    // Desconectar para que el contenido quede volcado y el archivo liberado
    await prisma.$disconnect()

    // Sanity check: prueba que el test es capaz de detectar el residuo
    assert(fileContainsText(dbPath, marker), "el marcador debe estar en el archivo antes del wipe")

    const result = runWipeScript(databaseUrl, ["--confirm"])
    assert(result.status === 0, `exit code debe ser 0, got ${result.status}\nstderr: ${result.stderr}`)

    assert(
      !fileContainsText(dbPath, marker),
      "el marcador no debe quedar en el archivo tras el wipe (VACUUM)"
    )
    assert(result.stdout.includes("VACUUM"), `stdout debe mencionar VACUUM, got: ${result.stdout}`)

    logStep("el marcador desaparece de los bytes del archivo")
    logStep("stdout menciona VACUUM")
  } finally {
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Test 7 — El wipe conserva el historial de migraciones
// ---------------------------------------------------------------------------

async function test7_keepsMigrationHistory() {
  console.log("\nTest 7 — El wipe conserva el historial de migraciones")
  const testDb = createMigratedTestDb("wipe")
  const { databaseUrl } = testDb
  const prisma = makePrismaClient(databaseUrl)

  try {
    await seedTestData(prisma)

    const result = runWipeScript(databaseUrl, ["--confirm"])
    assert(result.status === 0, `exit code debe ser 0, got ${result.status}\nstderr: ${result.stderr}`)

    // _prisma_migrations no está en DELETE_ORDER: si el wipe la vaciara,
    // `prisma migrate deploy` intentaría re-aplicar todo sobre tablas existentes.
    const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
      "SELECT COUNT(*) AS n FROM _prisma_migrations"
    )
    const migrations = Number(rows[0].n)
    const expected = countMigrationFolders()
    assert(migrations === expected, `_prisma_migrations debe tener ${expected} filas, got ${migrations}`)

    logStep(`_prisma_migrations conserva sus ${expected} filas`)
  } finally {
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Test 8 — Dry run no compacta
// ---------------------------------------------------------------------------

async function test8_dryRunDoesNotVacuum() {
  console.log("\nTest 8 — Dry run no compacta")
  const testDb = createMigratedTestDb("wipe")
  const { dbPath, databaseUrl } = testDb
  const prisma = makePrismaClient(databaseUrl)
  const marker = `WIPE-RESIDUE-MARKER-${Date.now()}`

  try {
    await seedWithMarker(prisma, marker)
    await prisma.$disconnect()

    const result = runWipeScript(databaseUrl, ["--dry-run"])
    assert(result.status === 0, `exit code debe ser 0, got ${result.status}\nstderr: ${result.stderr}`)

    assert(fileContainsText(dbPath, marker), "el marcador debe seguir en el archivo tras dry-run")
    assert(
      !result.stdout.includes("VACUUM ejecutado"),
      `dry-run no debe ejecutar VACUUM, stdout: ${result.stdout}`
    )

    logStep("dry-run deja el archivo intacto (el marcador sigue)")
    logStep("stdout no incluye \"VACUUM ejecutado\"")
  } finally {
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== wipe-test-data.test.ts ===")

  await test1_dryRunNoDeletes()
  await test2_confirmDeletesAll()
  await test3_noFlagsAborts()
  await test4_deleteOrderRespectsRestrictFks()
  await test5_emptyDbIsIdempotent()
  await test6_vacuumRemovesResidue()
  await test7_keepsMigrationHistory()
  await test8_dryRunDoesNotVacuum()

  console.log("\nSUCCESS: todos los tests del script de wipe pasaron.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
