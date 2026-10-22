/**
 * backend/__tests__/saleService-create.test.ts
 *
 * Test de regresión de createSale: crea la venta, sus ítems, sus pagos y el
 * StockMovement SALE, y descuenta el stock (sin error P2022 de columnas).
 *
 * Usa una DB temporal creada **vacía** desde las migraciones
 * (helpers/testDb.ts); nunca lee ni copia dev.db.
 */

import type { PrismaClient } from "@prisma/client"
import { createMigratedTestDb } from "./helpers/testDb"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  // La DB se crea antes de los require(): saleService importa el Prisma client
  // singleton, que lee DATABASE_URL al cargarse. Por eso los require son tardíos.
  const testDb = createMigratedTestDb("saleService-create")
  process.env.DATABASE_URL = testDb.databaseUrl

  const { createSale } = require("../services/saleService") as typeof import("../services/saleService")
  const prisma = (require("../db/client") as { default: PrismaClient }).default

  try {
    // La DB temporal se crea vacía desde las migraciones, así que el escenario
    // es determinístico sin necesidad de limpiar tablas antes.

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
    // Desconectar antes de borrar: en Windows el archivo abierto da EBUSY.
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
