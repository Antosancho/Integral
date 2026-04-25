import { describe, it, expect } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import { cartReducer, initialCart, lineTotal } from '../cartReducer'
import type { CartState } from '../types'

const mockProduct = (id: number, overrides: Partial<ProductFromApi> = {}): ProductFromApi => ({
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
  supplier: { id: 1, name: 'Prov', phone: null, notes: null },
  ...overrides
})

describe('cartReducer', () => {
  describe('ADD', () => {
    it('agrega nueva línea con quantity=1 y kind=product cuando el carrito está vacío', () => {
      const next = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      expect(next.lines).toHaveLength(1)
      expect(next.lines[0].quantity).toBe(1)
      expect(next.lines[0].kind).toBe('product')
      expect((next.lines[0]).productId).toBe(1)
      expect(typeof next.lines[0].lineId).toBe('string')
      expect(next.lines[0].lineId.length).toBeGreaterThan(0)
    })

    it('incrementa quantity en +1 cuando el producto ya existe preservando el lineId', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const firstLineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'ADD', product: mockProduct(1) })
      expect(next.lines).toHaveLength(1)
      expect(next.lines[0].quantity).toBe(2)
      expect(next.lines[0].lineId).toBe(firstLineId)
    })

    it('agrega como fila nueva un producto distinto y mantiene la anterior', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const next = cartReducer(state, { type: 'ADD', product: mockProduct(2) })
      expect(next.lines).toHaveLength(2)
      expect(next.lines.find(l => l.kind === 'product' && l.productId === 1)).toBeDefined()
      expect(next.lines.find(l => l.kind === 'product' && l.productId === 2)).toBeDefined()
    })
  })

  describe('REMOVE', () => {
    it('elimina la línea correspondiente por lineId y deja intactas las demás', () => {
      let state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      state = cartReducer(state, { type: 'ADD', product: mockProduct(2) })
      const lineIdToRemove = state.lines.find(l => l.kind === 'product' && l.productId === 1)!.lineId
      const next = cartReducer(state, { type: 'REMOVE', lineId: lineIdToRemove })
      expect(next.lines).toHaveLength(1)
      expect(next.lines[0].productId).toBe(2)
    })

    it('con lineId inexistente no cambia el estado', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const next = cartReducer(state, { type: 'REMOVE', lineId: 'inexistente' })
      expect(next.lines).toHaveLength(1)
    })
  })

  describe('SET_QUANTITY', () => {
    it('con valor positivo actualiza la cantidad', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_QUANTITY', lineId, quantity: 5 })
      expect(next.lines[0].quantity).toBe(5)
    })

    it('con 0 elimina la línea', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_QUANTITY', lineId, quantity: 0 })
      expect(next.lines).toHaveLength(0)
    })

    it('con -3 elimina la línea', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_QUANTITY', lineId, quantity: -3 })
      expect(next.lines).toHaveLength(0)
    })

    it('con NaN no modifica el estado', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_QUANTITY', lineId, quantity: NaN })
      expect(next).toBe(state)
    })

    it('con 2.7 guarda 2 (Math.floor)', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_QUANTITY', lineId, quantity: 2.7 })
      expect(next.lines[0].quantity).toBe(2)
    })
  })

  describe('SET_UNIT_PRICE', () => {
    it('con string vacío deja unitPrice vacío en la línea', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_UNIT_PRICE', lineId, unitPrice: '' })
      expect(next.lines[0].unitPrice).toBe('')
    })

    it('con "150.50" actualiza el precio', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_UNIT_PRICE', lineId, unitPrice: '150.50' })
      expect(next.lines[0].unitPrice).toBe('150.50')
    })

    it('con "-1" no cambia el estado', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_UNIT_PRICE', lineId, unitPrice: '-1' })
      expect(next).toBe(state)
    })

    it('con "abc" no cambia el estado', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_UNIT_PRICE', lineId, unitPrice: 'abc' })
      expect(next).toBe(state)
    })
  })

  describe('lineTotal', () => {
    it('devuelve quantity * Number(unitPrice) con precio válido', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const line = state.lines[0]
      expect(lineTotal(line)).toBe(100)
    })

    it('devuelve 0 cuando unitPrice es vacío', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const lineId = state.lines[0].lineId
      const next = cartReducer(state, { type: 'SET_UNIT_PRICE', lineId, unitPrice: '' })
      expect(lineTotal(next.lines[0])).toBe(0)
    })
  })

  describe('inmutabilidad', () => {
    it('el estado devuelto es distinto al de entrada cuando cambia', () => {
      const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
      const next = cartReducer(state, { type: 'ADD', product: mockProduct(1) })
      expect(next).not.toBe(state)
      expect(next.lines).not.toBe(state.lines)
    })
  })
})

