import { describe, it, expect } from 'vitest'
import { computeCaja, type CajaResult } from '../cajaUtils'
import type { SaleFromApi } from '../../../electron-api'

function makeSale(overrides: Partial<SaleFromApi> = {}): SaleFromApi {
  return {
    id: 1,
    date: new Date('2024-03-15T14:00:00'),
    total: '1000',
    discountPct: '0',
    items: [],
    payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1000' }],
    ...overrides
  }
}

describe('computeCaja', () => {
  it('returns zero total and empty byMethod for empty sales array', () => {
    const result: CajaResult = computeCaja([])
    expect(result.total).toBe(0)
    expect(result.byMethod).toEqual([])
  })

  it('calculates total and byMethod for one sale with CASH payment', () => {
    const sales = [makeSale({ total: '5000', payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '5000' }] })]
    const result: CajaResult = computeCaja(sales)
    expect(result.total).toBe(5000)
    expect(result.byMethod).toEqual([
      { method: 'CASH', label: 'EFECTIVO', amount: 5000 }
    ])
  })

  it('calculates total and byMethod for one sale with multiple payment methods', () => {
    const sales = [makeSale({
      total: '3000',
      payments: [
        { id: 1, saleId: 1, method: 'CASH', amount: '1000' },
        { id: 2, saleId: 1, method: 'TRANSFER', amount: '2000' }
      ]
    })]
    const result: CajaResult = computeCaja(sales)
    expect(result.total).toBe(3000)
    expect(result.byMethod).toEqual([
      { method: 'CASH', label: 'EFECTIVO', amount: 1000 },
      { method: 'TRANSFER', label: 'TRANSFERENCIA', amount: 2000 }
    ])
  })

  it('sums correctly payments of same method across multiple sales', () => {
    const sales = [
      makeSale({ id: 1, total: '1500', payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1500' }] }),
      makeSale({ id: 2, total: '2500', payments: [{ id: 2, saleId: 2, method: 'CASH', amount: '2500' }] })
    ]
    const result: CajaResult = computeCaja(sales)
    expect(result.total).toBe(4000)
    expect(result.byMethod).toEqual([
      { method: 'CASH', label: 'EFECTIVO', amount: 4000 }
    ])
  })

  it('excludes payment methods with zero amount', () => {
    const sales = [
      makeSale({ id: 1, total: '1000', payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1000' }] }),
      makeSale({ id: 2, total: '2000', payments: [{ id: 2, saleId: 2, method: 'CASH', amount: '2000' }] })
    ]
    const result: CajaResult = computeCaja(sales)
    // Should only have CASH, not DEBIT, CREDIT, TRANSFER, OTHER
    expect(result.byMethod).toHaveLength(1)
    expect(result.byMethod[0].method).toBe('CASH')
    expect(result.byMethod[0].amount).toBe(3000)
  })

  it('maintains order of byMethod according to PAYMENT_LABELS', () => {
    const sales = [makeSale({
      total: '1000',
      payments: [
        { id: 1, saleId: 1, method: 'OTHER', amount: '200' },
        { id: 2, saleId: 1, method: 'CASH', amount: '800' }
      ]
    })]
    const result: CajaResult = computeCaja(sales)
    // Should be CASH first, then OTHER (fallback)
    expect(result.byMethod).toEqual([
      { method: 'CASH', label: 'EFECTIVO', amount: 800 },
      { method: 'OTHER', label: 'OTHER', amount: 200 }
    ])
  })

  it('handles decimal amounts correctly', () => {
    const sales = [makeSale({
      total: '1234.56',
      payments: [
        { id: 1, saleId: 1, method: 'CASH', amount: '600.25' },
        { id: 2, saleId: 1, method: 'DEBIT', amount: '634.31' }
      ]
    })]
    const result: CajaResult = computeCaja(sales)
    expect(result.total).toBeCloseTo(1234.56)
    expect(result.byMethod).toEqual([
      { method: 'CASH', label: 'EFECTIVO', amount: 600.25 },
      { method: 'DEBIT', label: 'DÉBITO', amount: 634.31 }
    ])
  })
})