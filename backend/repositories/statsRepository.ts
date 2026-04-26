import prisma from '../db/client'
import { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// Tipos de retorno expuestos hacia el IPC
// ---------------------------------------------------------------------------

export type StatsSummary = {
  totalRevenue: string
  saleCount: number
  averageTicket: string
  totalProfit: string
}

export type TopProductResult = {
  productId: number
  productName: string
  /** Unidades vendidas (como string) o monto facturado (Decimal serializado) */
  value: string
}

export type SalesByPeriodResult = {
  /** '00'–'23' para hora; '0'–'6' para día de semana (0 = Domingo) */
  label: string
  saleCount: number
  totalRevenue: string
}

export type LowRotationResult = {
  productId: number
  productName: string
  totalQuantity: number
}

// ---------------------------------------------------------------------------
// Función 1: resumen de ventas en un período
// ---------------------------------------------------------------------------

/**
 * Retorna totales de revenue, cantidad de ventas, ticket promedio y ganancia.
 * La ganancia solo considera ítems con productId y purchasePriceSnapshot (ventas nuevas).
 */
export async function getSalesSummary(from: Date, to: Date): Promise<StatsSummary> {
  const [aggResult, profitItems] = await Promise.all([
    // Agrega totales de ventas en el rango
    prisma.sale.aggregate({
      where: { date: { gte: from, lte: to } },
      _sum: { total: true },
      _count: { id: true }
    }),
    // Trae ítems con snapshot de precio de compra para calcular margen
    prisma.saleItem.findMany({
      where: {
        sale: { date: { gte: from, lte: to } },
        productId: { not: null },
        purchasePriceSnapshot: { not: null }
      },
      select: { quantity: true, unitPrice: true, purchasePriceSnapshot: true }
    })
  ])

  const totalRevenue = aggResult._sum.total?.toString() ?? '0'
  const saleCount = aggResult._count.id

  // Ganancia = Σ (precioVenta - precioCompra) × cantidad
  let profit = new Prisma.Decimal(0)
  for (const item of profitItems) {
    const margin = new Prisma.Decimal(item.unitPrice).sub(item.purchasePriceSnapshot!)
    profit = profit.add(margin.mul(item.quantity))
  }

  const averageTicket =
    saleCount === 0
      ? '0'
      : new Prisma.Decimal(totalRevenue).div(saleCount).toDecimalPlaces(2).toString()

  return {
    totalRevenue,
    saleCount,
    averageTicket,
    totalProfit: profit.toDecimalPlaces(2).toString()
  }
}

// ---------------------------------------------------------------------------
// Función 2: top productos por unidades vendidas
// ---------------------------------------------------------------------------

/**
 * Retorna los `limit` productos con más unidades vendidas en el período.
 */
export async function getTopProductsByQuantity(
  from: Date,
  to: Date,
  limit: number
): Promise<TopProductResult[]> {
  const grouped = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: { date: { gte: from, lte: to } },
      productId: { not: null }
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit
  })

  const productIds = grouped.map((g) => g.productId!)
  if (productIds.length === 0) return []

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true }
  })

  const nameMap = new Map<number, string>()
  for (const p of products) nameMap.set(p.id, p.name)

  return grouped.map((g) => ({
    productId: g.productId!,
    productName: nameMap.get(g.productId!) ?? 'Desconocido',
    value: (g._sum.quantity ?? 0).toString()
  }))
}

// ---------------------------------------------------------------------------
// Función 3: top productos por monto facturado
// ---------------------------------------------------------------------------

/**
 * Retorna los `limit` productos con mayor facturación (unitPrice × quantity) en el período.
 * Se agrupa en JS porque Prisma no permite `SUM(unitPrice * quantity)` directamente.
 */
