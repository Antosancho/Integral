import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

function loadEnv() {
  if (process.env.DATABASE_URL) return

  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env")
  ]

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8")
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const eq = trimmed.indexOf("=")
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        const rawValue = trimmed.slice(eq + 1).trim()
        const value = rawValue.replace(/^"(.*)"$/, "$1")
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
      break
    }
  }
}

loadEnv()

const prisma = new PrismaClient()

export default prisma
