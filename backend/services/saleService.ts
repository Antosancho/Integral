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
  productId: number
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
}

export interface ListSalesFilters extends PaginationInput {
  fromDate?: Date
  toDate?: Date
  method?: SalePaymentMethod | string
  productId?: number
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
      : {})
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

  const calculatedTotal = normalizedItems.reduce(
    (acc, item) => acc.add(item.unitPrice.mul(item.quantity)),
    new Prisma.Decimal(0)
  )

  const clientTotal = toDecimal(data.total)
  if (clientTotal.sub(calculatedTotal).abs().gt(MONEY_EPSILON)) {
    throw new Error(
      `Client-provided total (${clientTotal.toString()}) does not match calculated total (${calculatedTotal.toString()})`
    )
  }

  // Canonical value: persist the server's recalculation, not the client's input.
  const total = calculatedTotal

  const paymentsSum = normalizedPayments.reduce(
    (acc, payment) => acc.add(payment.amount),
    new Prisma.Decimal(0)
  )

  if (paymentsSum.sub(total).abs().gt(MONEY_EPSILON)) {
    throw new Error(
      `Payments sum (${paymentsSum.toString()}) must equal sale total (${total.toString()})`
    )
  }

  return prisma.$transaction(async (tx) => {
    const productIds = Array.from(new Set(normalizedItems.map((item) => item.productId)))
    const existingProducts = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true }
    })
    if (existingProducts.length !== productIds.length) {
      const foundIds = new Set(existingProducts.map((p) => p.id))
      const missingId = productIds.find((id) => !foundIds.has(id))
      throw new Error(`Product ${missingId} not found`)
    }

    const sale = await tx.sale.create({
      data: {
        total,
        ...(data.date ? { date: data.date } : {}),
        items: {
          create: normalizedItems.map((item) => ({
            productId: item.productId,
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