export async function getTopProductsByRevenue(
  from: Date,
  to: Date,
  limit: number
): Promise<TopProductResult[]> {
  const items = await prisma.saleItem.findMany({
    where: {
      sale: { date: { gte: from, lte: to } },
      productId: { not: null }
    },
    select: { productId: true, quantity: true, unitPrice: true }
  })

  // Acumular revenue por producto
  const revenueMap = new Map<number, Prisma.Decimal>()
  for (const item of items) {
    const id = item.productId!
    const itemRevenue = new Prisma.Decimal(item.unitPrice).mul(item.quantity)
    revenueMap.set(id, (revenueMap.get(id) ?? new Prisma.Decimal(0)).add(itemRevenue))
  }

  if (revenueMap.size === 0) return []

  // Ordenar por revenue DESC y tomar los primeros `limit`
  const sorted = Array.from(revenueMap.entries())
    .sort(([, a], [, b]) => (b.greaterThan(a) ? 1 : b.lessThan(a) ? -1 : 0))
    .slice(0, limit)

  const topIds = sorted.map(([id]) => id)
  const products = await prisma.product.findMany({
    where: { id: { in: topIds } },
    select: { id: true, name: true }
  })
  const nameMap = new Map<number, string>()
  for (const p of products) nameMap.set(p.id, p.name)

  return sorted.map(([productId, revenue]) => ({
    productId,
    productName: nameMap.get(productId) ?? 'Desconocido',
    value: revenue.toDecimalPlaces(2).toString()
  }))
}

// ---------------------------------------------------------------------------
// Función 4: ventas agrupadas por hora del día
// ---------------------------------------------------------------------------

/**
 * Retorna cantidad de ventas y total facturado por cada hora (0–23) del período.
 * Solo aparecen las horas que tuvieron al menos una venta.
 */
export async function getSalesByHour(from: Date, to: Date): Promise<SalesByPeriodResult[]> {
  const sales = await prisma.sale.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true, total: true }
  })

  const byHour = new Map<number, { count: number; total: Prisma.Decimal }>()
  for (const sale of sales) {
    const h = sale.date.getHours()
    const prev = byHour.get(h) ?? { count: 0, total: new Prisma.Decimal(0) }
    byHour.set(h, { count: prev.count + 1, total: prev.total.add(sale.total) })
  }

  return Array.from(byHour.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, data]) => ({
      label: hour.toString().padStart(2, '0'),
      saleCount: data.count,
      totalRevenue: data.total.toDecimalPlaces(2).toString()
    }))
}

// ---------------------------------------------------------------------------
// Función 5: ventas agrupadas por día de semana
// ---------------------------------------------------------------------------

/**
 * Retorna cantidad de ventas y total facturado por día de semana (0=Dom, 6=Sáb).
 * Solo aparecen los días que tuvieron al menos una venta.
 */
export async function getSalesByWeekday(from: Date, to: Date): Promise<SalesByPeriodResult[]> {
  const sales = await prisma.sale.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true, total: true }
  })

  const byWeekday = new Map<number, { count: number; total: Prisma.Decimal }>()
  for (const sale of sales) {
    const d = sale.date.getDay()
    const prev = byWeekday.get(d) ?? { count: 0, total: new Prisma.Decimal(0) }
    byWeekday.set(d, { count: prev.count + 1, total: prev.total.add(sale.total) })
  }

  return Array.from(byWeekday.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekday, data]) => ({
      label: weekday.toString(),
      saleCount: data.count,
      totalRevenue: data.total.toDecimalPlaces(2).toString()
    }))
}

// ---------------------------------------------------------------------------
// Función 6: productos con menor rotación en el período
// ---------------------------------------------------------------------------

/**
 * Retorna los `limit` productos con menos unidades vendidas en el período.
 * Los productos sin ventas aparecen con totalQuantity = 0.
 */
export async function getLowRotationProducts(
  from: Date,
  to: Date,
  limit: number
): Promise<LowRotationResult[]> {
  const [allProducts, soldGroups] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true } }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { date: { gte: from, lte: to } },
        productId: { not: null }
      },
      _sum: { quantity: true }
    })
  ])

  const soldMap = new Map<number, number>()
  for (const g of soldGroups) {
    soldMap.set(g.productId!, g._sum.quantity ?? 0)
  }

  const results: LowRotationResult[] = allProducts.map((p) => ({
    productId: p.id,
    productName: p.name,
    totalQuantity: soldMap.get(p.id) ?? 0
  }))

  // Menor rotación primero (ASC)
  results.sort((a, b) => a.totalQuantity - b.totalQuantity)
  return results.slice(0, limit)
}
