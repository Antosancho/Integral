/**
 * scripts/smoke-packaged.mjs
 *
 * Smoke test del binario empaquetado (out/Integral-win32-x64/Integral.exe).
 *
 * Lanza la app real con INTEGRAL_SMOKE_RESULT (ver electron/smoke.ts): la app
 * aplica migraciones, abre la ventana, corre sus chequeos internos, escribe un
 * JSON con el resultado y se cierra sola.
 *
 * Corridas (todas sobre bases en una carpeta temporal, nunca sobre dev.db):
 *   1. DB nueva                → crea la base y aplica todas las migraciones
 *   2. Segunda apertura        → no aplica nada
 *   3. DB creada por el CLI    → caso "el cliente copia su dev.db": nada pendiente
 *   4. ELECTRON_RUN_AS_NODE=1  → el fuse RunAsNode apagado hace que se ignore
 *
 * Uso: npm run test:smoke-packaged [-- --keep]   (--keep conserva la carpeta temporal)
 */

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"

// ---------------------------------------------------------------------------
// Rutas y constantes
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const EXE = path.join(ROOT, "out", "Integral-win32-x64", "Integral.exe")
const MIGRATION_COUNT = fs
  .readdirSync(path.join(ROOT, "backend", "prisma", "migrations"), { withFileTypes: true })
  .filter((d) => d.isDirectory()).length
const RUN_TIMEOUT_MS = 90_000
const KEEP = process.argv.includes("--keep")

const urlFor = (dbPath) => `file:${dbPath.replace(/\\/g, "/")}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Lanza el exe empaquetado en modo smoke y espera a que termine.
 * @returns {Promise<{ code: number | null, result: object | null, timedOut: boolean }>}
 */
function runApp(dbPath, resultPath, extraEnv = {}) {
  const env = { ...process.env, DATABASE_URL: urlFor(dbPath), INTEGRAL_SMOKE_RESULT: resultPath, ...extraEnv }
  // Si la terminal hereda ELECTRON_RUN_AS_NODE (VS Code), el exe de desarrollo correría como Node.
  if (!("ELECTRON_RUN_AS_NODE" in extraEnv)) delete env.ELECTRON_RUN_AS_NODE
  fs.rmSync(resultPath, { force: true })

  return new Promise((resolve) => {
    const child = spawn(EXE, [], { env, stdio: "inherit" })
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, RUN_TIMEOUT_MS)
    child.on("exit", (code) => {
      clearTimeout(timer)
      const result = fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, "utf-8")) : null
      resolve({ code, result, timedOut })
    })
  })
}

let failures = 0

/** Evalúa una corrida: `expectations` es una lista de [descripción, condición]. */
function report(label, run, expectations) {
  if (run.timedOut) {
    failures++
    console.log(`FAIL: ${label} — timeout de ${RUN_TIMEOUT_MS / 1000}s (¿hay otra instancia de Integral abierta?)`)
    return
  }
  const failed = expectations.filter(([, ok]) => !ok).map(([desc]) => desc)
  if (run.code === 0 && run.result && failed.length === 0) {
    console.log(`PASS: ${label}`)
  } else {
    failures++
    console.log(`FAIL: ${label} (code ${run.code})${failed.length ? ` — ${failed.join("; ")}` : ""}`)
    console.log(JSON.stringify(run.result, null, 2))
  }
}

/** Chequeos comunes a toda corrida exitosa. */
function baseExpectations(result) {
  return [
    ["result.ok", result?.ok === true],
    ["isPackaged", result?.isPackaged === true],
    ["apiType === object", result?.apiType === "object"],
    ["rootChildren > 0", result?.rootChildren > 0],
    // Fase 11A: el main del paquete corre desde el bytecode, no desde JS legible
    ["mainFile === main.jsc", result?.mainFile === "main.jsc"],
  ]
}

// ---------------------------------------------------------------------------
// Corridas
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(EXE)) {
    console.error(`No existe ${EXE}. Corré "npm run package" primero.`)
    process.exit(1)
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "integral-smoke-"))
  console.log(`Carpeta temporal: ${tmp}`)

  try {
    const smokeDb = path.join(tmp, "smoke.db")

    // 1. DB nueva
    const run1 = await runApp(smokeDb, path.join(tmp, "result-1.json"))
    const r1 = run1.result
    report("1. DB nueva", run1, [
      ...baseExpectations(r1),
      ["dbCreated", r1?.dbCreated === true],
      [`migrationsApplied === ${MIGRATION_COUNT}`, r1?.migrationsApplied === MIGRATION_COUNT],
      ["userData termina en Integral", typeof r1?.userDataPath === "string" && path.basename(r1.userDataPath).toLowerCase() === "integral"],
    ])

    // 2. Segunda apertura sobre la misma DB
    const run2 = await runApp(smokeDb, path.join(tmp, "result-2.json"))
    report("2. Segunda apertura", run2, [
      ...baseExpectations(run2.result),
      ["migrationsApplied === 0", run2.result?.migrationsApplied === 0],
      ["dbCreated === false", run2.result?.dbCreated === false],
    ])

    // 3. DB del cliente creada por el CLI de Prisma
    const legacyDb = path.join(tmp, "legacy.db")
    const deploy = spawnSync("npx prisma migrate deploy --schema backend/prisma/schema.prisma", {
      cwd: ROOT,
      shell: true,
      encoding: "utf-8",
      env: { ...process.env, DATABASE_URL: urlFor(legacyDb) },
    })
    if (deploy.status !== 0) {
      failures++
      console.log(`FAIL: 3. no se pudo crear legacy.db con el CLI\n${deploy.stdout}\n${deploy.stderr}`)
    } else {
      const run3 = await runApp(legacyDb, path.join(tmp, "result-3.json"))
      report("3. DB creada por el CLI (dev.db del cliente)", run3, [
        ...baseExpectations(run3.result),
        ["migrationsApplied === 0", run3.result?.migrationsApplied === 0],
      ])
    }

    // 4. Fuse RunAsNode: con ELECTRON_RUN_AS_NODE=1 la app tiene que arrancar igual
    const run4 = await runApp(smokeDb, path.join(tmp, "result-4.json"), { ELECTRON_RUN_AS_NODE: "1" })
    report("4. ELECTRON_RUN_AS_NODE=1 ignorado (fuse RunAsNode)", run4, baseExpectations(run4.result))
  } finally {
    if (KEEP) console.log(`(--keep) Se conserva ${tmp}`)
    else fs.rmSync(tmp, { recursive: true, force: true })
  }

  console.log(failures === 0 ? "\nOK: 4/4 corridas pasaron." : `\n${failures} corrida(s) fallaron.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
