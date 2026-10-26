import { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react'
import { cartReducer, initialCart } from '../Pages/Sells/cartReducer'
import type { CartAction } from '../Pages/Sells/cartReducer'
import { initialPayments } from '../Pages/Sells/payments'
import type { PaymentsDraft } from '../Pages/Sells/payments'
import type { CartState } from '../Pages/Sells/types'

type SalesContextValue = {
  cart: CartState
  dispatchCart: React.Dispatch<CartAction>
  /** Porcentaje de descuento (positivo) o recargo (negativo) sobre el subtotal. */
  discountPct: number
  setDiscountPct: (n: number) => void
  /** Borradores (texto) de los montos de cada medio de pago. */
  payments: PaymentsDraft
  setPayments: React.Dispatch<React.SetStateAction<PaymentsDraft>>
  /** Vacía carrito, descuento a 0 y pagos a ''. */
  resetSale: () => void
}

const SalesContext = createContext<SalesContextValue | null>(null)

/**
 * Store de la venta en curso, por encima de las pantallas.
 *
 * Guarda carrito, descuento y pagos fuera de `Sells` para que sobrevivan a cambiar de sección
 * (Stock, Estadísticas) o de sub-vista (Historial): el cajero no pierde la venta por un click accidental.
 */
export function SalesProvider({ children }: { children: React.ReactNode }) {
  const [cart, dispatchCart] = useReducer(cartReducer, initialCart)
  const [discountPct, setDiscountPct] = useState(0)
  const [payments, setPayments] = useState<PaymentsDraft>(initialPayments)

  const resetSale = useCallback(() => {
    dispatchCart({ type: 'RESET' })
    setDiscountPct(0)
    setPayments(initialPayments)
  }, [])

  const value = useMemo<SalesContextValue>(
    () => ({ cart, dispatchCart, discountPct, setDiscountPct, payments, setPayments, resetSale }),
    [cart, discountPct, payments, resetSale],
  )

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>
}

/** Acceso a la venta en curso. Lanza si se usa fuera de `SalesProvider`. */
export function useSales(): SalesContextValue {
  const ctx = useContext(SalesContext)
  if (!ctx) throw new Error('useSales fuera de SalesProvider')
  return ctx
}
