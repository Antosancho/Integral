"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const client_2 = __importDefault(require("./db/client"));
const services_1 = require("./services");
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
        const category = await (0, services_1.createCategory)({ name: categoryName });
        categoryId = category.id;
        assert(category.name === categoryName, "createCategory should persist name");
        logStep("createCategory");
        const supplier = await (0, services_1.createSupplier)({
            name: supplierName,
            phone: "123456",
            notes: "integration test"
        });
        supplierId = supplier.id;
        assert(supplier.name === supplierName, "createSupplier should persist name");
        logStep("createSupplier");
        const allCategories = await (0, services_1.listCategories)();
        assert(allCategories.some((c) => c.id === category.id), "listCategories should include created category");
        logStep("listCategories");
        const allSuppliers = await (0, services_1.listSuppliers)();
        assert(allSuppliers.some((s) => s.id === supplier.id), "listSuppliers should include created supplier");
        logStep("listSuppliers");
        const categoryById = await (0, services_1.getCategoryById)(category.id);
        assert(categoryById?.id === category.id, "getCategoryById should return created category");
        logStep("getCategoryById");
        const supplierById = await (0, services_1.getSupplierById)(supplier.id);
        assert(supplierById?.id === supplier.id, "getSupplierById should return created supplier");
        logStep("getSupplierById");
        const categoryUpdated = await (0, services_1.updateCategory)(category.id, { name: updatedCategoryName });
        assert(categoryUpdated.name === updatedCategoryName, "updateCategory should update name");
        logStep("updateCategory");
        const supplierUpdated = await (0, services_1.updateSupplier)(supplier.id, {
            name: updatedSupplierName,
            phone: "999999",
            notes: "updated"
        });
        assert(supplierUpdated.name === updatedSupplierName, "updateSupplier should update name");
        logStep("updateSupplier");
        const product = await (0, services_1.createProduct)({
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
        const listedById = await (0, services_1.listProducts)({ id: product.id });
        assert(listedById.length === 1, "listProducts should filter by id");
        logStep("listProducts by id");
        const listedByBarcode = await (0, services_1.listProducts)({ barcode: baseBarcode });
        assert(listedByBarcode.length === 1, "listProducts should filter by barcode");
        logStep("listProducts by barcode");
        const listedByName = await (0, services_1.listProducts)({ nameContains: `Product ${runId}`, take: 5, skip: 0 });
        assert(listedByName.length >= 1, "listProducts should filter by nameContains");
        logStep("listProducts by nameContains + pagination");
        const productById = await (0, services_1.getProductById)(product.id);
        assert(productById?.id === product.id, "getProductById should return created product");
        logStep("getProductById");
        const productByBarcode = await (0, services_1.getProductByBarcode)(baseBarcode);
        assert(productByBarcode?.id === product.id, "getProductByBarcode should return created product");
        logStep("getProductByBarcode");
        const updatedProduct = await (0, services_1.updateProduct)(product.id, {
            name: updatedProductName,
            salePrice: 170,
            barcode: updatedBarcode,
            stock: 12,
            minStock: 3
        });
        assert(updatedProduct.name === updatedProductName, "updateProduct should update name");
        assert(updatedProduct.barcode === updatedBarcode, "updateProduct should update barcode");
        logStep("updateProduct");
        const absoluteStock = await (0, services_1.updateProductStock)(product.id, 30);
        assert(absoluteStock.stock === 30, "updateProductStock should set absolute stock");
        logStep("updateProductStock");
        const deltaUp = await (0, services_1.changeProductStock)(product.id, 5);
        assert(deltaUp.stock === 35, "changeProductStock should apply positive delta");
        const deltaDown = await (0, services_1.changeProductStock)(product.id, -10);
        assert(deltaDown.stock === 25, "changeProductStock should apply negative delta");
        logStep("changeProductStock");
        const movementIn = await (0, services_1.createStockMovement)({
            productId: product.id,
            type: "IN",
            quantity: 5,
            notes: "restock"
        });
        const afterIn = await (0, services_1.getProductById)(product.id);
        assert(afterIn?.stock === 30, "IN movement should increase stock");
        logStep("createStockMovement IN");
        const movementSale = await (0, services_1.createStockMovement)({
            productId: product.id,
            type: "SALE",
            quantity: 4,
            notes: "sale"
        });
        const afterSale = await (0, services_1.getProductById)(product.id);
        assert(afterSale?.stock === 26, "SALE movement should decrease stock");
        logStep("createStockMovement SALE");
        const movementAdjustment = await (0, services_1.createStockMovement)({
            productId: product.id,
            type: "ADJUSTMENT",
            quantity: 20,
            notes: "inventory correction"
        });
        const afterAdjustment = await (0, services_1.getProductById)(product.id);
        assert(afterAdjustment?.stock === 20, "ADJUSTMENT movement should set absolute stock");
        assert(movementAdjustment.quantity === 20, "ADJUSTMENT should persist the absolute quantity provided by the user");
        assert(movementAdjustment.appliedDelta === -6, `ADJUSTMENT should persist appliedDelta = target - currentStock (expected -6, got ${movementAdjustment.appliedDelta})`);
        logStep("createStockMovement ADJUSTMENT (absolute semantics + appliedDelta)");
        const movementHistory = await (0, services_1.listStockMovements)({ productId: product.id });
        assert(movementHistory.length >= 3, "listStockMovements should return created movements");
        logStep("listStockMovements");
        const saleMovements = await (0, services_1.listStockMovements)({ productId: product.id, type: "SALE" });
        assert(saleMovements.some((m) => m.id === movementSale.id), "listStockMovements should filter by type");
        logStep("listStockMovements by type");
        const movementById = await (0, services_1.getStockMovementById)(movementIn.id);
        assert(movementById?.id === movementIn.id, "getStockMovementById should return movement");
        logStep("getStockMovementById");
        const adjustmentById = await (0, services_1.getStockMovementById)(movementAdjustment.id);
        assert(adjustmentById?.quantity === 20, "ADJUSTMENT movement should store the absolute quantity in the DB");
        assert(adjustmentById?.appliedDelta === -6, `ADJUSTMENT movement should store appliedDelta = -6 in the DB, got ${adjustmentById?.appliedDelta}`);
        logStep("getStockMovementById persists appliedDelta for ADJUSTMENT");
        await (0, services_1.deleteStockMovement)(movementSale.id, true);
        const afterRevertSale = await (0, services_1.getProductById)(product.id);
        assert(afterRevertSale?.stock === 24, `deleteStockMovement with revert (SALE) should add 4 back, expected 24, got ${afterRevertSale?.stock}`);
        logStep("deleteStockMovement with revert (SALE)");
        await (0, services_1.deleteStockMovement)(movementAdjustment.id, true);
        const afterRevertAdjustment = await (0, services_1.getProductById)(product.id);
        assert(afterRevertAdjustment?.stock === 30, `deleteStockMovement with revert (ADJUSTMENT) should invert appliedDelta, expected 30, got ${afterRevertAdjustment?.stock}`);
        const adjustmentAfterDelete = await (0, services_1.getStockMovementById)(movementAdjustment.id);
        assert(adjustmentAfterDelete === null, "deleteStockMovement should remove the ADJUSTMENT row");
        logStep("deleteStockMovement with revert (ADJUSTMENT)");
        // --- Nueva conducta: stock puede ir a negativo en operaciones de flujo ---
        await (0, services_1.updateProductStock)(product.id, 2);
        const afterReset = await (0, services_1.getProductById)(product.id);
        assert(afterReset?.stock === 2, "precondition: stock reset to 2 before negative-flow tests");
        const negativeDelta = await (0, services_1.changeProductStock)(product.id, -5);
        assert(negativeDelta.stock === -3, `changeProductStock should allow negative result, got ${negativeDelta.stock}`);
        logStep("changeProductStock allows negative stock");
        await (0, services_1.updateProductStock)(product.id, 1);
        const negativeSale = await (0, services_1.createStockMovement)({
            productId: product.id,
            type: "SALE",
            quantity: 4,
            notes: "oversell test"
        });
        const afterNegativeSale = await (0, services_1.getProductById)(product.id);
        assert(afterNegativeSale?.stock === -3, `SALE should allow negative stock, got ${afterNegativeSale?.stock}`);
        logStep("createStockMovement SALE allows negative stock");
        await (0, services_1.updateProductStock)(product.id, 2);
        const inToRevert = await (0, services_1.createStockMovement)({
            productId: product.id,
            type: "IN",
            quantity: 3,
            notes: "IN to be reverted into negative"
        });
        await (0, services_1.updateProductStock)(product.id, 1);
        await (0, services_1.deleteStockMovement)(inToRevert.id, true);
        const afterRevertIn = await (0, services_1.getProductById)(product.id);
        assert(afterRevertIn?.stock === -2, `deleteStockMovement revert IN should allow negative stock, got ${afterRevertIn?.stock}`);
        logStep("deleteStockMovement revert IN allows negative stock");
        await (0, services_1.deleteStockMovement)(movementIn.id);
        await (0, services_1.deleteStockMovement)(negativeSale.id);
        const remainingMovements = await (0, services_1.listStockMovements)({ productId: product.id });
        assert(remainingMovements.length === 0, `deleteStockMovement should remove movement rows, got ${remainingMovements.length} remaining`);
        logStep("deleteStockMovement without revert");
        // --- Sale service tests ---
        await client_2.default.stockMovement.deleteMany({ where: { productId: product.id } });
        await (0, services_1.updateProductStock)(product.id, 10);
        const sale1 = await (0, services_1.createSale)({
            items: [{ productId: product.id, quantity: 2, unitPrice: 150 }],
            payments: [{ method: "CASH", amount: 300 }],
            total: 300
        });
        assert(sale1.items.length === 1, "createSale should persist items");
        assert(sale1.payments.length === 1, "createSale should persist payments");
        assert(sale1.items[0].product.id === product.id, "SaleItem should include its product");
        assert(sale1.items[0].quantity === 2, "SaleItem should persist quantity");
        assert(sale1.items[0].unitPrice.toNumber() === 150, "SaleItem should persist unit price snapshot");
        assert(sale1.total.toNumber() === 300, "Sale.total should equal sum(quantity * unitPrice) of items");
        const stockAfterSale1 = await (0, services_1.getProductById)(product.id);
        assert(stockAfterSale1?.stock === 8, `createSale should decrement stock from 10 to 8, got ${stockAfterSale1?.stock}`);
        const sale1Movements = await (0, services_1.listStockMovements)({ productId: product.id, type: "SALE" });
        const sale1Movement = sale1Movements.find((m) => m.saleId === sale1.id);
        assert(sale1Movement !== undefined, "createSale should create a StockMovement with saleId linkage");
        assert(sale1Movement.quantity === 2, "SALE movement should persist quantity = item.quantity");
        assert(sale1Movement.appliedDelta === -2, `SALE movement should persist appliedDelta = -quantity, got ${sale1Movement.appliedDelta}`);
        logStep("createSale (single item, single payment)");
        const sale2 = await (0, services_1.createSale)({
            items: [
                { productId: product.id, quantity: 3, unitPrice: 100 },
                { productId: product.id, quantity: 1, unitPrice: 50 }
            ],
            payments: [
                { method: "CASH", amount: 200 },
                { method: "TRANSFER", amount: 150 }
            ],
            total: 350
        });
        assert(sale2.items.length === 2, "createSale should support multiple items");
        assert(sale2.payments.length === 2, "createSale should support multiple payments");
        assert(sale2.total.toNumber() === 350, `Sale.total should be 350, got ${sale2.total.toString()}`);
        const stockAfterSale2 = await (0, services_1.getProductById)(product.id);
        assert(stockAfterSale2?.stock === 4, `createSale should decrement stock by sum of quantities (8 - 4 = 4), got ${stockAfterSale2?.stock}`);
        const sale2Movements = await (0, services_1.listStockMovements)({ productId: product.id, type: "SALE" });
        const sale2MovementsLinked = sale2Movements.filter((m) => m.saleId === sale2.id);
        assert(sale2MovementsLinked.length === 2, `createSale should create one StockMovement per item, got ${sale2MovementsLinked.length}`);
        logStep("createSale (multiple items, split payments)");
        let paymentMismatchError = null;
        try {
            await (0, services_1.createSale)({
                items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
                payments: [{ method: "CASH", amount: 90 }],
                total: 100
            });
        }
        catch (err) {
            paymentMismatchError = err instanceof Error ? err : new Error(String(err));
        }
        assert(paymentMismatchError !== null, "createSale should reject when payments sum != total");
        assert(paymentMismatchError.message.includes("must equal sale total"), `Expected payments-mismatch error, got ${paymentMismatchError.message}`);
        const stockAfterRejectedPayments = await (0, services_1.getProductById)(product.id);
        assert(stockAfterRejectedPayments?.stock === 4, `Rejected createSale must not alter stock, got ${stockAfterRejectedPayments?.stock}`);
        logStep("createSale rejects payment sum mismatch (no side effects)");
        let invalidMethodError = null;
        try {
            await (0, services_1.createSale)({
                items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
                payments: [{ method: "CRYPTO", amount: 100 }],
                total: 100
            });
        }
        catch (err) {
            invalidMethodError = err instanceof Error ? err : new Error(String(err));
        }
        assert(invalidMethodError !== null, "createSale should reject invalid payment method");
        assert(invalidMethodError.message.includes("Invalid sale payment method"), `Expected invalid-method error, got ${invalidMethodError.message}`);
        logStep("createSale rejects invalid payment method");
        let emptyItemsError = null;
        try {
            await (0, services_1.createSale)({
                items: [],
                payments: [{ method: "CASH", amount: 0 }],
                total: 0
            });
        }
        catch (err) {
            emptyItemsError = err instanceof Error ? err : new Error(String(err));
        }
        assert(emptyItemsError !== null, "createSale should reject empty items");
        assert(emptyItemsError.message.includes("at least one item"), `Expected empty-items error, got ${emptyItemsError.message}`);
        logStep("createSale rejects empty items");
        const saleNegative = await (0, services_1.createSale)({
            items: [{ productId: product.id, quantity: 10, unitPrice: 10 }],
            payments: [{ method: "CASH", amount: 100 }],
            total: 100
        });
        const afterNegativeStock = await (0, services_1.getProductById)(product.id);
        assert(afterNegativeStock?.stock === -6, `createSale must allow stock to go negative (4 - 10 = -6), got ${afterNegativeStock?.stock}`);
        logStep("createSale allows negative stock");
        const fetched = await (0, services_1.getSaleById)(sale2.id);
        assert(fetched !== null, "getSaleById should return the sale");
        assert(fetched.items.length === 2, "getSaleById should include items");
        assert(fetched.items.every((i) => i.product.id === product.id), "getSaleById items should include product");
        assert(fetched.payments.length === 2, "getSaleById should include payments");
        logStep("getSaleById returns sale with items+product and payments");
        const missingSale = await (0, services_1.getSaleById)(-1);
        assert(missingSale === null, "getSaleById should return null for missing id");
        logStep("getSaleById returns null for missing id");
        const allSales = await (0, services_1.listSales)();
        assert(allSales.some((s) => s.id === sale1.id), "listSales (no filters) should include sale1");
        assert(allSales.some((s) => s.id === sale2.id), "listSales (no filters) should include sale2");
        assert(allSales.some((s) => s.id === saleNegative.id), "listSales (no filters) should include saleNegative");
        logStep("listSales without filters");
        const salesByProduct = await (0, services_1.listSales)({ productId: product.id });
        assert(salesByProduct.some((s) => s.id === sale1.id) &&
            salesByProduct.some((s) => s.id === sale2.id) &&
            salesByProduct.some((s) => s.id === saleNegative.id), "listSales should filter sales that include the given productId");
        logStep("listSales filter by productId");
        const salesByTransfer = await (0, services_1.listSales)({ method: "TRANSFER" });
        assert(salesByTransfer.some((s) => s.id === sale2.id), "listSales method=TRANSFER should include sale2");
        assert(!salesByTransfer.some((s) => s.id === sale1.id), "listSales method=TRANSFER should exclude sale1 (only CASH)");
        logStep("listSales filter by method");
        const now = new Date();
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
        const pastDate = new Date(now.getTime() - oneYearMs);
        const oldSale = await (0, services_1.createSale)({
            items: [{ productId: product.id, quantity: 1, unitPrice: 10 }],
            payments: [{ method: "CASH", amount: 10 }],
            total: 10,
            date: pastDate
        });
        assert(oldSale.date.toISOString() === pastDate.toISOString(), "createSale should persist explicit date");
        const cutoffDate = new Date(now.getTime() - sixMonthsMs);
        const recentSales = await (0, services_1.listSales)({ fromDate: cutoffDate });
        assert(recentSales.some((s) => s.id === sale1.id), "listSales with fromDate should include recent sales");
        assert(!recentSales.some((s) => s.id === oldSale.id), "listSales with fromDate should exclude pre-cutoff sales");
        const oldSales = await (0, services_1.listSales)({ toDate: cutoffDate });
        assert(oldSales.some((s) => s.id === oldSale.id), "listSales with toDate should include pre-cutoff sales");
        assert(!oldSales.some((s) => s.id === sale1.id), "listSales with toDate should exclude recent sales");
        logStep("listSales filter by date range");
        // --- Multi-product, case normalization, total mismatch ---
        const product2 = await (0, services_1.createProduct)({
            name: `IT Product 2 ${runId}`,
            purchasePrice: 50,
            salePrice: 80,
            categoryId: category.id,
            supplierId: supplier.id,
            barcode: baseBarcode + 2n,
            stock: 5,
            minStock: 1
        });
        const stockProductBeforeMulti = (await (0, services_1.getProductById)(product.id)).stock;
        const sale3 = await (0, services_1.createSale)({
            items: [
                { productId: product.id, quantity: 1, unitPrice: 100 },
                { productId: product2.id, quantity: 2, unitPrice: 80 }
            ],
            payments: [{ method: "CASH", amount: 260 }],
            total: 260
        });
        assert(sale3.items.length === 2, "createSale should support items from multiple distinct products");
        assert(sale3.total.toNumber() === 260, `sale3.total should be 260, got ${sale3.total.toString()}`);
        const product1AfterSale3 = await (0, services_1.getProductById)(product.id);
        assert(product1AfterSale3?.stock === stockProductBeforeMulti - 1, `multi-product sale should decrement product1 stock by 1, expected ${stockProductBeforeMulti - 1}, got ${product1AfterSale3?.stock}`);
        const product2AfterSale3 = await (0, services_1.getProductById)(product2.id);
        assert(product2AfterSale3?.stock === 3, `multi-product sale should decrement product2 stock (5 - 2 = 3), got ${product2AfterSale3?.stock}`);
        const product2SaleMovements = await (0, services_1.listStockMovements)({ productId: product2.id, type: "SALE" });
        assert(product2SaleMovements.some((m) => m.saleId === sale3.id), "multi-product sale should create a StockMovement for product2 linked via saleId");
        logStep("createSale with multiple distinct products");
        const saleLowercase = await (0, services_1.createSale)({
            items: [{ productId: product.id, quantity: 1, unitPrice: 100 }],
            payments: [{ method: "cash", amount: 100 }],
            total: 100
        });
        assert(saleLowercase.payments[0].method === "CASH", `createSale should normalize payment method to uppercase, got ${saleLowercase.payments[0].method}`);
        logStep("createSale normalizes payment method case");
        let totalMismatchError = null;
        try {
            await (0, services_1.createSale)({
                items: [{ productId: product.id, quantity: 2, unitPrice: 100 }],
                payments: [{ method: "CASH", amount: 999 }],
                total: 999
            });
        }
        catch (err) {
            totalMismatchError = err instanceof Error ? err : new Error(String(err));
        }
        assert(totalMismatchError !== null, "createSale should reject when client total does not match server total");
        assert(totalMismatchError.message.includes("does not match calculated total"), `Expected client-total-mismatch error, got ${totalMismatchError.message}`);
        logStep("createSale rejects client total mismatch");
        const salesByProduct2 = await (0, services_1.listSales)({ productId: product2.id });
        assert(salesByProduct2.some((s) => s.id === sale3.id), "listSales productId=product2 should include sale3");
        assert(!salesByProduct2.some((s) => s.id === sale1.id), "listSales productId=product2 should exclude sales that only reference product1");
        logStep("listSales filter by productId excludes unrelated sales");
        // Cleanup needed for the existing happy-path deleteProduct to avoid FK errors.
        await client_2.default.sale.deleteMany({ where: { items: { some: { productId: product.id } } } });
        await client_2.default.sale.deleteMany({ where: { items: { some: { productId: product2.id } } } });
        await client_2.default.stockMovement.deleteMany({ where: { productId: product.id } });
        await client_2.default.stockMovement.deleteMany({ where: { productId: product2.id } });
        await (0, services_1.deleteProduct)(product2.id);
        // Avoid unused-variable warnings for asserts that are implicit via includes
        void client_1.Prisma;
        // --- End of sale service tests ---
        await (0, services_1.deleteProduct)(product.id);
        productId = null;
        const deletedProduct = await (0, services_1.getProductById)(product.id);
        assert(deletedProduct === null, "deleteProduct should remove row");
        logStep("deleteProduct");
        await (0, services_1.deleteCategory)(category.id);
        categoryId = null;
        const deletedCategory = await (0, services_1.getCategoryById)(category.id);
        assert(deletedCategory === null, "deleteCategory should remove row");
        logStep("deleteCategory");
        await (0, services_1.deleteSupplier)(supplier.id);
        supplierId = null;
        const deletedSupplier = await (0, services_1.getSupplierById)(supplier.id);
        assert(deletedSupplier === null, "deleteSupplier should remove row");
        logStep("deleteSupplier");
        console.log("SUCCESS: all DB/backend integration checks passed.");
    }
    finally {
        if (productId !== null) {
            await client_2.default.sale.deleteMany({ where: { items: { some: { productId } } } });
            await client_2.default.stockMovement.deleteMany({ where: { productId } });
            await client_2.default.product.deleteMany({ where: { id: productId } });
        }
        if (categoryId !== null) {
            await client_2.default.category.deleteMany({ where: { id: categoryId } });
        }
        if (supplierId !== null) {
            await client_2.default.supplier.deleteMany({ where: { id: supplierId } });
        }
    }
}
main()
    .catch((error) => {
    console.error("FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
})
    .finally(async () => {
    await client_2.default.$disconnect();
});
//# sourceMappingURL=test.js.map