/**
 * vite.preload.config.mts
 *
 * Build del preload (electron/preload.ts → .vite/build/preload.cjs).
 *
 * El preload corre con `sandbox: true`: solo puede hacer `require("electron")`.
 * Por eso `electron` es el único external y todo lo demás (ipcContract) se
 * bundlea adentro.
 */

import { defineConfig } from "vite"

export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: mode === "development",
    minify: mode === "production",
    rollupOptions: {
      external: ["electron"],
    },
  },
}))
