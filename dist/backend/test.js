"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = __importDefault(require("./db/client"));
const repositories_1 = require("./repositories");
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function logStep(step) {
    console.log(`PASS: ${step}`);
}
async function main() {
    const runId = Date.now();
    const categoryName = `IT Category ${runId}`;
    const supplierName = `IT Supplier ${runId}`;
    const productName = `IT Product ${runId}`;
    const updatedCategoryName = `IT Category Updated ${runId}`;
    const updatedSupplierName = `IT Supplier Updated ${runId}`;
    const updatedProductName = `IT Product Updated ${runId}`;
    const baseBarcode = BigInt(String(runId).slice(-9));
    const updatedBarcode = baseBarcode + 1n;
    let categoryId = null;
    let supplierId = null;
    let productId = null;
    try {
        const category = await (0, repositories_1.createCategory)({ name: categoryName });
        categoryId = category.id;
        assert(category.name === categoryName, "createCategory should persist name");
        logStep("createCategory");
        const supplier = await (0, repositories_1.createSupplier)({
            name: supplierName,
            phone: "123456",
            notes: "integration test"
        });
        supplierId = supplier.id;
        assert(supplier.name === supplierName, "createSupplier should persist name");
        logStep("createSupplier");
        const allCategories = await (0, repositories_1.listCategories)();
        assert(allCategories.some((c) => c.id === category.id), "listCategories should include created category");
        logStep("listCategories");
        const allSuppliers = await (0, repositories_1.listSuppliers)();
        assert(allSuppliers.some((s) => s.id === supplier.id), "listSuppliers should include created supplier");
        logStep("listSuppliers");
        const categoryById = await (0, repositories_1.getCategoryById)(category.id);
        assert(categoryById?.id === category.id, "getCategoryById should return created category");
        logStep("getCategoryById");
        const supplierById = await (0, repositories_1.getSupplierById)(supplier.id);
        assert(supplierById?.id === supplier.id, "getSupplierById should return created supplier");
        logStep("getSupplierById");
        const categoryUpdated = await (0, repositories_1.updateCategory)(category.id, { name: updatedCategoryName });
        assert(categoryUpdated.name === updatedCategoryName, "updateCategory should update name");
        logStep("updateCategory");
        const supplierUpdated = await (0, repositories_1.updateSupplier)(supplier.id, {
            name: updatedSupplierName,
            phone: "999999",
            notes: "updated"
        });
        assert(supplierUpdated.name === updatedSupplierName, "updateSupplier should update name");
        logStep("updateSupplier");
        const product = await (0, repositories_1.createProduct)({
            name: productName,
            purchasePrice: 100,
            salePrice: 150,
            categoryId: category.id,
            supplierId: supplier.id,
            barcode: baseBarcode,
            stock: 10,
            minStock: 2
        });
        productId = product.id;
        assert(product.name === productName, "createProduct should persist name");
        assert(product.category.id === category.id, "createProduct should include category");
        assert(product.supplier.id === supplier.id, "createProduct should include supplier");
        logStep("createProduct");
        const listedById = await (0, repositories_1.listProducts)({ id: product.id });
        assert(listedById.length === 1, "listProducts should filter by id");
        logStep("listProducts by id");
        const listedByBarcode = await (0, repositories_1.listProducts)({ barcode: baseBarcode });
        assert(listedByBarcode.length === 1, "listProducts should filter by barcode");
        logStep("listProducts by barcode");
        const listedByName = await (0, repositories_1.listProducts)({ nameContains: `Product ${runId}`, take: 5, skip: 0 });
        assert(listedByName.length >= 1, "listProducts should filter by nameContains");
        logStep("listProducts by nameContains + pagination");
        const productById = await (0, repositories_1.getProductById)(product.id);
        assert(productById?.id === product.id, "getProductById should return created product");
        logStep("getProductById");
        const productByBarcode = await (0, repositories_1.getProductByBarcode)(baseBarcode);
        assert(productByBarcode?.id === product.id, "getProductByBarcode should return created product");
        logStep("getProductByBarcode");
        const updatedProduct = await (0, repositories_1.updateProduct)(product.id, {
            name: updatedProductName,
            salePrice: 170,
            barcode: updatedBarcode,
            stock: 12,
            minStock: 3
        });
        assert(updatedProduct.name === updatedProductName, "updateProduct should update name");
        assert(updatedProduct.barcode === updatedBarcode, "updateProduct should update barcode");
        logStep("updateProduct");
        const absoluteStock = await (0, repositories_1.updateProductStock)(product.id, 30);
        assert(absoluteStock.stock === 30, "updateProductStock should set absolute stock");
        logStep("updateProductStock");
        const deltaUp = await (0, repositories_1.changeProductStock)(product.id, 5);
        assert(deltaUp.stock === 35, "changeProductStock should apply positive delta");
        const deltaDown = await (0, repositories_1.changeProductStock)(product.id, -10);
        assert(deltaDown.stock === 25, "changeProductStock should apply negative delta");
        logStep("changeProductStock");
        const movementIn = await (0, repositories_1.createStockMovement)({
            productId: product.id,
            type: "IN",
            quantity: 5,
            notes: "restock"
        });
        const afterIn = await (0, repositories_1.getProductById)(product.id);
        assert(afterIn?.stock === 30, "IN movement should increase stock");
        logStep("createStockMovement IN");
        const movementSale = await (0, repositories_1.createStockMovement)({
            productId: product.id,
            type: "SALE",
            quantity: 4,
            notes: "sale"
        });
        const afterSale = await (0, repositories_1.getProductById)(product.id);
        assert(afterSale?.stock === 26, "SALE movement should decrease stock");
        logStep("createStockMovement SALE");
        const movementAdjustment = await (0, repositories_1.createStockMovement)({
            productId: product.id,
            type: "ADJUSTMENT",
            quantity: -3,
            notes: "inventory correction"
        });
        const afterAdjustment = await (0, repositories_1.getProductById)(product.id);
        assert(afterAdjustment?.stock === 23, "ADJUSTMENT movement should apply delta");
        logStep("createStockMovement ADJUSTMENT");
        const movementHistory = await (0, repositories_1.listStockMovements)({ productId: product.id });
        assert(movementHistory.length >= 3, "listStockMovements should return created movements");
        logStep("listStockMovements");
        const saleMovements = await (0, repositories_1.listStockMovements)({ productId: product.id, type: "SALE" });
        assert(saleMovements.some((m) => m.id === movementSale.id), "listStockMovements should filter by type");
        logStep("listStockMovements by type");
        const movementById = await (0, repositories_1.getStockMovementById)(movementIn.id);
        assert(movementById?.id === movementIn.id, "getStockMovementById should return movement");
        logStep("getStockMovementById");
        await (0, repositories_1.deleteStockMovement)(movementSale.id, true);
        const afterRevertSale = await (0, repositories_1.getProductById)(product.id);
        assert(afterRevertSale?.stock === 27, "deleteStockMovement with revert should restore stock");
        logStep("deleteStockMovement with revert");
        await (0, repositories_1.deleteStockMovement)(movementIn.id);
        await (0, repositories_1.deleteStockMovement)(movementAdjustment.id);
        const remainingMovements = await (0, repositories_1.listStockMovements)({ productId: product.id });
        assert(remainingMovements.length === 0, "deleteStockMovement should remove movement rows");
        logStep("deleteStockMovement without revert");
        await (0, repositories_1.deleteProduct)(product.id);
        productId = null;
        const deletedProduct = await (0, repositories_1.getProductById)(product.id);
        assert(deletedProduct === null, "deleteProduct should remove row");
        logStep("deleteProduct");
        await (0, repositories_1.deleteCategory)(category.id);
        categoryId = null;
        const deletedCategory = await (0, repositories_1.getCategoryById)(category.id);
        assert(deletedCategory === null, "deleteCategory should remove row");
        logStep("deleteCategory");
        await (0, repositories_1.deleteSupplier)(supplier.id);
        supplierId = null;
        const deletedSupplier = await (0, repositories_1.getSupplierById)(supplier.id);
        assert(deletedSupplier === null, "deleteSupplier should remove row");
        logStep("deleteSupplier");
        console.log("SUCCESS: all DB/backend integration checks passed.");
    }
    finally {
        if (productId !== null) {
            await client_1.default.stockMovement.deleteMany({ where: { productId } });
            await client_1.default.product.deleteMany({ where: { id: productId } });
        }
        if (categoryId !== null) {
            await client_1.default.category.deleteMany({ where: { id: categoryId } });
        }
        if (supplierId !== null) {
            await client_1.default.supplier.deleteMany({ where: { id: supplierId } });
        }
    }
}
main()
    .catch((error) => {
    console.error("FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
})
    .finally(async () => {
    await client_1.default.$disconnect();
});
//# sourceMappingURL=test.js.map