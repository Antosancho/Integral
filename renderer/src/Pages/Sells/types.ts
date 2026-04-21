import type { ProductFromApi } from '../../electron-api'

export type CartLine = {
  productId: number
  product: ProductFromApi
  quantity: number
  unitPrice: string
}

export type CartState = {
  lines: CartLine[]
}
