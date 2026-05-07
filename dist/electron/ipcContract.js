"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildElectronApi = buildElectronApi;
function buildElectronApi(invoke) {
    const call = (channel, payload) => invoke(channel, payload);
    return {
        createCategory: (data) => call("category:create", { data }),
        listCategories: () => call("category:list", {}),
        getCategoryById: (id) => call("category:getById", { id }),
        updateCategory: (id, data) => call("category:update", { id, data }),
        deleteCategory: (id) => call("category:delete", { id }),
        createSupplier: (data) => call("supplier:create", { data }),
        listSuppliers: () => call("supplier:list", {}),
        getSupplierById: (id) => call("supplier:getById", { id }),
        updateSupplier: (id, data) => call("supplier:update", { id, data }),
        deleteSupplier: (id) => call("supplier:delete", { id }),
        createProduct: (data) => call("product:create", { data }),
        listProducts: (filters) => call("product:list", { filters }),
        getProductById: (id) => call("product:getById", { id }),
        getProductByBarcode: (barcode) => call("product:getByBarcode", { barcode }),
        updateProduct: (id, data) => call("product:update", { id, data }),
        updateProductStock: (id, stock) => call("product:updateStock", { id, stock }),
        changeProductStock: (id, delta) => call("product:changeStock", { id, delta }),
        deleteProduct: (id) => call("product:delete", { id }),
        createStockMovement: (data) => call("stockMovement:create", { data }),
        listStockMovements: (filters) => call("stockMovement:list", { filters }),
        listLotsByProductIds: (productIds) => call("stockMovement:listLotsByProductIds", { productIds }),
        getStockMovementById: (id) => call("stockMovement:getById", { id }),
        deleteStockMovement: (id, revertStock) => call("stockMovement:delete", { id, revertStock }),
        listExpiringStockMovements: () => call("stockMovement:listExpiring", {}),
        dismissStockMovementExpiry: (id) => call("stockMovement:dismissExpiry", { id }),
        createSale: (data) => call("sale:create", { data }),
        listSales: (filters) => call("sale:list", { filters }),
        getSaleById: (id) => call("sale:getById", { id }),
        getSalesSummary: (input) => call('stats:getSummary', input),
        getTopProductsByQuantity: (input) => call('stats:getTopProductsByQuantity', input),
        getTopProductsByRevenue: (input) => call('stats:getTopProductsByRevenue', input),
        getSalesByHour: (input) => call('stats:getSalesByHour', input),
        getSalesByWeekday: (input) => call('stats:getSalesByWeekday', input),
        getLowRotationProducts: (input) => call('stats:getLowRotationProducts', input)
    };
}
//# sourceMappingURL=ipcContract.js.map