/**
 * backend/__tests__/testDb-helper.test.ts
 *
 * Tests del helper backend/__tests__/helpers/testDb.ts (createMigratedTestDb).
 * Es la base de todos los demás tests de DB, por eso corre primero en
 * `npm run test:backend`.
 *
 * Caso 1 — Crea el archivo
 * Caso 2 — Aplica todas las migraciones
 * Caso 3 — La DB nace vacía (7 tablas de negocio en 0 filas)
 * Caso 4 — No toca dev.db (SHA-256 igual antes y después)
 * Caso 5 — El archivo está ignorado por git
 * Caso 6 — cleanup() borra el archivo
 */

import fs from "fs"
import path from "path"
import crypto from "crypto"
import { spawnSync } from "child_process"
import { PrismaClient } from "@prisma/client"
import { createMigratedTestDb } from "./helpers/testDb"

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..", "..")
const devDbPath = path.join(repoRoot, "backend", "prisma", "dev.db")
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * SHA-256 de un archivo, o `null` si no existe (en una instalación nueva
 * dev.db puede no haberse creado todavía).
 */
function hashFileIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
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
// Runner principal
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== testDb-helper.test.ts ===")

  const devDbHashBefore = hashFileIfExists(devDbPath)
  const testDb = createMigratedTestDb("helper")
  const devDbHashAfter = hashFileIfExists(devDbPath)

  const prisma = new PrismaClient({ datasources: { db: { url: testDb.databaseUrl } } })
  let disconnected = false

  try {
    // Caso 1 — Crea el archivo
    assert(fs.existsSync(testDb.dbPath), `la DB de test debe existir en ${testDb.dbPath}`)
    logStep("crea el archivo de la DB de test")

    // Caso 2 — Migraciones aplicadas (solo cuentan las que terminaron bien)
    const expectedMigrations = countMigrationFolders()
    const migrationRows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
      "SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL"
    )
    const appliedMigrations = Number(migrationRows[0].n)
    assert(
      appliedMigrations === expectedMigrations,
      `migraciones aplicadas debe ser ${expectedMigrations}, got ${appliedMigrations}`
    )
    logStep(`aplica las ${expectedMigrations} migraciones`)

    // Caso 3 — Vacía
    const counts = {
      category: await prisma.category.count(),
      supplier: await prisma.supplier.count(),
      product: await prisma.product.count(),
      stockMovement: await prisma.stockMovement.count(),
      sale: await prisma.sale.count(),
      saleItem: await prisma.saleItem.count(),
      salePayment: await prisma.salePayment.count(),
    }
    for (const [table, count] of Object.entries(counts)) {
      assert(count === 0, `${table} debe tener 0 filas, got ${count}`)
    }
    logStep("las 7 tablas de negocio arrancan en 0 filas")

    // Caso 4 — No toca dev.db
    assert(devDbHashBefore === devDbHashAfter, "crear la DB de test no debe modificar dev.db")
    logStep(
      devDbHashBefore === null
        ? "no crea dev.db (no existía)"
        : "dev.db queda intacta (SHA-256 igual)"
    )

    // Caso 5 — Ignorada por git (status 0 = la ruta está ignorada)
    const checkIgnore = spawnSync("git", ["check-ignore", "-q", testDb.dbPath], {
      cwd: repoRoot,
      encoding: "utf-8",
    })
    assert(
      checkIgnore.status === 0,
      `la DB de test debe estar ignorada por git, git check-ignore devolvió ${checkIgnore.status}`
    )
    logStep("la DB de test está ignorada por git")

    // Caso 6 — Cleanup (hay que desconectar antes: en Windows el archivo
    // abierto no se puede borrar)
    await prisma.$disconnect()
    disconnected = true
    testDb.cleanup()
    assert(!fs.existsSync(testDb.dbPath), "cleanup() debe borrar el archivo de la DB")
    logStep("cleanup() borra el archivo")
  } finally {
    // Si algún assert falló antes del caso 6, igual liberamos y borramos.
    if (!disconnected) {
      await prisma.$disconnect()
      testDb.cleanup()
    }
  }

  console.log("\nSUCCESS: todos los tests del helper de DB pasaron.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
