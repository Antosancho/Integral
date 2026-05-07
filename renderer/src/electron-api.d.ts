// ---------------------------------------------------------------------------
// ESPEJO del contrato IPC. Debe quedar SINCRONIZADO con electron/ipcContract.ts.
// Si uno cambia, el otro tambien.
// Reglas de serializacion:
//   - Prisma.Decimal -> string
//   - bigint         -> bigint  (pasa tal cual)
//   - Date           -> Date    (pasa tal cual)
// ---------------------------------------------------------------------------

// ---------- Inputs ----------

type DecimalInput = number | string
type BarcodeInput = number | string | bigint
type StockMovementType = "IN" | "SALE" | "ADJUSTMENT"

type PaginationInput = {
  skip?: number
  take?: number
}

type CreateCategoryInput = {
  name: string
}

type UpdateCategoryInput = {
  name?: string
}

type CreateSupplierInput = {
  name: string
  phone?: string | null
  notes?: string | null
}

type UpdateSupplierInput = {
  name?: string
  phone?: string | null
  notes?: string | null
}

type CreateProductInput = {
  name: string
  purchasePrice: DecimalInput
  salePrice: DecimalInput
  categoryId: number
  supplierId: number
  barcode?: BarcodeInput | null
  stock?: number
  minStock?: number
  /** Fecha de vencimiento del lote inicial. Solo aplica cuando stock > 0. */
  expiryDate?: Date | null
}

type UpdateProductInput = {
  name?: string
  purchasePrice?: DecimalInput
  salePrice?: DecimalInput
  categoryId?: number
  supplierId?: number
  barcode?: BarcodeInput | null
  stock?: number
  minStock?: number
}

type ProductFilters = PaginationInput & {
  id?: number
  barcode?: BarcodeInput
  categoryId?: number
  supplierId?: number
  nameContains?: string
}

type CreateStockMovementInput = {
  productId: number
  type: StockMovementType | string
  quantity: number
  notes?: string | null
  date?: Date
  applyToStock?: boolean
  /** Fecha de vencimiento del lote. Opcional — si no perece se omite. */
  expiryDate?: Date | null
}

type ListStockMovementsFilters = PaginationInput & {
  productId?: number
  type?: StockMovementType | string
  fromDate?: Date
  toDate?: Date
}

// ---------- Outputs (serializados) ----------

export type CategoryFromApi = {
  id: number
  name: string
}

export type SupplierFromApi = {
  id: number
  name: string
  phone: string | null
  notes: string | null
}

export type BareProductFromApi = {
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

export type ProductFromApi = BareProductFromApi & {
  category: CategoryFromApi
  supplier: SupplierFromApi
}

export type BareStockMovementFromApi = {
  id: number
  productId: number
  type: string
  quantity: number
  date: Date
  notes: string | null
  appliedDelta: number | null
  saleId: number | null
  expiryDate: Date | null
  expiryDismissedAt: Date | null
}

export type StockMovementFromApi = BareStockMovementFromApi & {
  product: BareProductFromApi
}

export type SaleItemFromApi = {
  id: number
  saleId: number
  productId: number | null
  quantity: number
  unitPrice: string
  // product may be null when the item is a 'general' line
  product: BareProductFromApi | null
}

export type SalePaymentFromApi = {
  id: number
  saleId: number
  method: string
  amount: string
}

export type SaleFromApi = {
  id: number
  date: Date
  total: string
  discountPct: string
  items: SaleItemFromApi[]
  payments: SalePaymentFromApi[]
}

export type CreateSaleItemPayload = {
  // optional: omitted for 'general' items
  productId?: number
  quantity: number
  unitPrice: number | string
}

export type CreateSalePaymentPayload = {
  method: "CASH" | "TRANSFER" | "DEBIT" | "CREDIT" | "OTHER" | string
  amount: number | string
}

export type CreateSalePayload = {
  items: CreateSaleItemPayload[]
  payments: CreateSalePaymentPayload[]
  total: number | string
  discountPct?: number | string
  date?: Date
}

export type ListSalesFiltersPayload = {
  skip?: number
  take?: number
  fromDate?: Date
  toDate?: Date
  method?: string
  productId?: number
  minTotal?: number | string
  maxTotal?: number | string
}

// ---------------------------------------------------------------------------
// Tipos de salida para el módulo de Estadísticas (duplicado manual del backend)
// ---------------------------------------------------------------------------

export type StatsSummaryFromApi = {
  totalRevenue: string
  saleCount: number
  averageTicket: string
  totalProfit: string
}

export type TopProductFromApi = {
  productId: number
  productName: string
  /** Unidades o monto según la consulta invocada */
  value: string
}

export type SalesByPeriodFromApi = {
  /** '00'–'23' para hora; '0'–'6' para día de semana (0=Dom) */
  label: string
  saleCount: number
  totalRevenue: string
}

export type LowRotationFromApi = {
  productId: number
  productName: string
  totalQuantity: number
}

// ---------- ElectronApi ----------

type ElectronApi = {
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
  getProductByBarcode: (barcode: BarcodeInput) => Promise<ProductFromApi | null>
  updateProduct: (id: number, data: UpdateProductInput) => Promise<ProductFromApi>
  updateProductStock: (id: number, stock: number) => Promise<ProductFromApi>
  changeProductStock: (id: number, delta: number) => Promise<ProductFromApi>
  deleteProduct: (id: number) => Promise<BareProductFromApi>

  createStockMovement: (data: CreateStockMovementInput) => Promise<StockMovementFromApi>
  listStockMovements: (filters?: ListStockMovementsFilters) => Promise<StockMovementFromApi[]>
  listLotsByProductIds: (productIds: number[]) => Promise<StockMovementFromApi[]>
  getStockMovementById: (id: number) => Promise<StockMovementFromApi | null>
  deleteStockMovement: (id: number, revertStock?: boolean) => Promise<BareStockMovementFromApi>
  listExpiringStockMovements: () => Promise<StockMovementFromApi[]>
  dismissStockMovementExpiry: (id: number) => Promise<StockMovementFromApi>

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

declare global {
  interface Window {
    api: ElectronApi
  }
}

export {}
