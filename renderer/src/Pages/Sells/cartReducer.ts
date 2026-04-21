import type { ProductFromApi } from '../../electron-api'
import { validateGeneralAmount } from './amount'
import { newLineId } from './lineId'
import type { CartLine, CartState, GeneralCartLine, ProductCartLine } from './types'

export type CartAction =
  | { type: 'ADD'; product: ProductFromApi }
  | { type: 'REMOVE'; lineId: string }
  | { type: 'SET_QUANTITY'; lineId: string; quantity: number }
  | { type: 'SET_UNIT_PRICE'; lineId: string; unitPrice: string }
  | { type: 'ADD_GENERAL'; amount: string }

export const initialCart: CartState = { lines: [] }

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const exists = state.lines.find(
        (l): l is ProductCartLine => l.kind === 'product' && l.productId === action.product.id
      )
      if (exists) {
        return {
          lines: state.lines.map(l =>
            l.kind === 'product' && l.productId === action.product.id
              ? { ...l, quantity: l.quantity + 1 }
              : l
          )
        }
      }
      return {
        lines: [
          ...state.lines,
          {
            kind: 'product',
            lineId: newLineId(),
            productId: action.product.id,
            product: action.product,
            quantity: 1,
            unitPrice: action.product.salePrice
          }
        ]
      }
    }

    case 'REMOVE':
      return { lines: state.lines.filter(l => l.lineId !== action.lineId) }

    case 'SET_QUANTITY': {
      const { lineId, quantity } = action
      if (!Number.isFinite(quantity)) return state
      if (quantity < 1) return cartReducer(state, { type: 'REMOVE', lineId })
      return {
        lines: state.lines.map(l =>
          l.lineId === lineId
            ? { ...l, quantity: Math.floor(quantity) }
            : l
        )
      }
    }

    case 'SET_UNIT_PRICE': {
      const { lineId, unitPrice } = action
      if (unitPrice !== '' && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) {
        return state
      }
      return {
        lines: state.lines.map(l =>
          l.lineId === lineId ? { ...l, unitPrice } : l
        )
      }
    }

    case 'ADD_GENERAL': {
      const result = validateGeneralAmount(action.amount)
      if (!result.ok) return state
      const newLine: GeneralCartLine = {
        kind: 'general',
        lineId: newLineId(),
        quantity: 1,
        unitPrice: result.value
      }
      return { lines: [...state.lines, newLine] }
    }
  }
}

export function lineTotal(line: CartLine): number {
  const price = Number(line.unitPrice)
  if (!Number.isFinite(price)) return 0
  return price * line.quantity
}