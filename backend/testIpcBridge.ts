// Guard: este script siembra y modifica datos en la DB real.
// Para correrlo hay que definir ALLOW_INTEGRATION_TESTS=1 explícitamente.
// El script npm run test:ipc-bridge ya lo hace; no correr a mano sobre dev.db.
if (!process.env.ALLOW_INTEGRATION_TESTS) {
  console.error(
    "Este script siembra datos en la DB. Definí ALLOW_INTEGRATION_TESTS=1 para correrlo."
  )
  process.exit(1)
}

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

function assertCloneable(value: unknown, step: string) {
  try {
    structuredClone(value)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${step} returned non-cloneable payload: ${message}`)
  }
}

function assertProductPriceStrings(value: Record<string, unknown>, step: string) {
  assert(typeof value.purchasePrice === "string", `${step} purchasePrice should be string`)
  assert(typeof value.salePrice === "string", `${step} salePrice should be string`)
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
    const categoryResult = await api.createCategory({ name: categoryName })
    assertCloneable(categoryResult, "createCategory")
    const category = asRecord(categoryResult)
    categoryId = asNumber(category.id, "id")
    assert(category.name === categoryName, "createCategory should persist name")
    logStep("IPC createCategory")

    const supplierResult = await api.createSupplier({
      name: supplierName,
      phone: "123456",
      notes: "ipc test"
    })
    assertCloneable(supplierResult, "createSupplier")
    const supplier = asRecord(supplierResult)
    supplierId = asNumber(supplier.id, "id")
    assert(supplier.name === supplierName, "createSupplier should persist name")
    logStep("IPC createSupplier")

    const categoriesResult = await api.listCategories()
    assertCloneable(categoriesResult, "listCategories")
    const categories = asArray(categoriesResult)
    assert(
      categories.some((item) => asRecord(item).id === categoryId),
      "listCategories should include created category"
    )
    logStep("IPC listCategories")

    const suppliersResult = await api.listSuppliers()
    assertCloneable(suppliersResult, "listSuppliers")
    const suppliers = asArray(suppliersResult)
    assert(
      suppliers.some((item) => asRecord(item).id === supplierId),
      "listSuppliers should include created supplier"
    )
    logStep("IPC listSuppliers")

    const categoryByIdResult = await api.getCategoryById(categoryId)
    assertCloneable(categoryByIdResult, "getCategoryById")
    const categoryById = asRecord(categoryByIdResult)
    assert(categoryById.id === categoryId, "getCategoryById should return created category")
    logStep("IPC getCategoryById")

    const supplierByIdResult = await api.getSupplierById(supplierId)
    assertCloneable(supplierByIdResult, "getSupplierById")
    const supplierById = asRecord(supplierByIdResult)
    assert(supplierById.id === supplierId, "getSupplierById should return created supplier")
    logStep("IPC getSupplierById")

    const updatedCategoryResult = await api.updateCategory(categoryId, { name: updatedCategoryName })
    assertCloneable(updatedCategoryResult, "updateCategory")
    const updatedCategory = asRecord(updatedCategoryResult)
    assert(updatedCategory.name === updatedCategoryName, "updateCategory should update name")
    logStep("IPC updateCategory")

    const updatedSupplierResult = await api.updateSupplier(supplierId, {
      name: updatedSupplierName,
      phone: "999999",
      notes: "updated"
    })
    assertCloneable(updatedSupplierResult, "updateSupplier")
    const updatedSupplier = asRecord(updatedSupplierResult)
    assert(updatedSupplier.name === updatedSupplierName, "updateSupplier should update name")
    logStep("IPC updateSupplier")

    const productResult = await api.createProduct({
      name: productName,
      purchasePrice: 100,
      salePrice: 150,
      categoryId,
      supplierId,
      barcode: baseBarcode,
      stock: 10,
      minStock: 2
    })
    assertCloneable(productResult, "createProduct")
    const product = asRecord(productResult)
    assertProductPriceStrings(product, "createProduct")
    productId = asNumber(product.id, "id")
    assert(product.name === productName, "createProduct should persist name")
    logStep("IPC createProduct")

    const listedByIdResult = await api.listProducts({ id: productId })
    assertCloneable(listedByIdResult, "listProducts by id")
    const listedById = asArray(listedByIdResult)
    assert(listedById.length === 1, "listProducts should filter by id")
    assertProductPriceStrings(asRecord(listedById[0]), "listProducts by id")
    logStep("IPC listProducts by id")

    const listedByBarcodeResult = await api.listProducts({ barcode: baseBarcode })
    assertCloneable(listedByBarcodeResult, "listProducts by barcode")
    const listedByBarcode = asArray(listedByBarcodeResult)
    assert(listedByBarcode.length === 1, "listProducts should filter by barcode")
    assertProductPriceStrings(asRecord(listedByBarcode[0]), "listProducts by barcode")
    logStep("IPC listProducts by barcode")

    const productByIdResult = await api.getProductById(productId)
    assertCloneable(productByIdResult, "getProductById")
    const productById = asRecord(productByIdResult)
    assertProductPriceStrings(productById, "getProductById")
    assert(productById.id === productId, "getProductById should return created product")
    logStep("IPC getProductById")

    const productByBarcodeResult = await api.getProductByBarcode(baseBarcode)
    assertCloneable(productByBarcodeResult, "getProductByBarcode")
    const productByBarcode = asRecord(productByBarcodeResult)
    assertProductPriceStrings(productByBarcode, "getProductByBarcode")
    assert(productByBarcode.id === productId, "getProductByBarcode should return created product")
    logStep("IPC getProductByBarcode")

    const updatedProductResult = await api.updateProduct(productId, {
      name: updatedProductName,
      salePrice: 170,
      barcode: updatedBarcode,
      stock: 12,
      minStock: 3
    })
    assertCloneable(updatedProductResult, "updateProduct")
    const updatedProduct = asRecord(updatedProductResult)
    assertProductPriceStrings(updatedProduct, "updateProduct")
    assert(updatedProduct.name === updatedProductName, "updateProduct should update name")
    logStep("IPC updateProduct")

    const absoluteStockResult = await api.updateProductStock(productId, 30)
    assertCloneable(absoluteStockResult, "updateProductStock")
    const absoluteStock = asRecord(absoluteStockResult)
    assertProductPriceStrings(absoluteStock, "updateProductStock")
    assert(absoluteStock.stock === 30, "updateProductStock should set absolute stock")
    logStep("IPC updateProductStock")

    const deltaUpResult = await api.changeProductStock(productId, 5)
    assertCloneable(deltaUpResult, "changeProductStock positive")
    const deltaUp = asRecord(deltaUpResult)
    assertProductPriceStrings(deltaUp, "changeProductStock positive")
    assert(deltaUp.stock === 35, "changeProductStock should apply positive delta")
    const deltaDownResult = await api.changeProductStock(productId, -10)
    assertCloneable(deltaDownResult, "changeProductStock negative")
    const deltaDown = asRecord(deltaDownResult)
    assertProductPriceStrings(deltaDown, "changeProductStock negative")
    assert(deltaDown.stock === 25, "changeProductStock should apply negative delta")
    logStep("IPC changeProductStock")

    // createProduct con stock>0 genera un StockMovement IN inicial ("Lote inicial al crear producto").
    // Se limpia antes de los tests de StockMovement CRUD para no contaminar la cuenta final.
    await prisma.stockMovement.deleteMany({ where: { productId } })

    const movementInResult = await api.createStockMovement({
      productId,
      type: "IN",
      quantity: 5,
      notes: "restock"
    })
    assertCloneable(movementInResult, "createStockMovement IN")
    const movementIn = asRecord(movementInResult)
    assertProductPriceStrings(asRecord(movementIn.product), "createStockMovement IN nested product")
    const movementInId = asNumber(movementIn.id, "id")
    logStep("IPC createStockMovement IN")

    const movementSaleResult = await api.createStockMovement({
      productId,
      type: "SALE",
      quantity: 4,
      notes: "sale"
    })
    assertCloneable(movementSaleResult, "createStockMovement SALE")
    const movementSale = asRecord(movementSaleResult)
    assertProductPriceStrings(asRecord(movementSale.product), "createStockMovement SALE nested product")
    const movementSaleId = asNumber(movementSale.id, "id")
    logStep("IPC createStockMovement SALE")

    const movementAdjustmentResult = await api.createStockMovement({
      productId,
      type: "ADJUSTMENT",
      quantity: -3,
      notes: "inventory correction"
    })
    assertCloneable(movementAdjustmentResult, "createStockMovement ADJUSTMENT")
    const movementAdjustment = asRecord(movementAdjustmentResult)
    assertProductPriceStrings(
      asRecord(movementAdjustment.product),
      "createStockMovement ADJUSTMENT nested product"
    )
    const movementAdjustmentId = asNumber(movementAdjustment.id, "id")
    logStep("IPC createStockMovement ADJUSTMENT")

    const movementHistoryResult = await api.listStockMovements({ productId })
    assertCloneable(movementHistoryResult, "listStockMovements")
    const movementHistory = asArray(movementHistoryResult)
    assert(movementHistory.length >= 3, "listStockMovements should return created rows")
    assertProductPriceStrings(
      asRecord(asRecord(movementHistory[0]).product),
      "listStockMovements nested product"
    )
    logStep("IPC listStockMovements")

    const movementByIdResult = await api.getStockMovementById(movementInId)
    assertCloneable(movementByIdResult, "getStockMovementById")
    const movementById = asRecord(movementByIdResult)
    assertProductPriceStrings(asRecord(movementById.product), "getStockMovementById nested product")
    assert(movementById.id === movementInId, "getStockMovementById should return movement")
    logStep("IPC getStockMovementById")

    const deleteSaleResult = await api.deleteStockMovement(movementSaleId, true)
    assertCloneable(deleteSaleResult, "deleteStockMovement with revert")
    logStep("IPC deleteStockMovement with revert")

    const deleteInResult = await api.deleteStockMovement(movementInId)
    assertCloneable(deleteInResult, "deleteStockMovement movementIn")
    const deleteAdjustmentResult = await api.deleteStockMovement(movementAdjustmentId)
    assertCloneable(deleteAdjustmentResult, "deleteStockMovement movementAdjustment")
    const remainingResult = await api.listStockMovements({ productId })
    assertCloneable(remainingResult, "listStockMovements after delete")
    const remaining = asArray(remainingResult)
    assert(remaining.length === 0, "deleteStockMovement should remove rows")
    logStep("IPC deleteStockMovement without revert")

    // --- Paso 13: ADJUSTMENT fija stock correctamente ---
    await api.updateProductStock(productId, 10)
    const adj13Result = await api.createStockMovement({ productId, type: "ADJUSTMENT", quantity: 15 })
    assertCloneable(adj13Result, "createStockMovement ADJUSTMENT fix")
    const adj13 = asRecord(adj13Result)
    const adj13Product = asRecord(adj13.product)
    assert(adj13Product.stock === 15, `ADJUSTMENT should set stock to 15, got ${adj13Product.stock}`)
    assert(adj13.quantity === 15, "ADJUSTMENT should store quantity=15")
    assert(adj13.appliedDelta === 5, `ADJUSTMENT should store appliedDelta=5, got ${adj13.appliedDelta}`)
    logStep("ADJUSTMENT fija stock correctamente")

    // --- Paso 14: revert de ADJUSTMENT vuelve al stock anterior ---
    const adj13Id = asNumber(adj13.id, "id")
    await api.deleteStockMovement(adj13Id, true)
    const afterRevertResult = await api.getProductById(productId)
    const afterRevert = asRecord(afterRevertResult)
    assert(afterRevert.stock === 10, `revert ADJUSTMENT should restore stock to 10, got ${afterRevert.stock}`)
    logStep("revert de ADJUSTMENT restaura stock")

    // --- Paso 15: ADJUSTMENT a valor negativo ---
    await api.updateProductStock(productId, 3)
    const adj15Result = await api.createStockMovement({ productId, type: "ADJUSTMENT", quantity: -2 })
    assertCloneable(adj15Result, "createStockMovement ADJUSTMENT negative")
    const adj15 = asRecord(adj15Result)
    const adj15Product = asRecord(adj15.product)
    assert(adj15Product.stock === -2, `ADJUSTMENT to negative should set stock to -2, got ${adj15Product.stock}`)
    assert(adj15.appliedDelta === -5, `ADJUSTMENT negative should store appliedDelta=-5, got ${adj15.appliedDelta}`)
    await api.deleteStockMovement(asNumber(adj15.id, "id"))
    logStep("ADJUSTMENT a valor negativo")

    const deleteProductResult = await api.deleteProduct(productId)
    assertCloneable(deleteProductResult, "deleteProduct")
    assertProductPriceStrings(asRecord(deleteProductResult), "deleteProduct")
    productId = null
    logStep("IPC deleteProduct")

    const deleteCategoryResult = await api.deleteCategory(categoryId)
    assertCloneable(deleteCategoryResult, "deleteCategory")
    categoryId = null
    logStep("IPC deleteCategory")

    const deleteSupplierResult = await api.deleteSupplier(supplierId)
    assertCloneable(deleteSupplierResult, "deleteSupplier")
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
