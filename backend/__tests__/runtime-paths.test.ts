/**
 * backend/__tests__/runtime-paths.test.ts
 *
 * Tests de electron/runtimePaths.ts (rutas que cambian entre dev y la app
 * empaquetada).
 *
 * Caso 1 — resolveMigrationsDir empaquetado → <resources>/migrations
 * Caso 2 — resolveMigrationsDir en dev → backend/prisma/migrations del repo (existe)
 * Caso 3 — findQueryEngineLibrary sin app.asar.unpacked → null
 * Caso 4 — findQueryEngineLibrary con el motor → devuelve su ruta
 * Caso 5 — findQueryEngineLibrary con la carpeta pero sin motor → null
 * Caso 6 — resolveLicenseFile empaquetado → <resources>/LICENSE.txt
 * Caso 7 — resolveLicenseFile en dev → LICENSE.txt de la raíz (existe)
 * Caso 8 — needsDatabaseUrl: calcula si falta o es relativa; respeta absolutas
 */

import fs from "fs"
import os from "os"
import path from "path"
import { findQueryEngineLibrary, needsDatabaseUrl, resolveLicenseFile, resolveMigrationsDir } from "../../electron/runtimePaths"

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..", "..")

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
// Runner principal
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== runtime-paths.test.ts ===")

  // Caso 1
  const packaged = resolveMigrationsDir({ isPackaged: true, resourcesPath: "C:\\App\\resources", dirname: "x" })
  assert(packaged === path.join("C:\\App\\resources", "migrations"), `empaquetado: ${packaged}`)
  logStep("resolveMigrationsDir empaquetado → resources/migrations")

  // Caso 2: en dev __dirname es <repo>/.vite/build
  const dev = resolveMigrationsDir({ isPackaged: false, resourcesPath: "x", dirname: path.join(repoRoot, ".vite", "build") })
  const expectedDev = path.join(repoRoot, "backend", "prisma", "migrations")
  assert(dev === expectedDev, `dev: ${dev} !== ${expectedDev}`)
  assert(fs.existsSync(dev), `la carpeta de migraciones de dev debe existir: ${dev}`)
  logStep("resolveMigrationsDir en dev → backend/prisma/migrations (existe)")

  // Caso 6
  const packagedLicense = resolveLicenseFile({ isPackaged: true, resourcesPath: "C:\\App\\resources", dirname: "x" })
  assert(packagedLicense === path.join("C:\\App\\resources", "LICENSE.txt"), `licencia empaquetada: ${packagedLicense}`)
  logStep("resolveLicenseFile empaquetado → resources/LICENSE.txt")

  // Caso 7
  const devLicense = resolveLicenseFile({ isPackaged: false, resourcesPath: "x", dirname: path.join(repoRoot, ".vite", "build") })
  assert(devLicense === path.join(repoRoot, "LICENSE.txt"), `licencia en dev: ${devLicense}`)
  assert(fs.existsSync(devLicense), `el LICENSE.txt de la raíz debe existir: ${devLicense}`)
  logStep("resolveLicenseFile en dev → LICENSE.txt de la raíz (existe)")

  // Caso 8
  assert(needsDatabaseUrl(undefined) === true, "sin DATABASE_URL hay que calcularla")
  assert(needsDatabaseUrl("") === true, "DATABASE_URL vacía hay que calcularla")
  assert(needsDatabaseUrl("file:./dev.db") === true, "la relativa del .env (cargada por Prisma) se reemplaza")
  assert(needsDatabaseUrl("file:C:/x/smoke.db") === false, "una absoluta (override explícito) se respeta")
  assert(needsDatabaseUrl("file:C:/x/smoke.db?connection_limit=1") === false, "absoluta con query se respeta")
  assert(needsDatabaseUrl("postgres://u:p@h/db") === false, "una URL que no es file: se respeta")
  logStep("needsDatabaseUrl ignora la DATABASE_URL relativa del .env y respeta overrides absolutos")

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "integral-runtime-paths-"))
  try {
    // Caso 3
    assert(findQueryEngineLibrary(tmp) === null, "sin app.asar.unpacked debe devolver null")
    logStep("findQueryEngineLibrary sin app.asar.unpacked → null")

    // Caso 5 (antes que el 4: la carpeta existe pero solo tiene index.js)
    const clientDir = path.join(tmp, "app.asar.unpacked", "node_modules", ".prisma", "client")
    fs.mkdirSync(clientDir, { recursive: true })
    fs.writeFileSync(path.join(clientDir, "index.js"), "")
    assert(findQueryEngineLibrary(tmp) === null, "sin el .node debe devolver null")
    logStep("findQueryEngineLibrary con la carpeta pero sin motor → null")

    // Caso 4
    const engine = path.join(clientDir, "query_engine-windows.dll.node")
    fs.writeFileSync(engine, "")
    const found = findQueryEngineLibrary(tmp)
    assert(found === engine, `debe devolver ${engine}, got ${found}`)
    logStep("findQueryEngineLibrary encuentra el motor desempaquetado")
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  console.log("\nSUCCESS: todos los tests de rutas de runtime pasaron.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
