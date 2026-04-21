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
  it('ADD agrega nueva línea con quantity=1 cuando el carrito está vacío', () => {
    const next = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    expect(next.lines).toHaveLength(1)
    expect(next.lines[0].quantity).toBe(1)
    expect(next.lines[0].productId).toBe(1)
  })

  it('ADD incrementa quantity en +1 cuando el producto ya existe', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'ADD', product: mockProduct(1) })
    expect(next.lines).toHaveLength(1)
    expect(next.lines[0].quantity).toBe(2)
  })

  it('ADD agrega como fila nueva un producto distinto y mantiene la anterior', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'ADD', product: mockProduct(2) })
    expect(next.lines).toHaveLength(2)
    expect(next.lines.find(l => l.productId === 1)).toBeDefined()
    expect(next.lines.find(l => l.productId === 2)).toBeDefined()
  })

  it('REMOVE elimina la línea correspondiente y deja intactas las demás', () => {
    let state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    state = cartReducer(state, { type: 'ADD', product: mockProduct(2) })
    const next = cartReducer(state, { type: 'REMOVE', productId: 1 })
    expect(next.lines).toHaveLength(1)
    expect(next.lines[0].productId).toBe(2)
  })

  it('REMOVE con productId inexistente no cambia el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'REMOVE', productId: 99 })
    expect(next.lines).toHaveLength(1)
  })

  it('SET_QUANTITY con valor positivo actualiza la cantidad', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_QUANTITY', productId: 1, quantity: 5 })
    expect(next.lines[0].quantity).toBe(5)
  })

  it('SET_QUANTITY con 0 elimina la línea', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_QUANTITY', productId: 1, quantity: 0 })
    expect(next.lines).toHaveLength(0)
  })

  it('SET_QUANTITY con -3 elimina la línea', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_QUANTITY', productId: 1, quantity: -3 })
    expect(next.lines).toHaveLength(0)
  })

  it('SET_QUANTITY con NaN no modifica el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_QUANTITY', productId: 1, quantity: NaN })
    expect(next).toBe(state)
  })

  it('SET_QUANTITY con 2.7 guarda 2 (Math.floor)', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_QUANTITY', productId: 1, quantity: 2.7 })
    expect(next.lines[0].quantity).toBe(2)
  })

  it('SET_UNIT_PRICE con string vacío deja unitPrice vacío en la línea', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_UNIT_PRICE', productId: 1, unitPrice: '' })
    expect(next.lines[0].unitPrice).toBe('')
  })

  it('SET_UNIT_PRICE con "150.50" actualiza el precio', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_UNIT_PRICE', productId: 1, unitPrice: '150.50' })
    expect(next.lines[0].unitPrice).toBe('150.50')
  })

  it('SET_UNIT_PRICE con "-1" no cambia el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_UNIT_PRICE', productId: 1, unitPrice: '-1' })
    expect(next).toBe(state)
  })

  it('SET_UNIT_PRICE con "abc" no cambia el estado', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_UNIT_PRICE', productId: 1, unitPrice: 'abc' })
    expect(next).toBe(state)
  })

  it('lineTotal devuelve quantity * Number(unitPrice) con precio válido', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const line = state.lines[0]
    expect(lineTotal(line)).toBe(100)
  })

  it('lineTotal devuelve 0 cuando unitPrice es vacío', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'SET_UNIT_PRICE', productId: 1, unitPrice: '' })
    expect(lineTotal(next.lines[0])).toBe(0)
  })

  it('Inmutabilidad: el estado devuelto es distinto al de entrada cuando cambia', () => {
    const state = cartReducer(initialCart, { type: 'ADD', product: mockProduct(1) })
    const next = cartReducer(state, { type: 'ADD', product: mockProduct(1) })
    expect(next).not.toBe(state)
    expect(next.lines).not.toBe(state.lines)
  })
})

describe('cartReducer estado inicial', () => {
  it('initialCart tiene lines vacío', () => {
    expect(initialCart.lines).toHaveLength(0)
  })
})
