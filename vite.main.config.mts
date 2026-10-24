/**
 * vite.main.config.mts
 *
 * Build del main process de Electron (electron/main.ts → .vite/build/main.cjs).
 * El plugin de Vite de Electron Forge completa el resto (formato CJS, entry,
 * outDir y las globals MAIN_WINDOW_VITE_*).
 *
 * Todo lo que importa el main (backend/, repositorios, migrador,
 * electron-squirrel-startup) se bundlea en un único archivo minificado en
 * producción: dentro del paquete no viaja código fuente ni carpetas backend/.
 */

import { defineConfig } from "vite"
import { builtinModules } from "node:module"

// Prisma NO se bundlea: tiene un motor nativo (.node). Lo copia el hook packageAfterPrune de forge.config.mts.
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: mode === "development",
    minify: mode === "production",
    rollupOptions: {
      external: [
        "electron",
        /^@prisma\/client(\/.*)?$/,
        /^\.prisma\//,
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
}))
