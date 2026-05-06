import fs from "fs"
import path from "path"
import type { PrismaClient } from "@prisma/client"

const repoRoot = path.resolve(__dirname, "..", "..")
const schemaDir = path.join(repoRoot, "backend", "prisma")
const testDbPath = path.join(repoRoot, "backend", "prisma", `test-saleService-create.${process.pid}.${Date.now()}.db`)
const testDatabaseUrl = `file:${testDbPath.replace(/\\/g, "/")}`

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function removeTestDbFiles() {
  for (const candidate of [testDbPath, `${testDbPath}-journal`]) {
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate, { force: true })
    }
  }
}

function readConfiguredDatabasePath(): string {
  const envContent = fs.readFileSync(path.join(repoRoot, ".env"), "utf-8")
  const databaseUrlLine = envContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("DATABASE_URL="))

  assert(databaseUrlLine, ".env must define DATABASE_URL")

  const databaseUrl = databaseUrlLine
    .slice("DATABASE_URL=".length)
    .trim()
    .replace(/^"(.*)"$/, "$1")

  assert(databaseUrl.startsWith("file:"), `DATABASE_URL must be a SQLite file URL, got ${databaseUrl}`)

  const filePath = databaseUrl.slice("file:".length)
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(schemaDir, filePath)
}

function prepareTestDb() {
  // The sale service imports a singleton Prisma client, so the isolated DATABASE_URL
  // must be set before requiring backend/db/client or backend/services/saleService.
  const canonicalDbPath = readConfiguredDatabasePath()

  assert(fs.existsSync(canonicalDbPath), `Configured DB does not exist: ${canonicalDbPath}`)
  fs.copyFileSync(canonicalDbPath, testDbPath)
  process.env.DATABASE_URL = testDatabaseUrl
}

async function main() {
  removeTestDbFiles()
  prepareTestDb()

  const { createSale } = require("../services/saleService") as typeof import("../services/saleService")
  const prisma = (require("../db/client") as { default: PrismaClient }).default

  try {
    // The temp DB starts as a copy of the real dev DB so the schema matches migrations.
    // Clean business tables to keep the regression scenario deterministic and isolated.
    await prisma.stockMovement.deleteMany()
    await prisma.salePayment.deleteMany()
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await prisma.supplier.deleteMany()

    const category = await prisma.category.create({ data: { name: "Sale regression category" } })
    const supplier = await prisma.supplier.create({ data: { name: "Sale regression supplier" } })
    const product = await prisma.product.create({
      data: {
        name: "Sale regression product",
        purchasePrice: "60",
        salePrice: "100",
        stock: 5,
        minStock: 0,
        categoryId: category.id,
        supplierId: supplier.id
      }
    })

    await createSale({
      items: [{ productId: product.id, quantity: 1, unitPrice: "100" }],
      payments: [{ method: "CASH", amount: "100" }],
      total: "100"
    })

    const sale = await prisma.sale.findFirst({
      include: { items: true, payments: true, movements: true }
    })
    assert(sale, "createSale should create a Sale")
    assert(sale.items.length === 1, `createSale should create one SaleItem, got ${sale.items.length}`)
    assert(sale.payments.length === 1, `createSale should create one SalePayment, got ${sale.payments.length}`)
    assert(sale.payments[0].method === "CASH", `SalePayment.method should be CASH, got ${sale.payments[0].method}`)

    const movement = await prisma.stockMovement.findFirst({ where: { saleId: sale.id } })
    assert(movement, "createSale should create a SALE StockMovement linked to the sale")
    assert(movement.type === "SALE", `StockMovement.type should be SALE, got ${movement.type}`)
    assert(movement.quantity === 1, `StockMovement.quantity should be 1, got ${movement.quantity}`)
    assert(movement.appliedDelta === -1, `StockMovement.appliedDelta should be -1, got ${movement.appliedDelta}`)
    assert(movement.expiryDate === null, "SALE StockMovement.expiryDate should default to null")
    assert(movement.expiryDismissedAt === null, "SALE StockMovement.expiryDismissedAt should default to null")

    const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } })
    assert(updatedProduct?.stock === 4, `createSale should decrement product stock from 5 to 4, got ${updatedProduct?.stock}`)

    console.log("PASS: createSale creates sale rows and SALE stock movement without P2022")
  } finally {
    await prisma.$disconnect()
    removeTestDbFiles()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
