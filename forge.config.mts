/**
 * forge.config.mts
 *
 * Configuración de Electron Forge v8 para empaquetar Integral en Windows.
 *
 * - `npm start`        → electron-forge start (dev server + HMR)
 * - `npm run package`  → out/Integral-win32-x64/ (app sin instalador)
 * - `npm run make`     → out/make/squirrel.windows/x64/ (Setup.exe por usuario)
 *
 * Piezas clave:
 * - Plugin de Vite: bundlea main y preload a `.vite/build/` y el renderer a
 *   `.vite/renderer/main_window/`. Solo la carpeta `.vite/` entra al paquete.
 * - Prisma es un "runtime external" (tiene un motor nativo `.node` que no se
 *   puede bundlear): el hook `packageAfterPrune` lo copia al paquete y
 *   `asar.unpack` deja el `.node` fuera del asar.
 * - Las migraciones viajan como `resources/migrations` (las aplica
 *   backend/db/migrator.ts al iniciar la app) y la licencia de uso como
 *   `resources/LICENSE.txt`.
 * - El main se compila a bytecode de V8 (main.jsc, bytenode) dentro del
 *   paquete; `npm start` no usa bytecode. El renderer se ofusca en
 *   vite.renderer.config.mts.
 * - Fuses de Electron endurecidos (sin RunAsNode, sin NODE_OPTIONS, etc.).
 */

import type { ForgeConfig } from "@electron-forge/shared-types"
import { MakerSquirrel } from "@electron-forge/maker-squirrel"
import { VitePlugin } from "@electron-forge/plugin-vite"
import { FusesPlugin } from "@electron-forge/plugin-fuses"
import { FuseV1Options, FuseVersion } from "@electron/fuses"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

// .mts = ESM: no hay __dirname. Las rutas se resuelven desde la raíz del repo.
const ROOT = process.cwd()
if (!fs.existsSync(path.join(ROOT, "forge.config.mts"))) {
  throw new Error("Ejecutar electron-forge desde la raíz del proyecto")
}

// require() resuelto desde la raíz del repo (para leer la versión y la ruta de Electron instalado).
const requireFromRoot = createRequire(path.join(ROOT, "package.json"))

const ICON_BASE = path.join(ROOT, "assets", "icons", "icon") // sin extensión (packager agrega .ico)
const ICON_ICO = `${ICON_BASE}.ico`
const hasIcon = fs.existsSync(ICON_ICO)

// Firma opcional: solo si el entorno define el certificado. Nunca commitear certificados ni contraseñas.
const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD

// OBLIGATORIO: módulos que NO se bundlean y se copian tal cual al paquete.
const RUNTIME_EXTERNALS = [
  path.join("node_modules", "@prisma", "client"),
  path.join("node_modules", ".prisma", "client"),
  path.join("node_modules", "bytenode"), // carga main.jsc en runtime (Fase 11A)
]

// ---------------------------------------------------------------------------
// Protección del main: bytecode de V8 (bytenode)
// ---------------------------------------------------------------------------

/** Reemplaza a main.cjs dentro del paquete: solo carga el bytecode. */
const BYTECODE_LOADER = [
  '"use strict"',
  "// Cargador: el código real del main está compilado a bytecode de V8 en main.jsc",
  'require("bytenode")',
  'require("./main.jsc")',
  "",
].join("\n")

/**
 * Compila `.vite/build/main.cjs` de la copia empaquetada (`buildPath`) a
 * `main.jsc` y deja en su lugar el cargador de 3 líneas.
 *
 * El bytecode solo sirve para la versión exacta de V8: por eso se compila con
 * el MISMO Electron que se empaqueta, en modo Node (ELECTRON_RUN_AS_NODE=1;
 * el electron.exe de node_modules no tiene fuses). No se puede cross-compilar.
 */
