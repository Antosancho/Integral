import { describe, it, expect } from 'vitest'
import { buildSaleItems } from '../confirmSaleUtils'

// Minimal mocks for cart lines
const productLine = {
  kind: 'product' as const,
  lineId: '1',
  productId: 5,
  product: { id: 5, name: 'P', barcode: null, purchasePrice: '0', salePrice: '100', stock: 10, minStock: 0, createdAt: new Date(), categoryId: 1, supplierId: 1 },
  quantity: 2,
  unitPrice: '100'
}

const generalLine = {
  kind: 'general' as const,
  lineId: 'g1',
  quantity: 1,
  unitPrice: '500'
}

describe('buildSaleItems', () => {
  it("product line maps to item with productId", () => {
    const res = buildSaleItems([productLine as any])
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ productId: 5, quantity: 2, unitPrice: '100' })
  })

  it('general line maps to item without productId', () => {
    const res = buildSaleItems([generalLine as any])
    expect(res).toHaveLength(1)
    expect('productId' in res[0]).toBe(false)
    expect(res[0]).toMatchObject({ quantity: 1, unitPrice: '500' })
  })

  it('mixed cart produces both kinds', () => {
    const res = buildSaleItems([productLine as any, generalLine as any])
    expect(res).toHaveLength(2)
    expect(res[0]).toMatchObject({ productId: 5 })
    expect('productId' in res[1]).toBe(false)
  })

  it('multiple general lines preserved', () => {
    const res = buildSaleItems([generalLine as any, { ...generalLine, lineId: 'g2', unitPrice: '200' }])
    expect(res).toHaveLength(2)
    expect('productId' in res[0]).toBe(false)
    expect('productId' in res[1]).toBe(false)
  })

  it('empty cart -> empty array', () => {
    expect(buildSaleItems([])).toEqual([])
  })
})
