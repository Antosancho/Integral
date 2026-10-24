/**
 * electron/setupEnv.ts
 *
 * Variables de entorno que Prisma necesita ANTES de que se cree cualquier
 * PrismaClient. Por eso es siempre el primer import de main.ts.
 *
 * - DATABASE_URL: en dev apunta a backend/prisma/dev.db; en la app empaquetada
 *   a <userData>/integral.db (%APPDATA%\Integral\integral.db). Se respeta un
 *   override por entorno solo si es una URL file: con ruta absoluta.
 * - PRISMA_QUERY_ENGINE_LIBRARY: en la app empaquetada, ruta del motor nativo
 *   de Prisma desempaquetado del asar (app.asar.unpacked).
 */

import { app } from "electron"
import path from "path"
import { findQueryEngineLibrary, needsDatabaseUrl } from "./runtimePaths"

function resolveDbPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "integral.db")
  }
  return path.join(__dirname, "..", "..", "backend", "prisma", "dev.db")
}

// Ojo: aunque este es el primer import de main.ts, en el bundle el require("@prisma/client")
// queda arriba y ya cargó el .env de la raíz (DATABASE_URL relativa). Ver needsDatabaseUrl.
if (needsDatabaseUrl(process.env.DATABASE_URL)) {
  const dbPath = resolveDbPath().replace(/\\/g, "/")
  process.env.DATABASE_URL = `file:${dbPath}`
}

// En la app empaquetada el motor de Prisma vive en app.asar.unpacked; se lo indicamos explícitamente.
if (app.isPackaged && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const engine = findQueryEngineLibrary(process.resourcesPath)
  if (engine) process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine
}
