import { describe, expect, it } from 'vitest'
import type { BareProductFromApi, StockMovementFromApi } from '../../electron-api'
import { groupLotsByProduct, sortLots } from '../lots'

const product: BareProductFromApi = {
  id: 1,
  name: 'Producto test',
  barcode: null,
  purchasePrice: '10',
  salePrice: '20',
  stock: 10,
  minStock: 0,
  createdAt: new Date(2026, 0, 1),
  categoryId: 1,
  supplierId: 1
}

function lot(overrides: Partial<StockMovementFromApi>): StockMovementFromApi {
  const productId = overrides.productId ?? product.id

  return {
    id: overrides.id ?? productId * 100,
    productId,
    type: 'IN',
    quantity: overrides.quantity ?? 1,
    date: overrides.date ?? new Date(2026, 0, 1),
    notes: null,
    appliedDelta: null,
    saleId: null,
    expiryDate: overrides.expiryDate ?? null,
    expiryDismissedAt: null,
    product: {
      ...product,
      id: productId,
      name: `Producto ${productId}`
    },
    ...overrides
  }
}

describe('sortLots', () => {
  it('devuelve [] cuando recibe un array vacio', () => {
    expect(sortLots([])).toEqual([])
  })

  it('ordena lotes con vencimiento en forma ascendente por expiryDate', () => {
    const input = [
      lot({ id: 1, expiryDate: new Date(2026, 5, 1) }),
      lot({ id: 2, expiryDate: new Date(2026, 0, 1) }),
      lot({ id: 3, expiryDate: new Date(2026, 2, 1) })
    ]

    expect(sortLots(input).map((l) => l.id)).toEqual([2, 3, 1])
  })

  it('ordena lotes sin vencimiento por fecha de carga descendente', () => {
    const input = [
      lot({ id: 1, date: new Date(2026, 0, 1) }),
      lot({ id: 2, date: new Date(2026, 0, 3) }),
      lot({ id: 3, date: new Date(2026, 0, 2) })
    ]

    expect(sortLots(input).map((l) => l.id)).toEqual([2, 3, 1])
  })

  it('ubica primero los lotes con vencimiento y luego los sin vencimiento', () => {
    const input = [
      lot({ id: 1, date: new Date(2026, 0, 4) }),
      lot({ id: 2, expiryDate: new Date(2026, 0, 5) }),
      lot({ id: 3, expiryDate: new Date(2026, 0, 2) }),
      lot({ id: 4, date: new Date(2026, 0, 6) })
    ]

    const sorted = sortLots(input)

    expect(sorted.map((l) => l.id)).toEqual([3, 2, 4, 1])
    expect(sorted.slice(0, 2).every((l) => l.expiryDate !== null)).toBe(true)
    expect(sorted.slice(2).every((l) => l.expiryDate === null)).toBe(true)
  })

  it('mantiene contiguos los lotes que empatan en expiryDate', () => {
    const sameDate = new Date(2026, 4, 1)
    const sorted = sortLots([
      lot({ id: 1, expiryDate: new Date(2026, 5, 1) }),
      lot({ id: 2, expiryDate: sameDate }),
      lot({ id: 3, expiryDate: sameDate }),
      lot({ id: 4, date: new Date(2026, 0, 1) })
    ])

    expect(sorted.map((l) => l.id).slice(0, 3)).toEqual(expect.arrayContaining([1, 2, 3]))
    expect(Math.abs(sorted.findIndex((l) => l.id === 2) - sorted.findIndex((l) => l.id === 3))).toBe(1)
  })

  it('no muta el array de entrada', () => {
    const input = [
      lot({ id: 1, expiryDate: new Date(2026, 5, 1) }),
      lot({ id: 2, expiryDate: new Date(2026, 0, 1) })
    ]
    const before = input.map((l) => l.id)

    sortLots(input)

    expect(input.map((l) => l.id)).toEqual(before)
  })
})

describe('groupLotsByProduct', () => {
  it('agrupa por productId y ordena cada grupo', () => {
    const grouped = groupLotsByProduct([
      lot({ id: 1, productId: 1, expiryDate: new Date(2026, 5, 1) }),
      lot({ id: 2, productId: 1, expiryDate: new Date(2026, 0, 1) }),
      lot({ id: 3, productId: 2, date: new Date(2026, 0, 1) }),
      lot({ id: 4, productId: 2, date: new Date(2026, 0, 3) }),
      lot({ id: 5, productId: 3, expiryDate: new Date(2026, 2, 1) })
    ])

    expect(grouped.size).toBe(3)
    expect(grouped.get(1)?.map((l) => l.id)).toEqual([2, 1])
    expect(grouped.get(2)?.map((l) => l.id)).toEqual([4, 3])
    expect(grouped.get(3)?.map((l) => l.id)).toEqual([5])
  })
})
