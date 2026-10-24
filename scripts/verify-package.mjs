/**
 * scripts/verify-package.mjs
 *
 * Verificación estática del paquete generado por `npm run package`
 * (out/Integral-win32-x64/). Con `--make` también verifica el instalador de
 * Squirrel generado por `npm run make`.
 *
 * Imprime PASS:/FAIL: por chequeo y sale con código 1 si alguno falló.
 *
 *   npm run verify:package     → chequeos 1 a 10 y 12 a 14
 *   npm run verify:make        → todos, más el 11 (instalador)
 *
 * Los chequeos 3, 7–9, 12 (bytecode del main) y 13 (renderer ofuscado) cubren
 * el requisito de no exponer código fuente ni datos dentro del paquete.
 * El 14 verifica que la licencia de uso viaje en el paquete.
 */

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { listPackage, extractFile } from "@electron/asar"
import { getCurrentFuseWire, FuseV1Options, FuseState } from "@electron/fuses"

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const APP_DIR = path.join(ROOT, "out", "Integral-win32-x64")
const EXE = path.join(APP_DIR, "Integral.exe")
const RES = path.join(APP_DIR, "resources")
const ASAR = path.join(RES, "app.asar")
const REPO_MIGRATIONS = path.join(ROOT, "backend", "prisma", "migrations")
const MAKE_DIR = path.join(ROOT, "out", "make", "squirrel.windows", "x64")
const CHECK_MAKE = process.argv.includes("--make")

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

let failures = 0

