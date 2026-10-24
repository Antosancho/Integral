/**
 * vite.renderer.config.mts
 *
 * Build del renderer (React) para Electron Forge: en `npm start` levanta el
 * dev server con HMR y en `package`/`make` genera
 * `.vite/renderer/main_window/`, que el main carga con `loadFile`.
 *
 * Solo en build (package/make): CSP de producción en el HTML y ofuscación de
 * los chunks de la app (el chunk "vendor" con React y librerías no se ofusca).
 *
 * `renderer/vite.config.ts` y `renderer/vitest.config.ts` NO se reemplazan:
 * siguen sirviendo para `npm run dev:renderer` y para Vitest.
 */

import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import JavaScriptObfuscator, { type ObfuscatorOptions } from "javascript-obfuscator"
import path from "node:path"

// .mts = ESM: no existe __dirname. Forge siempre corre desde la raíz vía scripts npm.
const ROOT = process.cwd()

// CSP solo en build: en dev el preámbulo inline de react-refresh y el websocket de HMR la violarían.
const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

/** Inyecta la Content-Security-Policy de producción como <meta> al principio del <head>. */
function cspPlugin(): Plugin {
  return {
    name: "integral-csp",
    apply: "build",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: PROD_CSP }, injectTo: "head-prepend" }]
    },
  }
}

// ---------------------------------------------------------------------------
// Protección del renderer: ofuscación (Fase 11B)
// ---------------------------------------------------------------------------

// Opciones moderadas: protegen sin castigar la velocidad de la caja.
// PROHIBIDO activar selfDefending, debugProtection, el bloqueo por dominio (domain lock) o cualquier opción que genere eval/new Function:
// la CSP de producción (script-src 'self') las bloquea → pantalla en blanco.
const OBFUSCATOR_OPTIONS: ObfuscatorOptions = {
  target: "browser-no-eval",
  compact: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ["base64"],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  transformObjectKeys: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  sourceMap: false,
}

/** Ofusca los chunks de la app al generar el bundle de producción (no corre en dev ni en Vitest). */
function obfuscatorPlugin(): Plugin {
  return {
    name: "integral-obfuscator",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      if (process.env.INTEGRAL_NO_OBFUSCATE === "1") {
        console.warn("[obfuscator] DESACTIVADO por INTEGRAL_NO_OBFUSCATE=1 (solo para depurar; verify:package va a fallar)")
        return
      }
      for (const chunk of Object.values(bundle)) {
        // Solo nuestro código: el chunk vendor (React y demás librerías) no se ofusca.
        if (chunk.type !== "chunk" || chunk.name === "vendor") continue
        chunk.code = JavaScriptObfuscator.obfuscate(chunk.code, OBFUSCATOR_OPTIONS).getObfuscatedCode()
      }
    },
  }
}

export default defineConfig({
  root: path.join(ROOT, "renderer"),
  plugins: [react(), cspPlugin(), obfuscatorPlugin()],
  build: {
    // Forge espera el renderer en .vite/renderer/<name>; como cambiamos root, lo fijamos en absoluto.
    outDir: path.join(ROOT, ".vite", "renderer", "main_window"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Librerías de node_modules en un chunk "vendor" aparte, que el ofuscador saltea.
        manualChunks(id) {
          return id.includes("node_modules") ? "vendor" : undefined
        },
      },
    },
  },
})
