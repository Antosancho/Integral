import { Prisma } from "@prisma/client"
import prisma from "../db/client"
import {
  DecimalInput,
  PaginationInput,
  SalePaymentMethod,
  ensurePositiveInteger,
  normalizePagination,
  normalizeSalePaymentMethod,
  toDecimal
} from "../repositories/utilities"

export interface CreateSaleItemInput {
  // productId is optional to support "general" lines (no product associated)
  productId?: number
  quantity: number
  unitPrice: DecimalInput
}

export interface CreateSalePaymentInput {
  method: SalePaymentMethod | string
  amount: DecimalInput
}

export interface CreateSaleInput {
  items: CreateSaleItemInput[]
  payments: CreateSalePaymentInput[]
  total: DecimalInput
  date?: Date
  discountPct?: number | string
}

export interface ListSalesFilters extends PaginationInput {
  fromDate?: Date
  toDate?: Date
  method?: SalePaymentMethod | string
  productId?: number
  minTotal?: DecimalInput
  maxTotal?: DecimalInput
}

const saleInclude = {
  items: { include: { product: true } },
  payments: true
} as const

// Tolerance for monetary equality checks (1 centavo ARS).
// Absorbs FP noise from clients sending `number` without masking real errors,
// which in ARS are always >= 0.01 pesos.
const MONEY_EPSILON = new Prisma.Decimal("0.01")

function buildSaleWhere(filters?: ListSalesFilters): Prisma.SaleWhereInput {
  if (!filters) return {}

  return {
    ...((filters.fromDate || filters.toDate)
      ? {
          date: {
            ...(filters.fromDate ? { gte: filters.fromDate } : {}),
            ...(filters.toDate ? { lte: filters.toDate } : {})
          }
        }
      : {}),
    ...(filters.method !== undefined
      ? { payments: { some: { method: normalizeSalePaymentMethod(filters.method) } } }
      : {}),
    ...(filters.productId !== undefined
      ? { items: { some: { productId: filters.productId } } }
      : {}),
    ...((filters.minTotal !== undefined || filters.maxTotal !== undefined) ? {
      total: {
        ...(filters.minTotal !== undefined ? { gte: toDecimal(filters.minTotal) } : {}),
        ...(filters.maxTotal !== undefined ? { lte: toDecimal(filters.maxTotal) } : {})
      }
    } : {})
  }
}

// Creates a sale atomically: header, items, payments, stock updates and SALE stock movements.
// Does NOT call createStockMovement from the repository: that would double-update stock.
export async function createSale(data: CreateSaleInput) {
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error("Sale must contain at least one item")
  }
  if (!Array.isArray(data.payments) || data.payments.length === 0) {
    throw new Error("Sale must contain at least one payment")
  }

  const normalizedItems = data.items.map((item, index) => {
    const unitPrice = toDecimal(item.unitPrice)
    if (unitPrice.lt(0)) {
      throw new Error(`items[${index}].unitPrice must be >= 0`)
    }
    return {
      // preserve productId as-is (may be undefined/null for general lines)
      productId: item.productId,
      quantity: ensurePositiveInteger(item.quantity, `items[${index}].quantity`),
      unitPrice
    }
  })

  const normalizedPayments = data.payments.map((payment, index) => {
    const amount = toDecimal(payment.amount)
    if (amount.lte(0)) {
      throw new Error(`payments[${index}].amount must be > 0`)
    }
    return {
      method: normalizeSalePaymentMethod(payment.method as string),
      amount
    }
  })

   const calculatedSubtotal = normalizedItems.reduce(
     (acc, item) => acc.add(item.unitPrice.mul(item.quantity)),
     new Prisma.Decimal(0)
   )

   // Parse discountPct
   const discountPct = data.discountPct !== undefined 
     ? toDecimal(data.discountPct) 
     : new Prisma.Decimal(0)
   if (discountPct.abs().gt(new Prisma.Decimal(200))) {
     throw new Error("discountPct must be in [-200, 200]")
   }

   // Calculate expected total with discount
   const factor = new Prisma.Decimal(1).sub(discountPct.div(new Prisma.Decimal(100)))
   const raw = calculatedSubtotal.mul(factor)
   const expectedTotal = raw.lt(0) ? new Prisma.Decimal(0) : raw

   const clientTotal = toDecimal(data.total)
   if (clientTotal.sub(expectedTotal).abs().gt(MONEY_EPSILON)) {
     throw new Error(
       `Client-provided total (${clientTotal.toString()}) does not match expected total (${expectedTotal.toString()})`
     )
   }

   // Canonical value: persist the server's recalculation, not the client's input.
   const total = expectedTotal

   const paymentsSum = normalizedPayments.reduce(
     (acc, payment) => acc.add(payment.amount),
     new Prisma.Decimal(0)
   )

   if (total.sub(paymentsSum).gt(MONEY_EPSILON)) {
     throw new Error(
       `Payments sum (${paymentsSum.toString()}) is less than sale total (${total.toString()})`
     )
   }

  return prisma.$transaction(async (tx) => {
    // Validate that all items that reference a product actually exist.
    // Skip validation when there are no product-linked items.
    const productIds = Array.from(new Set(
      normalizedItems
        .map((item) => item.productId)
        .filter((id): id is number => id != null)
    ))
    if (productIds.length > 0) {
      const existingProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true }
      })
      if (existingProducts.length !== productIds.length) {
        const foundIds = new Set(existingProducts.map((p) => p.id))
        const missingId = productIds.find((id) => !foundIds.has(id))
        throw new Error(`Product ${missingId} not found`)
      }
    }

    const sale = await tx.sale.create({
      data: {
        total,
        discountPct,
        ...(data.date ? { date: data.date } : {}),
        items: {
          create: normalizedItems.map((item) => ({
            // Persist productId as null when absent so DB stores general items with productId = NULL
            productId: item.productId ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        },
        payments: {
          create: normalizedPayments.map((payment) => ({
            method: payment.method,
            amount: payment.amount
          }))
        }
      },
      include: saleInclude
    })

    for (const item of normalizedItems) {
      // Items without a productId are "general" and must not touch stock nor create movements
      if (item.productId == null) continue

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      })

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: "SALE",
          quantity: item.quantity,
          appliedDelta: -item.quantity,
          saleId: sale.id,
          notes: `Sale #${sale.id}`
        }
      })
    }

    return sale
  })
}

// Lists sales with filters by date range, payment method and product.
export async function listSales(filters?: ListSalesFilters) {
  const pagination = normalizePagination(filters)

  return prisma.sale.findMany({
    where: buildSaleWhere(filters),
    orderBy: { date: "desc" },
    include: saleInclude,
    ...pagination
  })
}

// Reads one sale by id with items (and product) and payments included.
export async function getSaleById(id: number) {
  return prisma.sale.findUnique({
    where: { id },
    include: saleInclude
  })
}
