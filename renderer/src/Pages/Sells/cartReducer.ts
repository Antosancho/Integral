import type { ProductFromApi } from '../../electron-api'
import type { CartLine, CartState } from './types'

export type CartAction =
  | { type: 'ADD'; product: ProductFromApi }
  | { type: 'REMOVE'; productId: number }
  | { type: 'SET_QUANTITY'; productId: number; quantity: number }
  | { type: 'SET_UNIT_PRICE'; productId: number; unitPrice: string }

export const initialCart: CartState = { lines: [] }

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD': {
      const exists = state.lines.find(l => l.productId === action.product.id)
      if (exists) {
        return {
          lines: state.lines.map(l =>
            l.productId === action.product.id
              ? { ...l, quantity: l.quantity + 1 }
              : l
          )
        }
      }
      return {
        lines: [
          ...state.lines,
          {
            productId: action.product.id,
            product: action.product,
            quantity: 1,
            unitPrice: action.product.salePrice
          }
        ]
      }
    }

    case 'REMOVE':
      return { lines: state.lines.filter(l => l.productId !== action.productId) }

    case 'SET_QUANTITY': {
      const { productId, quantity } = action
      if (!Number.isFinite(quantity)) return state
      if (quantity < 1) return cartReducer(state, { type: 'REMOVE', productId })
      return {
        lines: state.lines.map(l =>
          l.productId === productId
            ? { ...l, quantity: Math.floor(quantity) }
            : l
        )
      }
    }

    case 'SET_UNIT_PRICE': {
      const { productId, unitPrice } = action
      if (unitPrice !== '' && (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0)) {
        return state
      }
      return {
        lines: state.lines.map(l =>
          l.productId === productId ? { ...l, unitPrice } : l
        )
      }
    }
  }
}

export function lineTotal(line: CartLine): number {
  const price = Number(line.unitPrice)
  if (!Number.isFinite(price)) return 0
  return price * line.quantity
}