/** Registra el resultado de un chequeo. `detail` se muestra solo si falla. */
function check(label, ok, detail = "") {
  if (ok) {
    console.log(`PASS: ${label}`)
  } else {
    failures++
    console.log(`FAIL: ${label}${detail ? `\n      ${detail}` : ""}`)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex")

/** Lee un archivo del asar (ruta con "/") como Buffer. @electron/asar busca con el separador del SO. */
const asarBuffer = (entry) => extractFile(ASAR, entry.split("/").join(path.sep))

/** Lee un archivo del asar como texto UTF-8. */
const asarText = (entry) => asarBuffer(entry).toString("utf-8")

/** Conjunto de módulos pedidos con require("...") en un bundle. */
function requiredModules(source) {
  return new Set([...source.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]))
}

/** Carpetas de migración (sin migration_lock.toml). */
function migrationFolders(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
}

// ---------------------------------------------------------------------------
// Chequeos
// ---------------------------------------------------------------------------

async function main() {
  // 1. Binario y asar
  const hasExe = fs.existsSync(EXE)
  const hasAsar = fs.existsSync(ASAR)
  check("1. existen Integral.exe y resources/app.asar", hasExe && hasAsar, `exe=${hasExe} asar=${hasAsar}`)
  if (!hasExe || !hasAsar) {
    console.log("\nNo hay paquete para verificar. Corré `npm run package` primero.")
    process.exit(1)
  }

  // Entradas del asar normalizadas: "\" → "/" y sin "/" inicial
  const entries = listPackage(ASAR, { isPack: false }).map((e) => e.replace(/\\/g, "/").replace(/^\//, ""))
  const entrySet = new Set(entries)

  // 2. Contenido obligatorio
  const required = [
    "package.json",
    ".vite/build/main.cjs",
    ".vite/build/preload.cjs",
    ".vite/renderer/main_window/index.html",
    "node_modules/@prisma/client/package.json",
    "node_modules/.prisma/client/index.js",
    "node_modules/.prisma/client/schema.prisma",
  ]
  const missing = required.filter((e) => !entrySet.has(e))
  check("2. el asar contiene main, preload, renderer y Prisma", missing.length === 0, `faltan: ${missing.join(", ")}`)

  // 3. Nada de código fuente, mapas, bases de datos ni .env
  const forbiddenPrefixes = ["backend/", "electron/", "renderer/", "scripts/", "src/", "dist/"]
  const forbidden = entries.filter((e) => {
    const base = path.posix.basename(e)
    return (
      forbiddenPrefixes.some((p) => e.startsWith(p)) ||
      e.endsWith(".map") ||
      (e.endsWith(".ts") && !e.endsWith(".d.ts")) ||
      e.endsWith(".db") ||
      e.endsWith(".db-journal") ||
      base.startsWith(".env")
    )
  })
  check("3. el asar no contiene código fuente, .map, bases de datos ni .env", forbidden.length === 0, forbidden.slice(0, 10).join(", "))

  // 4. Motor nativo de Prisma fuera del asar
  const engineDir = path.join(RES, "app.asar.unpacked", "node_modules", ".prisma", "client")
  const engine = fs.existsSync(engineDir) ? fs.readdirSync(engineDir).find((n) => /query_engine.*\.node$/.test(n)) : undefined
  check("4. motor de Prisma desempaquetado en app.asar.unpacked", Boolean(engine), `no se encontró en ${engineDir}`)

  // 5. Migraciones idénticas a las del repo
  const repoMigrations = migrationFolders(REPO_MIGRATIONS)
  const pkgMigrations = migrationFolders(path.join(RES, "migrations"))
  const sameNames = JSON.stringify(repoMigrations) === JSON.stringify(pkgMigrations)
  const differentHashes = sameNames
    ? repoMigrations.filter((name) => {
        const a = fs.readFileSync(path.join(REPO_MIGRATIONS, name, "migration.sql"))
        const b = fs.readFileSync(path.join(RES, "migrations", name, "migration.sql"))
        return sha256(a) !== sha256(b)
      })
    : []
  check(
    `5. resources/migrations idénticas al repo (${repoMigrations.length})`,
    sameNames && differentHashes.length === 0,
    sameNames ? `sha256 distinto: ${differentHashes.join(", ")}` : `repo=${repoMigrations.length} paquete=${pkgMigrations.length}`
  )

  // 6. package.json empaquetado
  const pkg = JSON.parse(asarText("package.json"))
  check(
    "6. package.json del asar: main y productName",
    pkg.main === ".vite/build/main.cjs" && pkg.productName === "Integral",
    `main=${pkg.main} productName=${pkg.productName}`
  )

  // 7. Bundle del main (el del disco: es el legible, antes de cualquier post-proceso del paquete)
  const mainBundlePath = path.join(ROOT, ".vite", "build", "main.cjs")
  const mainBundle = fs.existsSync(mainBundlePath) ? fs.readFileSync(mainBundlePath, "utf-8") : ""
  const engineEnvIndex = mainBundle.indexOf("PRISMA_QUERY_ENGINE_LIBRARY")
  const prismaClientIndex = mainBundle.indexOf("PrismaClient(")
  check("7a. main.cjs deja @prisma/client como external", /require\(["']@prisma\/client["']\)/.test(mainBundle))
  check("7b. main.cjs no contiene localhost:5173", mainBundle !== "" && !mainBundle.includes("localhost:5173"))
  check("7c. main.cjs bundlea electron-squirrel-startup", mainBundle !== "" && !/require\(["']electron-squirrel-startup["']\)/.test(mainBundle))
  check(
    "7d. setupEnv (PRISMA_QUERY_ENGINE_LIBRARY) corre antes del primer PrismaClient(",
    engineEnvIndex !== -1 && prismaClientIndex !== -1 && engineEnvIndex < prismaClientIndex,
    `PRISMA_QUERY_ENGINE_LIBRARY@${engineEnvIndex} PrismaClient(@${prismaClientIndex}`
  )

  // 8. El preload (sandbox) solo puede requerir electron
  const preloadModules = [...requiredModules(asarText(".vite/build/preload.cjs"))]
  check(
    "8. preload.cjs solo requiere electron",
    preloadModules.length === 1 && preloadModules[0] === "electron",
    `requires: ${JSON.stringify(preloadModules)}`
  )

  // 9. HTML del renderer con CSP y rutas relativas (file://)
  const html = asarText(".vite/renderer/main_window/index.html")
  check("9a. index.html con Content-Security-Policy", html.includes("Content-Security-Policy"))
  check(
    "9b. index.html sin rutas absolutas ni localhost",
    !html.includes('src="/') && !html.includes('href="/') && !html.includes("localhost")
  )

  // 10. Fuses escritos en el binario
  const wire = await getCurrentFuseWire(EXE)
  const expectedFuses = [
    ["RunAsNode", FuseState.DISABLE],
    ["EnableNodeOptionsEnvironmentVariable", FuseState.DISABLE],
    ["EnableNodeCliInspectArguments", FuseState.DISABLE],
    ["OnlyLoadAppFromAsar", FuseState.ENABLE],
    ["EnableEmbeddedAsarIntegrityValidation", FuseState.ENABLE],
    ["EnableCookieEncryption", FuseState.ENABLE],
  ]
  for (const [name, expected] of expectedFuses) {
    const actual = wire[FuseV1Options[name]]
    check(`10. fuse ${name} = ${expected === FuseState.ENABLE ? "ENABLE" : "DISABLE"}`, actual === expected, `actual=${actual}`)
  }

  // 12. Bytecode del main (Fase 11A)
  check(
    "12a. el asar contiene main.jsc y bytenode",
    entrySet.has(".vite/build/main.jsc") && entrySet.has("node_modules/bytenode/package.json")
  )
  const loader = asarBuffer(".vite/build/main.cjs")
  const loaderText = loader.toString("utf-8")
  check(
    "12b. main.cjs del asar es solo el cargador (< 500 bytes, require bytenode + ./main.jsc)",
    loader.length < 500 && loaderText.includes('require("bytenode")') && loaderText.includes("./main.jsc"),
    `tamaño=${loader.length}`
  )
  const jsc = entrySet.has(".vite/build/main.jsc") ? asarBuffer(".vite/build/main.jsc") : Buffer.alloc(0)
  check("12c. main.jsc mide más de 20 KB", jsc.length > 20 * 1024, `tamaño=${jsc.length}`)
  // El bytecode conserva nombres y textos sueltos, pero no el código con sus paréntesis.
  const witness = "setWindowOpenHandler("
  check(
    `12d. el bytecode no contiene código fuente (testigo "${witness}")`,
    mainBundle.includes(witness) && !jsc.toString("latin1").includes(witness),
    `en bundle legible=${mainBundle.includes(witness)} en main.jsc=${jsc.toString("latin1").includes(witness)}`
  )

  // 13. Ofuscación del renderer (Fase 11B)
  const assetsPrefix = ".vite/renderer/main_window/assets/"
  const assetEntries = entries.filter((e) => e.startsWith(assetsPrefix))
  const jsAssets = assetEntries.filter((e) => e.endsWith(".js"))
  const vendorChunks = jsAssets.filter((e) => path.posix.basename(e).startsWith("vendor-"))
  const appChunks = jsAssets.filter((e) => !path.posix.basename(e).startsWith("vendor-"))
  check(
    "13a. un chunk vendor-*.js y al menos un chunk de la app",
    vendorChunks.length === 1 && appChunks.length >= 1,
    `vendor=${vendorChunks.length} app=${appChunks.length}`
  )
  // Testigo: literal que existe una sola vez en renderer/src (Sells.tsx, kind: 'no-price')
  const notObfuscated = appChunks.filter((e) => {
    const code = asarText(e)
    return !code.includes("_0x") || code.includes("no-price")
  })
  check("13b. chunks de la app ofuscados (_0x… y sin el testigo \"no-price\")", notObfuscated.length === 0, notObfuscated.join(", "))
  check("13c. sin .map en los assets del renderer", !assetEntries.some((e) => e.endsWith(".map")))

  // 14. Licencia de uso (Fase 11C)
  const pkgLicense = path.join(RES, "LICENSE.txt")
  check(
    "14. resources/LICENSE.txt idéntico al LICENSE.txt del repo",
    fs.existsSync(pkgLicense) && sha256(fs.readFileSync(pkgLicense)) === sha256(fs.readFileSync(path.join(ROOT, "LICENSE.txt")))
  )

  // 11. Instalador de Squirrel (solo con --make)
  if (CHECK_MAKE) {
    const files = fs.existsSync(MAKE_DIR) ? fs.readdirSync(MAKE_DIR) : []
    check("11a. existe *Setup.exe", files.some((f) => f.endsWith("Setup.exe")), `en ${MAKE_DIR}: ${files.join(", ")}`)
    check("11b. existe RELEASES", files.includes("RELEASES"))
    check("11c. existe *-full.nupkg", files.some((f) => f.endsWith("-full.nupkg")))
  }

  console.log(failures === 0 ? "\nOK: el paquete pasó todos los chequeos." : `\n${failures} chequeo(s) fallaron.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
