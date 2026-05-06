import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

const repoRoot = path.resolve(__dirname, "..", "..")
const schemaPath = path.join(repoRoot, "backend", "prisma", "schema.prisma")
const schemaDir = path.dirname(schemaPath)
const scalarTypes = new Set(["String", "Int", "BigInt", "Decimal", "DateTime", "Boolean", "Float", "Bytes", "Json"])

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function readDatabaseUrl(): string {
  const envContent = fs.readFileSync(path.join(repoRoot, ".env"), "utf-8")
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
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(schemaDir, filePath)

  return `file:${absolutePath.replace(/\\/g, "/")}`
}

function getStockMovementScalarFields(): string[] {
  const schema = fs.readFileSync(schemaPath, "utf-8")
  const block = schema.match(/model\s+StockMovement\s+\{([\s\S]*?)\n\}/)

  assert(block, "schema.prisma must contain model StockMovement")

  return block[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
    .flatMap((line) => {
      const match = line.match(/^(\w+)\s+([A-Za-z][A-Za-z0-9]*)(?:\?)?/)
      if (!match || !scalarTypes.has(match[2])) return []
      return [match[1]]
    })
}

async function main() {
  const databaseUrl = resolvePrismaSqliteUrl(readDatabaseUrl())
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

  try {
    const tableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(StockMovement)")
    const dbColumns = new Set(tableInfo.map((column) => column.name))
    const schemaColumns = getStockMovementScalarFields()
    const missingColumns = schemaColumns.filter((column) => !dbColumns.has(column))

    assert(
      missingColumns.length === 0,
      [
        "StockMovement columns declared in schema.prisma are missing from the configured DB.",
        `DATABASE_URL resolves to: ${databaseUrl}`,
        `Missing columns: ${missingColumns.join(", ")}`
      ].join("\n")
    )

    console.log(`PASS: StockMovement schema columns exist in ${databaseUrl}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
