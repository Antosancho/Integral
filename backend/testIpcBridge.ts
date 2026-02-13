import prisma from "./db/client"
import { buildElectronApi } from "../electron/ipcContract"
import { buildIpcHandlers, invokeIpcHandler } from "../electron/ipcHandlers"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function logStep(step: string) {
  console.log(`PASS: ${step}`)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error("Expected object result")
  }
  return value as Record<string, unknown>
}

function asNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number") {
    throw new Error(`Expected numeric field ${fieldName}`)
  }
  return value
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected array result")
  }
  return value
}

async function main() {
  const handlers = buildIpcHandlers()
  const api = buildElectronApi((channel, payload) => invokeIpcHandler(handlers, channel, payload))

  const runId = Date.now()
  const categoryName = `IPC Category ${runId}`
  const supplierName = `IPC Supplier ${runId}`
  const productName = `IPC Product ${runId}`
  const updatedCategoryName = `IPC Category Updated ${runId}`
  const updatedSupplierName = `IPC Supplier Updated ${runId}`
  const updatedProductName = `IPC Product Updated ${runId}`

  const baseBarcode = BigInt(String(runId).slice(-9))
  const updatedBarcode = baseBarcode + 1n

  let categoryId: number | null = null
  let supplierId: number | null = null
  let productId: number | null = null

  try {
    const category = asRecord(await api.createCategory({ name: categoryName }))
    categoryId = asNumber(category.id, "id")
    assert(category.name === categoryName, "createCategory should persist name")
    logStep("IPC createCategory")

    const supplier = asRecord(
      await api.createSupplier({
        name: supplierName,
        phone: "123456",
        notes: "ipc test"
      })
    )
    supplierId = asNumber(supplier.id, "id")
    assert(supplier.name === supplierName, "createSupplier should persist name")
    logStep("IPC createSupplier")

    const categories = asArray(await api.listCategories())
    assert(
      categories.some((item) => asRecord(item).id === categoryId),
      "listCategories should include created category"
    )
    logStep("IPC listCategories")

    const suppliers = asArray(await api.listSuppliers())
    assert(
      suppliers.some((item) => asRecord(item).id === supplierId),
      "listSuppliers should include created supplier"
    )
    logStep("IPC listSuppliers")

    const categoryById = asRecord(await api.getCategoryById(categoryId))
    assert(categoryById.id === categoryId, "getCategoryById should return created category")
    logStep("IPC getCategoryById")

    const supplierById = asRecord(await api.getSupplierById(supplierId))
    assert(supplierById.id === supplierId, "getSupplierById should return created supplier")
    logStep("IPC getSupplierById")

    const updatedCategory = asRecord(await api.updateCategory(categoryId, { name: updatedCategoryName }))
    assert(updatedCategory.name === updatedCategoryName, "updateCategory should update name")
    logStep("IPC updateCategory")

    const updatedSupplier = asRecord(
      await api.updateSupplier(supplierId, {
        name: updatedSupplierName,
        phone: "999999",
        notes: "updated"
      })
    )
    assert(updatedSupplier.name === updatedSupplierName, "updateSupplier should update name")
    logStep("IPC updateSupplier")

    const product = asRecord(
      await api.createProduct({
        name: productName,
        purchasePrice: 100,
        salePrice: 150,
        categoryId,
        supplierId,
        barcode: baseBarcode,
        stock: 10,
        minStock: 2
      })
    )
    productId = asNumber(product.id, "id")
    assert(product.name === productName, "createProduct should persist name")
    logStep("IPC createProduct")

    const listedById = asArray(await api.listProducts({ id: productId }))
    assert(listedById.length === 1, "listProducts should filter by id")
    logStep("IPC listProducts by id")

    const listedByBarcode = asArray(await api.listProducts({ barcode: baseBarcode }))
    assert(listedByBarcode.length === 1, "listProducts should filter by barcode")
    logStep("IPC listProducts by barcode")

    const productById = asRecord(await api.getProductById(productId))
    assert(productById.id === productId, "getProductById should return created product")
    logStep("IPC getProductById")

    const productByBarcode = asRecord(await api.getProductByBarcode(baseBarcode))
    assert(productByBarcode.id === productId, "getProductByBarcode should return created product")
    logStep("IPC getProductByBarcode")

    const updatedProduct = asRecord(
      await api.updateProduct(productId, {
        name: updatedProductName,
        salePrice: 170,
        barcode: updatedBarcode,
        stock: 12,
        minStock: 3
      })
    )
    assert(updatedProduct.name === updatedProductName, "updateProduct should update name")
    logStep("IPC updateProduct")

    const absoluteStock = asRecord(await api.updateProductStock(productId, 30))
    assert(absoluteStock.stock === 30, "updateProductStock should set absolute stock")
    logStep("IPC updateProductStock")

    const deltaUp = asRecord(await api.changeProductStock(productId, 5))
    assert(deltaUp.stock === 35, "changeProductStock should apply positive delta")
    const deltaDown = asRecord(await api.changeProductStock(productId, -10))
    assert(deltaDown.stock === 25, "changeProductStock should apply negative delta")
    logStep("IPC changeProductStock")

    const movementIn = asRecord(
      await api.createStockMovement({
        productId,
        type: "IN",
        quantity: 5,
        notes: "restock"
      })
    )
    const movementInId = asNumber(movementIn.id, "id")
    logStep("IPC createStockMovement IN")

    const movementSale = asRecord(
      await api.createStockMovement({
        productId,
        type: "SALE",
        quantity: 4,
        notes: "sale"
      })
    )
    const movementSaleId = asNumber(movementSale.id, "id")
    logStep("IPC createStockMovement SALE")

    const movementAdjustment = asRecord(
      await api.createStockMovement({
        productId,
        type: "ADJUSTMENT",
        quantity: -3,
        notes: "inventory correction"
      })
    )
    const movementAdjustmentId = asNumber(movementAdjustment.id, "id")
    logStep("IPC createStockMovement ADJUSTMENT")

    const movementHistory = asArray(await api.listStockMovements({ productId }))
    assert(movementHistory.length >= 3, "listStockMovements should return created rows")
    logStep("IPC listStockMovements")

    const movementById = asRecord(await api.getStockMovementById(movementInId))
    assert(movementById.id === movementInId, "getStockMovementById should return movement")
    logStep("IPC getStockMovementById")

    await api.deleteStockMovement(movementSaleId, true)
    logStep("IPC deleteStockMovement with revert")

    await api.deleteStockMovement(movementInId)
    await api.deleteStockMovement(movementAdjustmentId)
    const remaining = asArray(await api.listStockMovements({ productId }))
    assert(remaining.length === 0, "deleteStockMovement should remove rows")
    logStep("IPC deleteStockMovement without revert")

    await api.deleteProduct(productId)
    productId = null
    logStep("IPC deleteProduct")

    await api.deleteCategory(categoryId)
    categoryId = null
    logStep("IPC deleteCategory")

    await api.deleteSupplier(supplierId)
    supplierId = null
    logStep("IPC deleteSupplier")

    let errorCaught = false
    try {
      await api.updateProduct(-999999, { name: "should fail" })
    } catch {
      errorCaught = true
    }
    assert(errorCaught, "invalid update should fail with controlled IPC error")
    logStep("IPC controlled error path")

    console.log("SUCCESS: all IPC bridge checks passed.")
  } finally {
    if (productId !== null) {
      await prisma.stockMovement.deleteMany({ where: { productId } })
      await prisma.product.deleteMany({ where: { id: productId } })
    }
    if (categoryId !== null) {
      await prisma.category.deleteMany({ where: { id: categoryId } })
    }
    if (supplierId !== null) {
      await prisma.supplier.deleteMany({ where: { id: supplierId } })
    }
  }
}

main()
  .catch((error) => {
    console.error("FAILED:", error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