describe('ADD_GENERAL', () => {
  it('agrega una fila general con kind=general, quantity=1, unitPrice=value', () => {
    const next = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '500' })
    expect(next.lines).toHaveLength(1)
    expect(next.lines[0].kind).toBe('general')
    expect(next.lines[0].quantity).toBe(1)
    expect(next.lines[0].unitPrice).toBe('500')
    expect(typeof next.lines[0].lineId).toBe('string')
    expect(next.lines[0].lineId.length).toBeGreaterThan(0)
  })

  it('con coma decimal normaliza a punto', () => {
    const next = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '150,50' })
    expect(next.lines[0].unitPrice).toBe('150.50')
    expect(lineTotal(next.lines[0])).toBeCloseTo(150.5, 2)
  })

  it('dos invocaciones con mismo amount crean dos filas independientes', () => {
    let state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '100' })
    state = cartReducer(state, { type: 'ADD_GENERAL', amount: '100' })
    expect(state.lines).toHaveLength(2)
    expect(state.lines[0].lineId).not.toBe(state.lines[1].lineId)
  })

  it('con amount=0 no modifica el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '0' })
    expect(state.lines).toHaveLength(0)
  })

  it('con amount=-10 no modifica el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '-10' })
    expect(state.lines).toHaveLength(0)
  })

  it('con amount vacío no modifica el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '' })
    expect(state.lines).toHaveLength(0)
  })

  it('con amount=abc no modifica el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: 'abc' })
    expect(state.lines).toHaveLength(0)
  })

  it('una fila general es eliminable por su lineId', () => {
    let state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '500' })
    const lineId = state.lines[0].lineId
    state = cartReducer(state, { type: 'REMOVE', lineId })
    expect(state.lines).toHaveLength(0)
  })

  it('SET_QUANTITY funciona sobre fila general', () => {
    let state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '500' })
    const lineId = state.lines[0].lineId
    state = cartReducer(state, { type: 'SET_QUANTITY', lineId, quantity: 3 })
    expect(state.lines[0].quantity).toBe(3)
  })

  it('SET_UNIT_PRICE funciona sobre fila general', () => {
    let state = cartReducer(initialCart, { type: 'ADD_GENERAL', amount: '500' })
    const lineId = state.lines[0].lineId
    state = cartReducer(state, { type: 'SET_UNIT_PRICE', lineId, unitPrice: '200' })
    expect(state.lines[0].unitPrice).toBe('200')
  })

  it('ADD (producto) y ADD_GENERAL coexisten sin interferirse', () => {
    let state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    state = cartReducer(state, { type: 'ADD_GENERAL', amount: '500' })
    expect(state.lines).toHaveLength(2)
    const productLine = state.lines.find(l => l.kind === 'product')!
    const generalLine = state.lines.find(l => l.kind === 'general')!
    expect(productLine.productId).toBe(1)
    expect(generalLine.unitPrice).toBe('500')
    state = cartReducer(state, { type: 'REMOVE', lineId: productLine.lineId })
    expect(state.lines).toHaveLength(1)
    expect(state.lines[0].kind).toBe('general')
  })
})
describe('RESET', () => {
  it('vuelve al estado inicial vacío desde un carrito con líneas', () => {
    const a = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const b = cartReducer(a, { type: 'ADD', product: mockProduct(2) })
    const reset = cartReducer(b, { type: 'RESET' })
    expect(reset.lines).toHaveLength(0)
    expect(reset).toEqual(initialCart)
  })

  it('idempotente: RESET sobre carrito vacío sigue vacío', () => {
    const reset = cartReducer(initialCart, { type: 'RESET' })
    expect(reset.lines).toHaveLength(0)
  })
})
