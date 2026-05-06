import { Prisma } from "@prisma/client"
import prisma from "../db/client"
import {
  BarcodeInput,
  DecimalInput,
  PaginationInput,
  ensureNonNegativeInteger,
  normalizePagination,
  normalizeRequiredString,
  productInclude,
  toBigInt,
  toDecimal
} from "./utilities"

export interface CreateProductInput {
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

export interface UpdateProductInput {
  name?: string
  purchasePrice?: DecimalInput
  salePrice?: DecimalInput
  categoryId?: number
  supplierId?: number
  barcode?: BarcodeInput | null
  stock?: number
  minStock?: number
}

export interface ProductFilters extends PaginationInput {
  id?: number
  barcode?: BarcodeInput
  categoryId?: number
  supplierId?: number
  nameContains?: string
}

// Builds a reusable where object for product list queries.
function buildProductWhere(filters?: ProductFilters): Prisma.ProductWhereInput {
  if (!filters) return {}

  return {
    ...(filters.id !== undefined ? { id: filters.id } : {}),
    ...(filters.barcode !== undefined ? { barcode: toBigInt(filters.barcode) } : {}),
    ...(filters.categoryId !== undefined ? { categoryId: filters.categoryId } : {}),
    ...(filters.supplierId !== undefined ? { supplierId: filters.supplierId } : {}),
    ...(filters.nameContains
      ? { name: { contains: filters.nameContains } }
      : {})
  }
}

/**
 * Crea un producto y, cuando stock > 0, genera un StockMovement IN inicial
 * en la misma transacción para garantizar trazabilidad del lote.
 * appliedDelta = 0 porque el stock ya quedó persistido en Product.create;
 * el movement solo registra el lote (y opcionalmente su fecha de vencimiento).
 */
export async function createProduct(data: CreateProductInput) {
  const stock = ensureNonNegativeInteger(data.stock ?? 0, "stock")
  const minStock = ensureNonNegativeInteger(data.minStock ?? 0, "minStock")

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: normalizeRequiredString(data.name, "name"),
        purchasePrice: toDecimal(data.purchasePrice),
        salePrice: toDecimal(data.salePrice),
        categoryId: data.categoryId,
        supplierId: data.supplierId,
        barcode: data.barcode !== undefined && data.barcode !== null ? toBigInt(data.barcode) : null,
        stock,
        minStock
      },
      include: productInclude
    })

    if (stock > 0) {
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: "IN",
          quantity: stock,
          // delta 0: el stock ya quedó en Product.create; este mov solo registra el lote inicial
          appliedDelta: 0,
          notes: "Lote inicial al crear producto",
          ...(data.expiryDate ? { expiryDate: data.expiryDate } : {})
        }
      })
    }

    return product
  })
}

// Lists products with optional filters and pagination.
export async function listProducts(filters?: ProductFilters) {
  const pagination = normalizePagination(filters)

  return prisma.product.findMany({
    where: buildProductWhere(filters),
    orderBy: { createdAt: "desc" },
    include: productInclude,
    ...pagination
  })
}

// Reads one product by id, including category and supplier.
export async function getProductById(id: number) {
  return prisma.product.findUnique({
    where: { id },
    include: productInclude
  })
}

// Reads one product by unique barcode.
export async function getProductByBarcode(barcode: BarcodeInput) {
  return prisma.product.findUnique({
    where: { barcode: toBigInt(barcode) },
    include: productInclude
  })
}

// Updates one product; only provided fields are changed.
export async function updateProduct(id: number, data: UpdateProductInput) {
  const updateData: Prisma.ProductUpdateInput = {
    ...(data.name !== undefined ? { name: normalizeRequiredString(data.name, "name") } : {}),
    ...(data.purchasePrice !== undefined ? { purchasePrice: toDecimal(data.purchasePrice) } : {}),
    ...(data.salePrice !== undefined ? { salePrice: toDecimal(data.salePrice) } : {}),
    ...(data.categoryId !== undefined ? { category: { connect: { id: data.categoryId } } } : {}),
    ...(data.supplierId !== undefined ? { supplier: { connect: { id: data.supplierId } } } : {}),
    ...(data.barcode !== undefined
      ? { barcode: data.barcode === null ? null : toBigInt(data.barcode) }
      : {}),
    ...(data.stock !== undefined
      ? { stock: ensureNonNegativeInteger(data.stock, "stock") }
      : {}),
    ...(data.minStock !== undefined
      ? { minStock: ensureNonNegativeInteger(data.minStock, "minStock") }
      : {})
  }

  return prisma.product.update({
    where: { id },
    data: updateData,
    include: productInclude
  })
}

// Sets the absolute stock value after validation.
export async function updateProductStock(id: number, stock: number) {
  return prisma.product.update({
    where: { id },
    data: { stock: ensureNonNegativeInteger(stock, "stock") },
    include: productInclude
  })
}

// Applies a stock delta atomically (positive or negative).
export async function changeProductStock(id: number, delta: number) {
  if (!Number.isInteger(delta)) {
    throw new Error("delta must be an integer")
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id } })
    if (!existing) {
      throw new Error(`Product ${id} not found`)
    }

    const nextStock = existing.stock + delta

    return tx.product.update({
      where: { id },
      data: { stock: nextStock },
      include: productInclude
    })
  })
}

// Deletes a product by id.
export async function deleteProduct(id: number) {
  return prisma.product.delete({
    where: { id }
  })
}
