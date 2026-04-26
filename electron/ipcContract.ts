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

export interface SaleItemFromApi {
  id: number
  saleId: number
  productId: number | null
  quantity: number
  unitPrice: string
  // product may be null for "general" items that have no linked Product
  product: BareProductFromApi | null
}

export interface SalePaymentFromApi {
  id: number
  saleId: number
  method: string
  amount: string
}

export interface SaleFromApi {
  id: number
  date: Date
  total: string
  discountPct: string
  items: SaleItemFromApi[]
  payments: SalePaymentFromApi[]
}

// ---------------------------------------------------------------------------
// Tipos de salida para el módulo de Estadísticas
// ---------------------------------------------------------------------------

export interface StatsSummaryFromApi {
  totalRevenue: string
  saleCount: number
  averageTicket: string
  totalProfit: string
}

export interface TopProductFromApi {
  productId: number
  productName: string
  /** Unidades o monto, según la consulta invocada */
  value: string
}

export interface SalesByPeriodFromApi {
  /** '00'–'23' para hora; '0'–'6' para día de semana (0=Dom) */
  label: string
  saleCount: number
  totalRevenue: string
}

export interface LowRotationFromApi {
  productId: number
  productName: string
  totalQuantity: number
}

export interface CreateSaleItemPayload {
  // optional: absent for "general" items
  productId?: number
  quantity: number
  unitPrice: number | string
}

export interface CreateSalePaymentPayload {
  method: "CASH" | "TRANSFER" | "DEBIT" | "CREDIT" | "OTHER" | string
  amount: number | string
}

export interface CreateSalePayload {
  items: CreateSaleItemPayload[]
  payments: CreateSalePaymentPayload[]
  total: number | string
  discountPct?: number | string
  date?: Date
}

export interface ListSalesFiltersPayload {
  skip?: number
  take?: number
  fromDate?: Date
  toDate?: Date
  method?: string
  productId?: number
  minTotal?: number | string
  maxTotal?: number | string
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

  createSale: (data: CreateSalePayload) => Promise<SaleFromApi>
  listSales: (filters?: ListSalesFiltersPayload) => Promise<SaleFromApi[]>
  getSaleById: (id: number) => Promise<SaleFromApi | null>

  getSalesSummary: (input: { from: Date; to: Date }) => Promise<StatsSummaryFromApi>
  getTopProductsByQuantity: (input: { from: Date; to: Date; limit: number }) => Promise<TopProductFromApi[]>
  getTopProductsByRevenue: (input: { from: Date; to: Date; limit: number }) => Promise<TopProductFromApi[]>
  getSalesByHour: (input: { from: Date; to: Date }) => Promise<SalesByPeriodFromApi[]>
  getSalesByWeekday: (input: { from: Date; to: Date }) => Promise<SalesByPeriodFromApi[]>
  getLowRotationProducts: (input: { from: Date; to: Date; limit: number }) => Promise<LowRotationFromApi[]>
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
      call<BareStockMovementFromApi>("stockMovement:delete", { id, revertStock }),

    createSale: (data) => call<SaleFromApi>("sale:create", { data }),
    listSales: (filters) => call<SaleFromApi[]>("sale:list", { filters }),
    getSaleById: (id) => call<SaleFromApi | null>("sale:getById", { id }),

    getSalesSummary: (input) => call<StatsSummaryFromApi>('stats:getSummary', input),
    getTopProductsByQuantity: (input) => call<TopProductFromApi[]>('stats:getTopProductsByQuantity', input),
    getTopProductsByRevenue: (input) => call<TopProductFromApi[]>('stats:getTopProductsByRevenue', input),
    getSalesByHour: (input) => call<SalesByPeriodFromApi[]>('stats:getSalesByHour', input),
    getSalesByWeekday: (input) => call<SalesByPeriodFromApi[]>('stats:getSalesByWeekday', input),
    getLowRotationProducts: (input) => call<LowRotationFromApi[]>('stats:getLowRotationProducts', input)
  }
}
