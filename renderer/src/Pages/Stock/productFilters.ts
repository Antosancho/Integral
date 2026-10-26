import type { ProductFromApi } from '../../electron-api'
import { includesFolded } from '../../utils/text'
import { stockTone } from '../../utils/stock'

export type ProductSortKey = 'name' | 'salePrice' | 'stock'
export type ProductSort = { key: ProductSortKey; dir: 'asc' | 'desc' }

export type ProductFilters = {
  /** Texto libre: coincide con el nombre (sin tildes ni mayúsculas) o con parte del código de barras. */
  query: string
  /** null = todas las categorías. */
  categoryId: number | null
  /** Solo productos con stock bajo o negativo. */
  onlyLow: boolean
}

/** Filtra los productos de la tabla de Stock. No muta la lista original. */
export function filterProducts(list: ProductFromApi[], f: ProductFilters): ProductFromApi[] {
  const q = f.query.trim()
  return list.filter((p) => {
    if (f.categoryId !== null && p.categoryId !== f.categoryId) return false
    if (f.onlyLow && stockTone(p) === null) return false
    if (q !== '') {
      const byName = includesFolded(p.name, q)
      const byBarcode = p.barcode !== null && p.barcode.toString().includes(q)
      if (!byName && !byBarcode) return false
    }
    return true
  })
}

/** Ordena por la columna elegida. Devuelve una copia: no muta la lista original. */
export function sortProducts(list: ProductFromApi[], s: ProductSort): ProductFromApi[] {
  const sign = s.dir === 'asc' ? 1 : -1
  const compare = (a: ProductFromApi, b: ProductFromApi): number => {
    switch (s.key) {
      case 'name':
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
      case 'salePrice':
        return Number(a.salePrice) - Number(b.salePrice)
      case 'stock':
        return a.stock - b.stock
    }
  }
  return [...list].sort((a, b) => sign * compare(a, b))
}
