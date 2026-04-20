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
        getStockMovementById: (id) => call("stockMovement:getById", { id }),
        deleteStockMovement: (id, revertStock) => call("stockMovement:delete", { id, revertStock })
    };
}
//# sourceMappingURL=ipcContract.js.map