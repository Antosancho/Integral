import type { StockMovementFromApi } from '../electron-api'

/**
 * Ordena lotes vivos para mostrarlos en UI:
 * primero los que tienen vencimiento, de mas cercano a mas lejano,
 * y al final los lotes sin vencimiento, con los mas recientes arriba.
 */
export function sortLots(lots: StockMovementFromApi[]): StockMovementFromApi[] {
  const withExpiry = lots
    .filter((lot) => lot.expiryDate !== null)
    .slice()
    .sort((a, b) => a.expiryDate!.getTime() - b.expiryDate!.getTime())

  const withoutExpiry = lots
    .filter((lot) => lot.expiryDate === null)
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  return [...withExpiry, ...withoutExpiry]
}

/**
 * Agrupa lotes por producto y deja cada grupo ordenado con la misma regla
 * que usa la tabla principal y el buscador.
 */
export function groupLotsByProduct(
  lots: StockMovementFromApi[]
): Map<number, StockMovementFromApi[]> {
  const grouped = new Map<number, StockMovementFromApi[]>()

  for (const lot of lots) {
    const productLots = grouped.get(lot.productId) ?? []
    productLots.push(lot)
    grouped.set(lot.productId, productLots)
  }

  for (const [productId, productLots] of grouped) {
    grouped.set(productId, sortLots(productLots))
  }

  return grouped
}
