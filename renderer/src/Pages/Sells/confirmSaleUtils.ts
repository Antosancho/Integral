import type { CartLine } from './types'

export type CreateSaleItemPayload = {
  productId?: number
  quantity: number
  unitPrice: number | string
}

/**
 * Build the payload items array that will be sent to the backend when confirming a sale.
 * - 'product' lines include productId
 * - 'general' lines omit productId
 */
export function buildSaleItems(lines: CartLine[]): CreateSaleItemPayload[] {
  return lines.map(l =>
    l.kind === 'product'
      ? { productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice }
      : { quantity: l.quantity, unitPrice: l.unitPrice }
  )
}

export default buildSaleItems
