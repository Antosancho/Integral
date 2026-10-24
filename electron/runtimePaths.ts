/**
 * electron/runtimePaths.ts
 *
 * Resolución de rutas que dependen de si la app corre empaquetada (instalador)
 * o en desarrollo (`npm start`).
 *
 * Son funciones **puras**: no importan `electron` (reciben `app.isPackaged`,
 * `process.resourcesPath` y `__dirname` como parámetros), así se pueden
 * testear con ts-node en `backend/__tests__/runtime-paths.test.ts`.
 */

import fs from "fs"
import path from "path"

/**
 * Dónde está corriendo la app.
 * - `isPackaged`: `app.isPackaged`.
 * - `resourcesPath`: `process.resourcesPath` (carpeta `resources/` del paquete).
 * - `dirname`: `__dirname` del main bundleado (en dev = `<repo>/.vite/build`).
 */
export type RuntimeLocation = { isPackaged: boolean; resourcesPath: string; dirname: string }

/**
 * true si setupEnv tiene que calcular DATABASE_URL: no está definida, o es una
 * URL `file:` con ruta relativa. Una URL `file:` absoluta (override explícito,
 * por ejemplo la del smoke test) o de otro tipo se respeta tal cual.
 *
 * Por qué se ignoran las relativas: `require("@prisma/client")` carga el `.env`
 * de la raíz en el momento del require, y Rollup hoistea los `require` de los
 * externals al principio de main.cjs, ANTES del código de setupEnv. En dev,
 * DATABASE_URL llega entonces como `file:./dev.db` (relativa a backend/prisma/),
 * que es el mismo archivo que calcula setupEnv (lo verifica test:db-path-config).
 * Reemplazarla por la absoluta no cambia de base, y el migrador no acepta relativas.
 */
export function needsDatabaseUrl(current: string | undefined): boolean {
  if (!current) return true
  if (!current.startsWith("file:")) return false
  const filePath = current.slice("file:".length).split("?")[0]
  return !path.isAbsolute(filePath)
}

/** Carpeta de migration.sql: en prod viaja como extraResource; en dev es la del repo. */
export function resolveMigrationsDir(loc: RuntimeLocation): string {
  return loc.isPackaged
    ? path.join(loc.resourcesPath, "migrations")
    // dirname en dev = <repo>/.vite/build → sube 2 niveles hasta la raíz
    : path.join(loc.dirname, "..", "..", "backend", "prisma", "migrations")
}

/** Texto de la licencia de uso: en prod viaja como extraResource; en dev es el LICENSE.txt de la raíz. */
export function resolveLicenseFile(loc: RuntimeLocation): string {
  return loc.isPackaged
    ? path.join(loc.resourcesPath, "LICENSE.txt")
    : path.join(loc.dirname, "..", "..", "LICENSE.txt")
}

/** Ruta del motor de Prisma desempaquetado del asar, o null si no está. */
export function findQueryEngineLibrary(resourcesPath: string): string | null {
  const dir = path.join(resourcesPath, "app.asar.unpacked", "node_modules", ".prisma", "client")
  if (!fs.existsSync(dir)) return null
  const file = fs.readdirSync(dir).find((name) => /query_engine.*\.node$/.test(name))
  return file ? path.join(dir, file) : null
}
