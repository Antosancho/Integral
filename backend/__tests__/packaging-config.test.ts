/**
 * backend/__tests__/packaging-config.test.ts
 *
 * Tests estáticos de la configuración de empaquetado (Electron Forge v8 + Vite).
 * Leen archivos como texto/JSON: no construyen nada, así que son rápidos y
 * detectan regresiones de config antes de un `npm run package` de varios minutos.
 *
 * Caso 1 — package.json: main, productName, author y description
 * Caso 2 — @electron-forge/*: misma versión exacta en todos
 * Caso 3 — dependencias: runtime vs dev
 * Caso 4 — electron/main.ts: preload .cjs, globals de Vite, sandbox, squirrel, etc.
 * Caso 5 — electron/main.ts: setupEnv es el primer import
 * Caso 6 — forge.config.mts: migraciones, asar.unpack, Prisma, fuses, renderer
 * Caso 7 — vite.renderer.config.mts: outDir main_window y CSP
 * Caso 8 — .gitignore: out/, .vite/, dist/
 * Caso 9 — scripts/dev.js ya no existe
 * Caso 10 — forge.config.mts compila el main a bytecode (bytenode)
 * Caso 11 — vite.renderer.config.mts ofusca el renderer sin opciones que rompan la CSP
 * Caso 12 — licencia de uso: main.ts la pide antes de migrar y forge la empaqueta
 */

import fs from "fs"
import path from "path"

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..", "..")

