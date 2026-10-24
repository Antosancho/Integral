/**
 * backend/__tests__/license.test.ts
 *
 * Tests de electron/license.ts (aceptación de la licencia de uso) y del
 * LICENSE.txt de la raíz.
 *
 * Caso 1 — readLicenseAcceptance: inexistente, JSON roto, {} y tipos incorrectos → null
 * Caso 2 — writeLicenseAcceptance crea la carpeta y lo escrito se vuelve a leer igual
 * Caso 3 — isLicenseAccepted según la versión
 * Caso 4 — LICENSE.txt: existe, ≤ 3000 caracteres, menciona la ingeniería inversa
 *          y su primera línea coincide con LICENSE_VERSION
 */

import fs from "fs"
import os from "os"
import path from "path"
import {
  LICENSE_VERSION,
  isLicenseAccepted,
  readLicenseAcceptance,
  writeLicenseAcceptance,
} from "../../electron/license"

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..", "..")
const licensePath = path.join(repoRoot, "LICENSE.txt")

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
  console.log("=== license.test.ts ===")

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "integral-license-"))
  try {
    // Caso 1
    assert(readLicenseAcceptance(path.join(tmp, "no-existe.json")) === null, "archivo inexistente → null")
    const cases: [string, string][] = [
      ["rota.json", "{rota"],
      ["vacio.json", "{}"],
      ["tipos.json", '{"licenseVersion": 1, "acceptedAt": "x"}'],
    ]
    for (const [name, content] of cases) {
      const file = path.join(tmp, name)
      fs.writeFileSync(file, content)
      assert(readLicenseAcceptance(file) === null, `${content} → null`)
    }
    logStep("readLicenseAcceptance devuelve null ante archivos inexistentes o inválidos")

    // Caso 2
    const nested = path.join(tmp, "sub", "carpeta", "inexistente.json")
    writeLicenseAcceptance(nested, "1", new Date("2026-01-02T03:04:05Z"))
    const read = readLicenseAcceptance(nested)
    assert(
      read?.licenseVersion === "1" && read.acceptedAt === "2026-01-02T03:04:05.000Z",
      `lectura después de escribir: ${JSON.stringify(read)}`
    )
    logStep("writeLicenseAcceptance crea la carpeta y guarda versión + fecha ISO")

    // Caso 3
    assert(isLicenseAccepted(null, "1") === false, "null → no aceptada")
    assert(isLicenseAccepted({ licenseVersion: "1", acceptedAt: "x" }, "1") === true, "misma versión → aceptada")
    assert(isLicenseAccepted({ licenseVersion: "1", acceptedAt: "x" }, "2") === false, "versión vieja → no aceptada")
    logStep("isLicenseAccepted exige la versión actual")
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  // Caso 4
  assert(fs.existsSync(licensePath), "LICENSE.txt debe existir en la raíz")
  const text = fs.readFileSync(licensePath, "utf-8").replace(/^﻿/, "")
  assert(text.length <= 3000, `LICENSE.txt debe tener ≤ 3000 caracteres (diálogo nativo), tiene ${text.length}`)
  assert(text.includes("ingeniería inversa"), "LICENSE.txt debe prohibir la ingeniería inversa")
  const firstLine = text.split(/\r?\n/)[0]
  const expected = `Licencia de uso de Integral — versión ${LICENSE_VERSION}`
  assert(firstLine === expected, `primera línea de LICENSE.txt: "${firstLine}", se esperaba "${expected}"`)
  logStep(`LICENSE.txt válido (${text.length} caracteres) y sincronizado con LICENSE_VERSION`)

  console.log("\nSUCCESS: todos los tests de la licencia pasaron.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
