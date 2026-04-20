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
}

type ListStockMovementsFilters = PaginationInput & {
  productId?: number
  type?: StockMovementType | string
  fromDate?: Date
  toDate?: Date
}

// ---------- Outputs (serializados) ----------

type CategoryFromApi = {
  id: number
  name: string
}

type SupplierFromApi = {
  id: number
  name: string
  phone: string | null
  notes: string | null
}

type BareProductFromApi = {
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

type ProductFromApi = BareProductFromApi & {
  category: CategoryFromApi
  supplier: SupplierFromApi
}

type BareStockMovementFromApi = {
  id: number
  productId: number
  type: string
  quantity: number
  date: Date
  notes: string | null
  appliedDelta: number | null
  saleId: number | null
}

type StockMovementFromApi = BareStockMovementFromApi & {
  product: BareProductFromApi
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
  getStockMovementById: (id: number) => Promise<StockMovementFromApi | null>
  deleteStockMovement: (id: number, revertStock?: boolean) => Promise<BareStockMovementFromApi>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}

export {}
