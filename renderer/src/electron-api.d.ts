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

type ElectronApi = {
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
  getProductByBarcode: (barcode: BarcodeInput) => Promise<unknown>
  updateProduct: (id: number, data: UpdateProductInput) => Promise<unknown>
  updateProductStock: (id: number, stock: number) => Promise<unknown>
  changeProductStock: (id: number, delta: number) => Promise<unknown>
  deleteProduct: (id: number) => Promise<unknown>

  createStockMovement: (data: CreateStockMovementInput) => Promise<unknown>
  listStockMovements: (filters?: ListStockMovementsFilters) => Promise<unknown>
  getStockMovementById: (id: number) => Promise<unknown>
  deleteStockMovement: (id: number, revertStock?: boolean) => Promise<unknown>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}

export {}