function readText(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf-8")
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

/** Verifica que `source` contenga cada uno de los fragmentos. */
function assertContainsAll(source: string, fragments: string[], file: string) {
  for (const fragment of fragments) {
    assert(source.includes(fragment), `${file} debe contener ${JSON.stringify(fragment)}`)
  }
}

/** Verifica que `source` NO contenga ninguno de los fragmentos. */
function assertContainsNone(source: string, fragments: string[], file: string) {
  for (const fragment of fragments) {
    assert(!source.includes(fragment), `${file} no debe contener ${JSON.stringify(fragment)}`)
  }
}

// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------

type PackageJson = {
  main?: string
  productName?: string
  author?: string
  description?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function main() {
  console.log("=== packaging-config.test.ts ===")

  const pkg = JSON.parse(readText("package.json")) as PackageJson
  const deps = pkg.dependencies ?? {}
  const devDeps = pkg.devDependencies ?? {}

  // Caso 1
  assert(pkg.main === ".vite/build/main.cjs", `main debe ser .vite/build/main.cjs, got ${pkg.main}`)
  assert(pkg.productName === "Integral", `productName debe ser Integral, got ${pkg.productName}`)
  assert(typeof pkg.author === "string" && pkg.author.trim() !== "", "author no puede estar vacío (Squirrel)")
  assert(typeof pkg.description === "string" && pkg.description.trim() !== "", "description no puede estar vacía (Squirrel)")
  logStep("package.json: main, productName, author y description")

  // Caso 2
  const forgeVersions = Object.entries({ ...deps, ...devDeps })
    .filter(([name]) => name.startsWith("@electron-forge/"))
    .map(([, version]) => version)
  assert(forgeVersions.length > 0, "debe haber dependencias @electron-forge/*")
  assert(new Set(forgeVersions).size === 1, `@electron-forge/* con versiones distintas: ${forgeVersions.join(", ")}`)
  assert(/^\d+\.\d+\.\d+$/.test(forgeVersions[0]), `versión de Forge no exacta: ${forgeVersions[0]}`)
  logStep(`@electron-forge/* alineados en ${forgeVersions[0]} (exacta)`)

  // Caso 3
  for (const name of ["electron", "prisma", "electron-squirrel-startup"]) {
    assert(name in devDeps, `${name} debe estar en devDependencies`)
    assert(!(name in deps), `${name} no debe estar en dependencies`)
  }
  const runtimeDeps = Object.keys(deps).sort()
  assert(
    JSON.stringify(runtimeDeps) === JSON.stringify(["@prisma/client", "bytenode"]),
    `dependencies debe ser exactamente ["@prisma/client", "bytenode"], got ${JSON.stringify(runtimeDeps)}`
  )
  assert(deps.bytenode === "1.7.0", `bytenode debe ser 1.7.0 exacto, got ${deps.bytenode}`)
  logStep("dependencies solo con los externals de runtime; el resto en devDependencies")

  // Caso 4
  const mainTs = readText("electron/main.ts")
  assertContainsAll(
    mainTs,
    [
      "preload.cjs",
      "MAIN_WINDOW_VITE_DEV_SERVER_URL",
      "MAIN_WINDOW_VITE_NAME",
      "sandbox: true",
      "electron-squirrel-startup",
      "requestSingleInstanceLock",
      "runMigrations",
      "Menu.setApplicationMenu(null)",
    ],
    "electron/main.ts"
  )
  assertContainsNone(mainTs, ["localhost:5173", "sandbox: false"], "electron/main.ts")
  logStep("electron/main.ts: ventana segura, globals de Vite, squirrel, instancia única y migraciones")

  // Caso 5: la primera línea que es una sentencia import (no comentarios)
  const firstImport = mainTs.split(/\r?\n/).find((line) => /^import\s/.test(line))
  assert(firstImport?.startsWith('import "./setupEnv"'), `el primer import debe ser "./setupEnv", got ${firstImport}`)
  logStep('electron/main.ts: import "./setupEnv" es el primer import')

  // Caso 6
  const forgeConfig = readText("forge.config.mts")
  assertContainsAll(
    forgeConfig,
    [
      "extraResource",
      '"migrations"',
      'unpack: "*.node"',
      "packageAfterPrune",
      ".prisma",
      "@prisma",
      "FuseV1Options.RunAsNode]: false",
      "OnlyLoadAppFromAsar]: true",
      'name: "main_window"',
    ],
    "forge.config.mts"
  )
  logStep("forge.config.mts: migraciones, motor de Prisma, fuses y renderer main_window")

  // Caso 7
  const rendererConfig = readText("vite.renderer.config.mts")
  assertContainsAll(rendererConfig, ['"main_window"', "Content-Security-Policy"], "vite.renderer.config.mts")
  logStep("vite.renderer.config.mts: outDir main_window y CSP de producción")

  // Caso 8
  const gitignoreLines = readText(".gitignore").split(/\r?\n/).map((line) => line.trim())
  for (const entry of ["out/", ".vite/", "dist/"]) {
    assert(gitignoreLines.includes(entry), `.gitignore debe incluir ${entry}`)
  }
  logStep(".gitignore ignora out/, .vite/ y dist/")

  // Caso 9
  assert(!fs.existsSync(path.join(repoRoot, "scripts", "dev.js")), "scripts/dev.js debe estar borrado (lo reemplaza Forge)")
  logStep("scripts/dev.js no existe")

  // Caso 10 — bytecode del main (Fase 11A)
  assertContainsAll(
    forgeConfig,
    ["compileMainToBytecode", "compile-main.cjs", "ELECTRON_RUN_AS_NODE", '"bytenode"'],
    "forge.config.mts"
  )
  assert(fs.existsSync(path.join(repoRoot, "scripts", "bytecode", "compile-main.cjs")), "debe existir scripts/bytecode/compile-main.cjs")
  logStep("forge.config.mts compila el main a bytecode con scripts/bytecode/compile-main.cjs")

  // Caso 11 — ofuscación del renderer (Fase 11B), sin opciones incompatibles con la CSP
  assertContainsAll(rendererConfig, ["browser-no-eval", "manualChunks", "obfuscatorPlugin()", '"vendor"'], "vite.renderer.config.mts")
  assertContainsNone(rendererConfig, ["selfDefending: true", "debugProtection: true", "domainLock"], "vite.renderer.config.mts")
  logStep("vite.renderer.config.mts ofusca la app (browser-no-eval) y separa el chunk vendor")

  // Caso 12 — licencia de uso (Fase 11C)
  assertContainsAll(mainTs, ["ensureLicenseAccepted", "LICENSE_VERSION", "!SMOKE_RESULT && !ensureLicenseAccepted()"], "electron/main.ts")
  assertContainsAll(forgeConfig, ["LICENSE.txt"], "forge.config.mts")
  logStep("main.ts pide la licencia antes de migrar y forge.config.mts la empaqueta")

  console.log("\nSUCCESS: la configuración de empaquetado es consistente.")
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
