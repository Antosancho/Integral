import fs from "fs"
import path from "path"

const repoRoot = path.resolve(__dirname, "..", "..")
const schemaDir = path.join(repoRoot, "backend", "prisma")

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizePath(value: string): string {
  return path.resolve(value).replace(/\\/g, "/").toLowerCase()
}

function readRootDatabaseUrl(): string {
  const envPath = path.join(repoRoot, ".env")
  const envContent = fs.readFileSync(envPath, "utf-8")
  const databaseUrlLine = envContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("DATABASE_URL="))

  assert(databaseUrlLine, ".env must define DATABASE_URL")

  return databaseUrlLine
    .slice("DATABASE_URL=".length)
    .trim()
    .replace(/^"(.*)"$/, "$1")
}

function resolvePrismaSqliteUrl(databaseUrl: string): string {
  assert(databaseUrl.startsWith("file:"), `DATABASE_URL must be a SQLite file URL, got ${databaseUrl}`)

  const filePath = databaseUrl.slice("file:".length)
  // Prisma resolves relative SQLite URLs from the schema directory, not from process.cwd().
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(schemaDir, filePath)
}

function resolveElectronDevDbPath(): string {
  const setupEnvPath = path.join(repoRoot, "electron", "setupEnv.ts")
  const setupEnvSource = fs.readFileSync(setupEnvPath, "utf-8")
  const joinCall = setupEnvSource.match(/return\s+path\.join\(([^)]*"dev\.db"[^)]*)\)/)

  assert(joinCall, "electron/setupEnv.ts must build the development DB path with path.join(..., \"dev.db\")")

  const args = Array.from(joinCall[1].matchAll(/__dirname|"([^"]+)"/g)).map((match) => (
    match[0] === "__dirname" ? "__dirname" : match[1]
  ))
  assert(args[0] === "__dirname", "electron/setupEnv.ts DB path must start from __dirname")

  // setupEnv.ts is compiled to dist/electron/setupEnv.js; runtime __dirname points there.
  const runtimeDirname = path.join(repoRoot, "dist", "electron")
  const pathSegments = args.slice(1)

  return path.join(runtimeDirname, ...pathSegments)
}

function main() {
  const prismaDbPath = normalizePath(resolvePrismaSqliteUrl(readRootDatabaseUrl()))
  const electronDbPath = normalizePath(resolveElectronDevDbPath())

  assert(
    prismaDbPath === electronDbPath,
    [
      "DATABASE_URL and Electron runtime DB path must resolve to the same file.",
      `Prisma CLI path: ${prismaDbPath}`,
      `Electron path: ${electronDbPath}`,
      "Use DATABASE_URL=\"file:./dev.db\" in the root .env for this project."
    ].join("\n")
  )

  console.log(`PASS: Prisma CLI and Electron use ${prismaDbPath}`)
}

main()
