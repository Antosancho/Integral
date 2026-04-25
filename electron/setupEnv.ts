import { app } from "electron"
import path from "path"

function resolveDbPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "integral.db")
  }
  return path.join(__dirname, "..", "..", "backend", "prisma", "dev.db")
}

if (!process.env.DATABASE_URL) {
  const dbPath = resolveDbPath().replace(/\\/g, "/")
  process.env.DATABASE_URL = `file:${dbPath}`
}
