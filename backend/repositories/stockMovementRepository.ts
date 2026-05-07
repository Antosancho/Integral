import { Prisma } from "@prisma/client"
import prisma from "../db/client"
import {
  OptionalString,
  PaginationInput,
  StockMovementType,
  ensureInteger,
  ensureNonZeroInteger,
  ensurePositiveInteger,
  normalizeOptionalString,
  normalizePagination,
  normalizeStockMovementType
} from "./utilities"

export interface CreateStockMovementInput {
  productId: number
  type: StockMovementType | string
  quantity: number
  notes?: OptionalString
  date?: Date
  applyToStock?: boolean
  /** Fecha de vencimiento del lote. Opcional — si no perece se omite. */
  expiryDate?: Date | null
}

export interface ListStockMovementsFilters extends PaginationInput {
  productId?: number
  type?: StockMovementType | string
  fromDate?: Date
  toDate?: Date
}

// Converts movement semantics into stock delta.
function resolveStockDelta(type: StockMovementType, quantity: number, currentStock: number): number {
  switch (type) {
    case "IN":
      return quantity
    case "SALE":
      return -quantity
    case "ADJUSTMENT":
      return quantity - currentStock
    default:
      throw new Error(`Unknown stock movement type: ${type}`)
  }
}

// Builds movement filters for reporting/history endpoints.
function buildStockMovementWhere(filters?: ListStockMovementsFilters): Prisma.StockMovementWhereInput {
  if (!filters) return {}

  return {
    ...(filters.productId !== undefined ? { productId: filters.productId } : {}),
    ...(filters.type !== undefined
      ? { type: normalizeStockMovementType(filters.type) }
      : {}),
    ...((filters.fromDate || filters.toDate)
      ? {
          date: {
            ...(filters.fromDate ? { gte: filters.fromDate } : {}),
            ...(filters.toDate ? { lte: filters.toDate } : {})
          }
        }
      : {})
  }
}

// Creates a stock movement and optionally updates product stock in the same transaction.
export async function createStockMovement(data: CreateStockMovementInput) {
  const type = normalizeStockMovementType(data.type)
  const applyToStock = data.applyToStock ?? true
  // IN acepta negativos (merma/baja); SALE solo positivos; ADJUSTMENT cualquier entero
  const quantity =
    type === "ADJUSTMENT"
      ? ensureInteger(data.quantity, "quantity")
      : type === "IN"
      ? ensureNonZeroInteger(data.quantity, "quantity")
      : ensurePositiveInteger(data.quantity, "quantity")

  return prisma.$transaction(async (tx) => {
    let appliedDelta: number | undefined

    if (applyToStock) {
      const product = await tx.product.findUnique({ where: { id: data.productId } })
      if (!product) {
        throw new Error(`Product ${data.productId} not found`)
      }

      const delta = resolveStockDelta(type, quantity, product.stock)
      appliedDelta = delta
      const nextStock = product.stock + delta

      await tx.product.update({
        where: { id: data.productId },
        data: { stock: nextStock }
      })
    }

    return tx.stockMovement.create({
      data: {
        productId: data.productId,
        type,
        quantity,
        notes: normalizeOptionalString(data.notes),
        ...(data.date ? { date: data.date } : {}),
        ...(appliedDelta !== undefined ? { appliedDelta } : {}),
        // expiryDismissedAt siempre null al crear; solo se setea con dismissStockMovementExpiry
        ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate } : {})
      },
      include: {
        product: true
      }
    })
  })
}

// Lists movement history with optional date/type/product filters.
export async function listStockMovements(filters?: ListStockMovementsFilters) {
  const pagination = normalizePagination(filters)

  return prisma.stockMovement.findMany({
    where: buildStockMovementWhere(filters),
    orderBy: { date: "desc" },
    include: {
      product: true
    },
    ...pagination
  })
}

/**
 * Lista los lotes vivos para un conjunto de productos en una sola consulta.
 * Solo incluye entradas de stock positivas, no descartadas por vencimiento.
 */
export async function listLotsByProductIds(productIds: number[]) {
  if (productIds.length === 0) return []

  return prisma.stockMovement.findMany({
    where: {
      productId: { in: productIds },
      type: "IN",
      expiryDismissedAt: null,
      quantity: { gt: 0 }
    },
    orderBy: { expiryDate: "asc" },
    include: {
      product: true
    }
  })
}

// Reads one stock movement by id.
export async function getStockMovementById(id: number) {
  return prisma.stockMovement.findUnique({
    where: { id },
    include: {
      product: true
    }
  })
}

/**
 * Lista los lotes con vencimiento pendiente de descarte:
 * expiryDate <= fin de hoy (hora local) y expiryDismissedAt IS NULL.
 * La clasificación "vencido" vs "vence hoy" se hace en el renderer
 * para mantener el repo simple y evitar duplicar lógica de zona horaria.
 */
export async function listExpiringStockMovements() {
  const now = new Date()
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  return prisma.stockMovement.findMany({
    where: {
      type: "IN",
      expiryDate: { not: null, lte: endOfToday },
      expiryDismissedAt: null
    },
    orderBy: { expiryDate: "asc" },
    include: { product: true }
  })
}

/**
 * Marca un lote como descartado de forma permanente (no reaparecerá al recargar la app).
 * No modifica el stock; solo setea expiryDismissedAt con timestamp actual.
 */
export async function dismissStockMovementExpiry(id: number) {
  return prisma.stockMovement.update({
    where: { id },
    data: { expiryDismissedAt: new Date() },
    include: { product: true }
  })
}

// Deletes a movement and can optionally revert its stock impact.
export async function deleteStockMovement(id: number, revertStock = false) {
  return prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.findUnique({
      where: { id }
    })

    if (!movement) {
      throw new Error(`Stock movement ${id} not found`)
    }

    if (revertStock) {
      const movementType = normalizeStockMovementType(movement.type)

      const product = await tx.product.findUnique({
        where: { id: movement.productId }
      })

      if (!product) {
        throw new Error(`Product ${movement.productId} not found`)
      }

      let inverseDelta: number
      if (movementType === "ADJUSTMENT") {
        if (movement.appliedDelta === null) {
          throw new Error(
            "Cannot revert this ADJUSTMENT: missing appliedDelta (record created before bug fix)"
          )
        }
        inverseDelta = -movement.appliedDelta
      } else {
        inverseDelta = -resolveStockDelta(movementType, movement.quantity, product.stock)
      }

      const nextStock = product.stock + inverseDelta

      await tx.product.update({
        where: { id: movement.productId },
        data: { stock: nextStock }
      })
    }

    return tx.stockMovement.delete({
      where: { id }
    })
  })
}
