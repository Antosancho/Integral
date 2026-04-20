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

// -----------------------------------------------------------------------------
// Tipos de salida (lo que realmente llega al renderer despues del IPC).
// Reflejan la serializacion de `electron/ipcSerialize.ts`:
//   - Prisma.Decimal  -> string
//   - bigint          -> bigint (pasa tal cual)
//   - Date            -> Date   (pasa tal cual)
// -----------------------------------------------------------------------------

export interface CategoryFromApi {
  id: number
  name: string
}

export interface SupplierFromApi {
  id: number
  name: string
  phone: string | null
  notes: string | null
}

export interface BareProductFromApi {
  id: number
  name: string
  barcode: bigint | null
  purchasePrice: string
  salePrice: string
  stock: number
  minStock: number
  createdAt: Date
  categoryId: number
  supplierId: number
}

export interface ProductFromApi extends BareProductFromApi {
  category: CategoryFromApi
  supplier: SupplierFromApi
}

export interface BareStockMovementFromApi {
  id: number
  productId: number
  type: string
  quantity: number
  date: Date
  notes: string | null
  appliedDelta: number | null
  saleId: number | null
}

export interface StockMovementFromApi extends BareStockMovementFromApi {
  product: BareProductFromApi
}

export type IpcInvoke = (channel: string, payload: unknown) => Promise<unknown>

export interface ElectronApi {
  createCategory: (data: CreateCategoryInput) => Promise<CategoryFromApi>
  listCategories: () => Promise<CategoryFromApi[]>
  getCategoryById: (id: number) => Promise<CategoryFromApi | null>
  updateCategory: (id: number, data: UpdateCategoryInput) => Promise<CategoryFromApi>
  deleteCategory: (id: number) => Promise<CategoryFromApi>

  createSupplier: (data: CreateSupplierInput) => Promise<SupplierFromApi>
  listSuppliers: () => Promise<SupplierFromApi[]>
  getSupplierById: (id: number) => Promise<SupplierFromApi | null>
  updateSupplier: (id: number, data: UpdateSupplierInput) => Promise<SupplierFromApi>
  deleteSupplier: (id: number) => Promise<SupplierFromApi>

  createProduct: (data: CreateProductInput) => Promise<ProductFromApi>
  listProducts: (filters?: ProductFilters) => Promise<ProductFromApi[]>
  getProductById: (id: number) => Promise<ProductFromApi | null>
  getProductByBarcode: (barcode: bigint | number | string) => Promise<ProductFromApi | null>
  updateProduct: (id: number, data: UpdateProductInput) => Promise<ProductFromApi>
  updateProductStock: (id: number, stock: number) => Promise<ProductFromApi>
  changeProductStock: (id: number, delta: number) => Promise<ProductFromApi>
  deleteProduct: (id: number) => Promise<BareProductFromApi>

  createStockMovement: (data: CreateStockMovementInput) => Promise<StockMovementFromApi>
  listStockMovements: (filters?: ListStockMovementsFilters) => Promise<StockMovementFromApi[]>
  getStockMovementById: (id: number) => Promise<StockMovementFromApi | null>
  deleteStockMovement: (id: number, revertStock?: boolean) => Promise<BareStockMovementFromApi>
}

export function buildElectronApi(invoke: IpcInvoke): ElectronApi {
  const call = <T>(channel: string, payload: unknown) => invoke(channel, payload) as Promise<T>

  return {
    createCategory: (data) => call<CategoryFromApi>("category:create", { data }),
    listCategories: () => call<CategoryFromApi[]>("category:list", {}),
    getCategoryById: (id) => call<CategoryFromApi | null>("category:getById", { id }),
    updateCategory: (id, data) => call<CategoryFromApi>("category:update", { id, data }),
    deleteCategory: (id) => call<CategoryFromApi>("category:delete", { id }),

    createSupplier: (data) => call<SupplierFromApi>("supplier:create", { data }),
    listSuppliers: () => call<SupplierFromApi[]>("supplier:list", {}),
    getSupplierById: (id) => call<SupplierFromApi | null>("supplier:getById", { id }),
    updateSupplier: (id, data) => call<SupplierFromApi>("supplier:update", { id, data }),
    deleteSupplier: (id) => call<SupplierFromApi>("supplier:delete", { id }),

    createProduct: (data) => call<ProductFromApi>("product:create", { data }),
    listProducts: (filters) => call<ProductFromApi[]>("product:list", { filters }),
    getProductById: (id) => call<ProductFromApi | null>("product:getById", { id }),
    getProductByBarcode: (barcode) => call<ProductFromApi | null>("product:getByBarcode", { barcode }),
    updateProduct: (id, data) => call<ProductFromApi>("product:update", { id, data }),
    updateProductStock: (id, stock) => call<ProductFromApi>("product:updateStock", { id, stock }),
    changeProductStock: (id, delta) => call<ProductFromApi>("product:changeStock", { id, delta }),
    deleteProduct: (id) => call<BareProductFromApi>("product:delete", { id }),

    createStockMovement: (data) => call<StockMovementFromApi>("stockMovement:create", { data }),
    listStockMovements: (filters) => call<StockMovementFromApi[]>("stockMovement:list", { filters }),
    getStockMovementById: (id) => call<StockMovementFromApi | null>("stockMovement:getById", { id }),
    deleteStockMovement: (id, revertStock) =>
      call<BareStockMovementFromApi>("stockMovement:delete", { id, revertStock })
  }
}
