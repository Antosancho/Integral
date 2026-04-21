import type { ProductFromApi } from '../../electron-api'

export type ProductCartLine = {
  kind: 'product'
  lineId: string
  productId: number
  product: ProductFromApi
  quantity: number
  unitPrice: string
}

export type GeneralCartLine = {
  kind: 'general'
  lineId: string
  quantity: number
  unitPrice: string
}

export type CartLine = ProductCartLine | GeneralCartLine

export type CartState = {
  lines: CartLine[]
}