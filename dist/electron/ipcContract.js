"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildElectronApi = buildElectronApi;
function buildElectronApi(invoke) {
    return {
        createCategory: (data) => invoke("category:create", { data }),
        listCategories: () => invoke("category:list", {}),
        getCategoryById: (id) => invoke("category:getById", { id }),
        updateCategory: (id, data) => invoke("category:update", { id, data }),
        deleteCategory: (id) => invoke("category:delete", { id }),
        createSupplier: (data) => invoke("supplier:create", { data }),
        listSuppliers: () => invoke("supplier:list", {}),
        getSupplierById: (id) => invoke("supplier:getById", { id }),
        updateSupplier: (id, data) => invoke("supplier:update", { id, data }),
        deleteSupplier: (id) => invoke("supplier:delete", { id }),
        createProduct: (data) => invoke("product:create", { data }),
        listProducts: (filters) => invoke("product:list", { filters }),
        getProductById: (id) => invoke("product:getById", { id }),
        getProductByBarcode: (barcode) => invoke("product:getByBarcode", { barcode }),
        updateProduct: (id, data) => invoke("product:update", { id, data }),
        updateProductStock: (id, stock) => invoke("product:updateStock", { id, stock }),
        changeProductStock: (id, delta) => invoke("product:changeStock", { id, delta }),
        deleteProduct: (id) => invoke("product:delete", { id }),
        createStockMovement: (data) => invoke("stockMovement:create", { data }),
        listStockMovements: (filters) => invoke("stockMovement:list", { filters }),
        getStockMovementById: (id) => invoke("stockMovement:getById", { id }),
        deleteStockMovement: (id, revertStock) => invoke("stockMovement:delete", { id, revertStock })
    };
}
//# sourceMappingURL=ipcContract.js.map