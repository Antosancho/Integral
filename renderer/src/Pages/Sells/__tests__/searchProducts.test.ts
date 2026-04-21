import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import { searchProducts } from '../searchProducts'

const mockProduct = (id: number): ProductFromApi => ({
  id,
  name: `Producto ${id}`,
  barcode: BigInt(1000 + id),
  purchasePrice: '50.00',
  salePrice: '100.00',
  stock: 10,
  minStock: 0,
  createdAt: new Date(),
  categoryId: 1,
  supplierId: 1,
  category: { id: 1, name: 'Cat' },
  supplier: { id: 1, name: 'Prov', phone: null, notes: null }
})

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listProducts: vi.fn(),
    getProductByBarcode: vi.fn()
  }
})

describe('searchProducts', () => {
  it('query vacía devuelve [] sin llamar a la API', async () => {
    const result = await searchProducts('')
    expect(result).toEqual([])
    expect((window.api.listProducts as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
    expect((window.api.getProductByBarcode as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('query con sólo letras llama solo a listProducts, no a getProductByBarcode', async () => {
    const products = [mockProduct(1)]
    ;(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue(products)
    const result = await searchProducts('leche')
    expect(result).toEqual(products)
    expect((window.api.listProducts as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ nameContains: 'leche', take: 50 })
    expect((window.api.getProductByBarcode as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('query numérica llama a ambos; producto por barcode queda primero si es nuevo', async () => {
    const byNameProducts = [mockProduct(2)]
    const barcodeProduct = mockProduct(1)
    ;(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue(byNameProducts)
    ;(window.api.getProductByBarcode as ReturnType<typeof vi.fn>).mockResolvedValue(barcodeProduct)
    const result = await searchProducts('1234')
    expect(result[0]).toBe(barcodeProduct)
    expect(result).toHaveLength(2)
  })

  it('query numérica no duplica si el producto por barcode ya está en byName', async () => {
    const product = mockProduct(1)
    ;(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue([product])
    ;(window.api.getProductByBarcode as ReturnType<typeof vi.fn>).mockResolvedValue(product)
    const result = await searchProducts('1234')
    expect(result).toHaveLength(1)
  })

  it('getProductByBarcode tira error → no rompe, devuelve byName', async () => {
    const products = [mockProduct(1)]
    ;(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue(products)
    ;(window.api.getProductByBarcode as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('invalid'))
    const result = await searchProducts('9999')
    expect(result).toEqual(products)
  })

  it('query con espacios los trimmea antes de consultar', async () => {
    ;(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await searchProducts('  leche  ')
    expect((window.api.listProducts as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ nameContains: 'leche', take: 50 })
  })

  it('query mixta se trata como nombre (no llama a barcode)', async () => {
    ;(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await searchProducts('leche 1L')
    expect((window.api.getProductByBarcode as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})
