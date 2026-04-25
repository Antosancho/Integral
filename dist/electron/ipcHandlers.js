"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIpcHandlers = buildIpcHandlers;
exports.registerIpcHandlers = registerIpcHandlers;
exports.invokeIpcHandler = invokeIpcHandler;
const repositories_1 = require("../backend/repositories");
const ipcSerialize_1 = require("./ipcSerialize");
const saleService_1 = require("../backend/services/saleService");
function toIpcError(channel, error) {
    if (error instanceof Error) {
        const maybeCode = error.code;
        const code = typeof maybeCode === "string" ? maybeCode : null;
        return new Error(code ? `[${channel}] ${code}: ${error.message}` : `[${channel}] ${error.message}`);
    }
    if (typeof error === "string") {
        return new Error(`[${channel}] ${error}`);
    }
    return new Error(`[${channel}] Unknown error`);
}
function withChannelError(channel, handler) {
    return async (payload) => {
        try {
            const result = await handler(payload);
            return (0, ipcSerialize_1.toIpcSafe)(result);
        }
        catch (error) {
            throw toIpcError(channel, error);
        }
    };
}
function buildIpcHandlers() {
    return {
        "category:create": withChannelError("category:create", ({ data }) => (0, repositories_1.createCategory)(data)),
        "category:list": withChannelError("category:list", () => (0, repositories_1.listCategories)()),
        "category:getById": withChannelError("category:getById", ({ id }) => (0, repositories_1.getCategoryById)(id)),
        "category:update": withChannelError("category:update", ({ id, data }) => (0, repositories_1.updateCategory)(id, data)),
        "category:delete": withChannelError("category:delete", ({ id }) => (0, repositories_1.deleteCategory)(id)),
        "supplier:create": withChannelError("supplier:create", ({ data }) => (0, repositories_1.createSupplier)(data)),
        "supplier:list": withChannelError("supplier:list", () => (0, repositories_1.listSuppliers)()),
        "supplier:getById": withChannelError("supplier:getById", ({ id }) => (0, repositories_1.getSupplierById)(id)),
        "supplier:update": withChannelError("supplier:update", ({ id, data }) => (0, repositories_1.updateSupplier)(id, data)),
        "supplier:delete": withChannelError("supplier:delete", ({ id }) => (0, repositories_1.deleteSupplier)(id)),
        "product:create": withChannelError("product:create", ({ data }) => (0, repositories_1.createProduct)(data)),
        "product:list": withChannelError("product:list", ({ filters }) => (0, repositories_1.listProducts)(filters)),
        "product:getById": withChannelError("product:getById", ({ id }) => (0, repositories_1.getProductById)(id)),
        "product:getByBarcode": withChannelError("product:getByBarcode", ({ barcode }) => (0, repositories_1.getProductByBarcode)(barcode)),
        "product:update": withChannelError("product:update", ({ id, data }) => (0, repositories_1.updateProduct)(id, data)),
        "product:updateStock": withChannelError("product:updateStock", ({ id, stock }) => (0, repositories_1.updateProductStock)(id, stock)),
        "product:changeStock": withChannelError("product:changeStock", ({ id, delta }) => (0, repositories_1.changeProductStock)(id, delta)),
        "product:delete": withChannelError("product:delete", ({ id }) => (0, repositories_1.deleteProduct)(id)),
        "stockMovement:create": withChannelError("stockMovement:create", ({ data }) => (0, repositories_1.createStockMovement)(data)),
        "stockMovement:list": withChannelError("stockMovement:list", ({ filters }) => (0, repositories_1.listStockMovements)(filters)),
        "stockMovement:getById": withChannelError("stockMovement:getById", ({ id }) => (0, repositories_1.getStockMovementById)(id)),
        "stockMovement:delete": withChannelError("stockMovement:delete", ({ id, revertStock }) => (0, repositories_1.deleteStockMovement)(id, revertStock ?? false)),
        "sale:create": withChannelError("sale:create", ({ data }) => (0, saleService_1.createSale)(data)),
        "sale:list": withChannelError("sale:list", ({ filters }) => (0, saleService_1.listSales)(filters)),
        "sale:getById": withChannelError("sale:getById", ({ id }) => (0, saleService_1.getSaleById)(id))
    };
}
function registerIpcHandlers(ipcMain) {
    const handlers = buildIpcHandlers();
    for (const [channel, handler] of Object.entries(handlers)) {
        ipcMain.handle(channel, async (_event, payload) => handler(payload));
    }
}
async function invokeIpcHandler(handlers, channel, payload) {
    const handler = handlers[channel];
    if (!handler) {
        throw new Error(`[${channel}] No handler registered`);
    }
    return handler(payload);
}
//# sourceMappingURL=ipcHandlers.js.map