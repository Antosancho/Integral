import type { ProductFromApi } from '../../electron-api'

export async function searchProducts(query: string): Promise<ProductFromApi[]> {
  const q = query.trim()
  if (q === '') return []

  // Start name search immediately
  const namePromise = window.api.listProducts({ nameContains: q, take: 50 })

  // If the query is purely numeric, also try to fetch by barcode in parallel.
  // Keep the try/catch behaviour: barcode lookup may throw if not found/invalid.
  if (/^\d+$/.test(q)) {
    const barcodePromise = (async () => {
      try {
        return await window.api.getProductByBarcode(q)
      } catch {
        return null
      }
    })()

    const [byName, byBarcode] = await Promise.all([namePromise, barcodePromise])
    if (byBarcode && !byName.some(p => p.id === byBarcode.id)) {
      return [byBarcode, ...byName]
    }
    return byName
  }

  return await namePromise
}
