/**
 * Reglas de presentación del stock de un producto.
 */

/** Tono visual del stock: `negative` = por debajo de 0, `low` = en o bajo el mínimo, `null` = normal. */
export type StockTone = 'negative' | 'low' | null

/** negativo si stock < 0; bajo si 0 <= stock <= minStock; si no, null. */
export function stockTone(p: { stock: number; minStock: number }): StockTone {
  if (p.stock < 0) return 'negative'
  if (p.stock <= p.minStock) return 'low'
  return null
}

/** true si el precio de venta es un número finito mayor a 0 (condición para poder vender el producto). */
export function hasValidSalePrice(p: { salePrice: string }): boolean {
  const n = Number(p.salePrice)
  return Number.isFinite(n) && n > 0
}
