import type {
  CreateCategoryInput,
  CreateProductInput,
  CreateStockMovementInput,
  CreateSupplierInput,
  ListStockMovementsFilters,
  ProductFilters,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateSupplierInput
} from "../backend/repositories"

export type IpcInvoke = (channel: string, payload: unknown) => Promise<unknown>

export interface ElectronApi {
  createCategory: (data: CreateCategoryInput) => Promise<unknown>
  listCategories: () => Promise<unknown>
  getCategoryById: (id: number) => Promise<unknown>
  updateCategory: (id: number, data: UpdateCategoryInput) => Promise<unknown>
  deleteCategory: (id: number) => Promise<unknown>

  createSupplier: (data: CreateSupplierInput) => Promise<unknown>
  listSuppliers: () => Promise<unknown>
  getSupplierById: (id: number) => Promise<unknown>
  updateSupplier: (id: number, data: UpdateSupplierInput) => Promise<unknown>
  deleteSupplier: (id: number) => Promise<unknown>

  createProduct: (data: CreateProductInput) => Promise<unknown>
  listProducts: (filters?: ProductFilters) => Promise<unknown>
  getProductById: (id: number) => Promise<unknown>
  getProductByBarcode: (barcode: bigint | number | string) => Promise<unknown>
  updateProduct: (id: number, data: UpdateProductInput) => Promise<unknown>
  updateProductStock: (id: number, stock: number) => Promise<unknown>
  changeProductStock: (id: number, delta: number) => Promise<unknown>
  deleteProduct: (id: number) => Promise<unknown>

  createStockMovement: (data: CreateStockMovementInput) => Promise<unknown>
  listStockMovements: (filters?: ListStockMovementsFilters) => Promise<unknown>
  getStockMovementById: (id: number) => Promise<unknown>
  deleteStockMovement: (id: number, revertStock?: boolean) => Promise<unknown>
}

export function buildElectronApi(invoke: IpcInvoke): ElectronApi {
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
  }
}
