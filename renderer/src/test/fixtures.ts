import type { ProductFromApi } from '../electron-api'

/**
 * Producto de prueba válido. Los defaults representan un producto "normal" (stock sano, con precio);
 * cada test pisa solo lo que le importa.
 */
export function makeProduct(o: Partial<ProductFromApi> = {}): ProductFromApi {
  return {
    id: 1,
    name: 'Producto 1',
    barcode: 7790000000001n,
    purchasePrice: '500',
    salePrice: '1000',
    stock: 10,
    minStock: 2,
    createdAt: new Date(2026, 0, 1),
    categoryId: 1,
    supplierId: 1,
    category: { id: 1, name: 'Almacén' },
    supplier: { id: 1, name: 'Distribuidora Sur', phone: null, notes: null },
    ...o,
  }
}
