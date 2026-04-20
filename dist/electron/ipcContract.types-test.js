"use strict";
// Archivo de test de tipos. NO tiene runtime útil; TS lo valida en compilación.
// Si rompe, significa que el contrato IPC dejó de coincidir con la realidad.
Object.defineProperty(exports, "__esModule", { value: true });
// --- Fixtures que simulan lo que sale del serializer ---
const category = { id: 1, name: "Bebidas" };
const supplier = {
    id: 1,
    name: "Proveedor X",
    phone: null,
    notes: null
};
const bareProduct = {
    id: 1,
    name: "Coca 500ml",
    barcode: 7790895000000n,
    purchasePrice: "100.00",
    salePrice: "150.00",
    stock: 10,
    minStock: 2,
    createdAt: new Date(),
    categoryId: 1,
    supplierId: 1
};
const product = {
    ...bareProduct,
    category,
    supplier
};
const bareMovement = {
    id: 1,
    productId: 1,
    type: "IN",
    quantity: 5,
    date: new Date(),
    notes: null,
    appliedDelta: null,
    saleId: null
};
const movement = {
    ...bareMovement,
    product: bareProduct
};
// --- Comprobaciones estructurales ---
// barcode DEBE ser bigint | null (no string, no number).
const _bc = product.barcode;
// precios DEBEN ser string.
const _pp = product.purchasePrice;
const _sp = product.salePrice;
// createdAt DEBE ser Date.
const _ca = product.createdAt;
// category y supplier DEBEN estar presentes.
const _catName = product.category.name;
const _supName = product.supplier.name;
// StockMovement.product NO debe tener category/supplier (es BareProductFromApi).
// @ts-expect-error — product dentro de un movimiento viene desnudo.
const _shouldFail = movement.product.category;
// --- Mock de ElectronApi para validar firmas ---
const api = {
    createCategory: async (_d) => category,
    listCategories: async () => [category],
    getCategoryById: async (_id) => category,
    updateCategory: async (_id, _d) => category,
    deleteCategory: async (_id) => category,
    createSupplier: async (_d) => supplier,
    listSuppliers: async () => [supplier],
    getSupplierById: async (_id) => supplier,
    updateSupplier: async (_id, _d) => supplier,
    deleteSupplier: async (_id) => supplier,
    createProduct: async (_d) => product,
    listProducts: async (_f) => [product],
    getProductById: async (_id) => product,
    getProductByBarcode: async (_b) => product,
    updateProduct: async (_id, _d) => product,
    updateProductStock: async (_id, _s) => product,
    changeProductStock: async (_id, _d) => product,
    deleteProduct: async (_id) => bareProduct,
    createStockMovement: async (_d) => movement,
    listStockMovements: async (_f) => [movement],
    getStockMovementById: async (_id) => movement,
    deleteStockMovement: async (_id, _r) => bareMovement
};
void api;
//# sourceMappingURL=ipcContract.types-test.js.map