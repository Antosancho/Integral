import prisma from "./db/client"
import {
  changeProductStock,
  createCategory,
  createProduct,
  createStockMovement,
  createSupplier,
  deleteCategory,
  deleteProduct,
  deleteStockMovement,
  deleteSupplier,
  getCategoryById,
  getProductByBarcode,
  getProductById,
  getStockMovementById,
  getSupplierById,
  listCategories,
  listProducts,
  listStockMovements,
  listSuppliers,
  updateCategory,
  updateProduct,
  updateProductStock,
  updateSupplier
} from "./repositories"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function logStep(step: string) {
  console.log(`PASS: ${step}`)
}

async function main() {
  const runId = Date.now()
  const categoryName = `IT Category ${runId}`
  const supplierName = `IT Supplier ${runId}`
  const productName = `IT Product ${runId}`
  const updatedCategoryName = `IT Category Updated ${runId}`
  const updatedSupplierName = `IT Supplier Updated ${runId}`
  const updatedProductName = `IT Product Updated ${runId}`

  const baseBarcode = BigInt(String(runId).slice(-9))
  const updatedBarcode = baseBarcode + 1n

  let categoryId: number | null = null
  let supplierId: number | null = null
  let productId: number | null = null

  try {
    const category = await createCategory({ name: categoryName })
    categoryId = category.id
    assert(category.name === categoryName, "createCategory should persist name")
    logStep("createCategory")

    const supplier = await createSupplier({
      name: supplierName,
      phone: "123456",
      notes: "integration test"
    })
    supplierId = supplier.id
    assert(supplier.name === supplierName, "createSupplier should persist name")
    logStep("createSupplier")

    const allCategories = await listCategories()
    assert(allCategories.some((c) => c.id === category.id), "listCategories should include created category")
    logStep("listCategories")

    const allSuppliers = await listSuppliers()
    assert(allSuppliers.some((s) => s.id === supplier.id), "listSuppliers should include created supplier")
    logStep("listSuppliers")

    const categoryById = await getCategoryById(category.id)
    assert(categoryById?.id === category.id, "getCategoryById should return created category")
    logStep("getCategoryById")

    const supplierById = await getSupplierById(supplier.id)
    assert(supplierById?.id === supplier.id, "getSupplierById should return created supplier")
    logStep("getSupplierById")

    const categoryUpdated = await updateCategory(category.id, { name: updatedCategoryName })
    assert(categoryUpdated.name === updatedCategoryName, "updateCategory should update name")
    logStep("updateCategory")

    const supplierUpdated = await updateSupplier(supplier.id, {
      name: updatedSupplierName,
      phone: "999999",
      notes: "updated"
    })
    assert(supplierUpdated.name === updatedSupplierName, "updateSupplier should update name")
    logStep("updateSupplier")

    const product = await createProduct({
      name: productName,
      purchasePrice: 100,
      salePrice: 150,
      categoryId: category.id,
      supplierId: supplier.id,
      barcode: baseBarcode,
      stock: 10,
      minStock: 2
    })
    productId = product.id
    assert(product.name === productName, "createProduct should persist name")
    assert(product.category.id === category.id, "createProduct should include category")
    assert(product.supplier.id === supplier.id, "createProduct should include supplier")
    logStep("createProduct")

    const listedById = await listProducts({ id: product.id })
    assert(listedById.length === 1, "listProducts should filter by id")
    logStep("listProducts by id")

    const listedByBarcode = await listProducts({ barcode: baseBarcode })
    assert(listedByBarcode.length === 1, "listProducts should filter by barcode")
    logStep("listProducts by barcode")

    const listedByName = await listProducts({ nameContains: `Product ${runId}`, take: 5, skip: 0 })
    assert(listedByName.length >= 1, "listProducts should filter by nameContains")
    logStep("listProducts by nameContains + pagination")

    const productById = await getProductById(product.id)
    assert(productById?.id === product.id, "getProductById should return created product")
    logStep("getProductById")

    const productByBarcode = await getProductByBarcode(baseBarcode)
    assert(productByBarcode?.id === product.id, "getProductByBarcode should return created product")
    logStep("getProductByBarcode")

    const updatedProduct = await updateProduct(product.id, {
      name: updatedProductName,
      salePrice: 170,
      barcode: updatedBarcode,
      stock: 12,
      minStock: 3
    })
    assert(updatedProduct.name === updatedProductName, "updateProduct should update name")
    assert(updatedProduct.barcode === updatedBarcode, "updateProduct should update barcode")
    logStep("updateProduct")

    const absoluteStock = await updateProductStock(product.id, 30)
    assert(absoluteStock.stock === 30, "updateProductStock should set absolute stock")
    logStep("updateProductStock")

    const deltaUp = await changeProductStock(product.id, 5)
    assert(deltaUp.stock === 35, "changeProductStock should apply positive delta")
    const deltaDown = await changeProductStock(product.id, -10)
    assert(deltaDown.stock === 25, "changeProductStock should apply negative delta")
    logStep("changeProductStock")

    const movementIn = await createStockMovement({
      productId: product.id,
      type: "IN",
      quantity: 5,
      notes: "restock"
    })
    const afterIn = await getProductById(product.id)
    assert(afterIn?.stock === 30, "IN movement should increase stock")
    logStep("createStockMovement IN")

    const movementSale = await createStockMovement({
      productId: product.id,
      type: "SALE",
      quantity: 4,
      notes: "sale"
    })
    const afterSale = await getProductById(product.id)
    assert(afterSale?.stock === 26, "SALE movement should decrease stock")
    logStep("createStockMovement SALE")

    const movementAdjustment = await createStockMovement({
      productId: product.id,
      type: "ADJUSTMENT",
      quantity: -3,
      notes: "inventory correction"
    })
    const afterAdjustment = await getProductById(product.id)
    assert(afterAdjustment?.stock === 23, "ADJUSTMENT movement should apply delta")
    logStep("createStockMovement ADJUSTMENT")

    const movementHistory = await listStockMovements({ productId: product.id })
    assert(movementHistory.length >= 3, "listStockMovements should return created movements")
    logStep("listStockMovements")

    const saleMovements = await listStockMovements({ productId: product.id, type: "SALE" })
    assert(saleMovements.some((m) => m.id === movementSale.id), "listStockMovements should filter by type")
    logStep("listStockMovements by type")

    const movementById = await getStockMovementById(movementIn.id)
    assert(movementById?.id === movementIn.id, "getStockMovementById should return movement")
    logStep("getStockMovementById")

    await deleteStockMovement(movementSale.id, true)
    const afterRevertSale = await getProductById(product.id)
    assert(afterRevertSale?.stock === 27, "deleteStockMovement with revert should restore stock")
    logStep("deleteStockMovement with revert")

    await deleteStockMovement(movementIn.id)
    await deleteStockMovement(movementAdjustment.id)
    const remainingMovements = await listStockMovements({ productId: product.id })
    assert(remainingMovements.length === 0, "deleteStockMovement should remove movement rows")
    logStep("deleteStockMovement without revert")

    await deleteProduct(product.id)
    productId = null
    const deletedProduct = await getProductById(product.id)
    assert(deletedProduct === null, "deleteProduct should remove row")
    logStep("deleteProduct")

    await deleteCategory(category.id)
    categoryId = null
    const deletedCategory = await getCategoryById(category.id)
    assert(deletedCategory === null, "deleteCategory should remove row")
    logStep("deleteCategory")

    await deleteSupplier(supplier.id)
    supplierId = null
    const deletedSupplier = await getSupplierById(supplier.id)
    assert(deletedSupplier === null, "deleteSupplier should remove row")
    logStep("deleteSupplier")

    console.log("SUCCESS: all DB/backend integration checks passed.")
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