function compileMainToBytecode(buildPath: string, electronVersion: string, platform: string, arch: string) {
  if (process.env.INTEGRAL_NO_BYTECODE === "1") {
    console.warn("[bytecode] DESACTIVADO por INTEGRAL_NO_BYTECODE=1 (solo para depurar; verify:package va a fallar)")
    return
  }
  const installed = requireFromRoot("electron/package.json").version as string
  if (installed !== electronVersion) throw new Error(`[bytecode] Electron instalado ${installed} ≠ empaquetado ${electronVersion}`)
  // Desde Electron 42 (V8 ≥ 14.8) el bytecode compilado con ELECTRON_RUN_AS_NODE aborta el main process
  // al cargarse (ver scripts/bytecode/compile-main.cjs). Mejor fallar acá que distribuir una app rota.
  if (Number(electronVersion.split(".")[0]) >= 42) {
    throw new Error(
      `[bytecode] Electron ${electronVersion}: hay que compilar con bytenode.compileFile({ electronMain: true }) ` +
        "en lugar de ELECTRON_RUN_AS_NODE. Actualizá scripts/bytecode/compile-main.cjs antes de empaquetar."
    )
  }
  if (platform !== process.platform || arch !== process.arch) {
    throw new Error(`[bytecode] Solo se puede compilar para el SO/arquitectura del host (${process.platform}/${process.arch}); se pidió ${platform}/${arch}`)
  }
  const electronExe = requireFromRoot("electron") as string // desde Node, require("electron") devuelve la ruta del ejecutable
  const input = path.join(buildPath, ".vite", "build", "main.cjs")
  const output = path.join(buildPath, ".vite", "build", "main.jsc")
  const result = spawnSync(electronExe, [path.join(ROOT, "scripts", "bytecode", "compile-main.cjs"), input, output], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  })
  if (result.status !== 0 || !fs.existsSync(output)) throw new Error(`[bytecode] Falló la compilación (status ${result.status})`)
  fs.writeFileSync(input, BYTECODE_LOADER)
  console.log(`[bytecode] main.cjs compilado a main.jsc (Electron ${electronVersion}, ${platform}/${arch})`)
}

/** Filtro de copia de los externals: todo salvo fuentes TypeScript (`.ts` que no sean `.d.ts`). */
function isRuntimeFile(src: string): boolean {
  return !(src.endsWith(".ts") && !src.endsWith(".d.ts"))
}

const config: ForgeConfig = {
  packagerConfig: {
    name: "Integral",
    executableName: "Integral",
    asar: { unpack: "*.node" },                                        // OBLIGATORIO: el motor de Prisma no carga desde dentro del asar
    extraResource: [
      path.join(ROOT, "backend", "prisma", "migrations"), // OBLIGATORIO: → resources/migrations
      path.join(ROOT, "LICENSE.txt"),                      // licencia de uso → resources/LICENSE.txt (Fase 11C)
    ],
    ...(hasIcon ? { icon: ICON_BASE } : {}),
    win32metadata: {
      CompanyName: "Antosancho",
      FileDescription: "Integral - Gestión de stock y ventas",
      ProductName: "Integral",
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "Integral",
      authors: "Antosancho",
      description: "Gestión de stock y ventas",
      noMsi: true,
      ...(hasIcon ? { setupIcon: ICON_ICO } : {}),
      ...(certificateFile ? { certificateFile, certificatePassword } : {}),
    }),
  ],
  hooks: {
    // OBLIGATORIO: copiar Prisma después del prune (si se copia antes, el pruner borra .prisma/).
    // Después de copiar los externals, el main se compila a bytecode (Fase 11A).
    packageAfterPrune: async (_forgeConfig, buildPath, electronVersion, platform, arch) => {
      for (const rel of RUNTIME_EXTERNALS) {
        const src = path.join(ROOT, rel)
        const dst = path.join(buildPath, rel)
        if (!fs.existsSync(src)) {
          throw new Error(`Falta ${rel}. Corré "npm install" (genera el cliente de Prisma).`)
        }
        // Se omiten los .ts que no son declaraciones (ej. @prisma/client/scripts/default-deno-edge.ts,
        // solo para Deno): no se usan en runtime y el paquete no debe llevar fuentes TypeScript.
        fs.cpSync(src, dst, { recursive: true, dereference: true, filter: isRuntimeFile })
      }
      compileMainToBytecode(buildPath, electronVersion, platform, arch)
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        { entry: "electron/main.ts", config: "vite.main.config.mts", target: "main" },
        { entry: "electron/preload.ts", config: "vite.preload.config.mts", target: "preload" },
      ],
      renderer: [{ name: "main_window", config: "vite.renderer.config.mts" }],
    }),
    // Fuses: se escriben en el binario empaquetado (no afectan a `npm start`).
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
