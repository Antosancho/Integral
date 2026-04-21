import type { ProductFromApi } from '../../electron-api'

export async function searchProducts(query: string): Promise<ProductFromApi[]> {
  if (query.trim() === '') return []

  const byName = await window.api.listProducts({ nameContains: query.trim(), take: 50 })

  if (/^\d+$/.test(query.trim())) {
    try {
      const byBarcode = await window.api.getProductByBarcode(query.trim())
      if (byBarcode && !byName.some(p => p.id === byBarcode.id)) {
        return [byBarcode, ...byName]
      }
    } catch {
      // ignorar error de barcode inválido
    }
  }

  return byName
}
