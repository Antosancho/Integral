import { ArrowLeftRight, Banknote, CreditCard, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatAmountInput } from '../../utils/format'
import { parseDecimal } from '../../utils/parse'

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'DEBIT' | 'CREDIT' | 'OTHER'

/** Medios de pago en el orden visual del panel (Alt+1…Alt+5 siguen este orden). */
export const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'DEBIT',
  'CREDIT',
  'TRANSFER',
  'OTHER'
]

/** Rótulos del panel de pago: en mayúsculas, como en la lámina de marca. */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'EFECTIVO',
  DEBIT: 'DÉBITO',
  CREDIT: 'CRÉDITO',
  TRANSFER: 'TRANSFERENCIA',
  OTHER: 'OTROS'
}

/** Nombres en sentence case para mostrar en historial y detalle de venta. */
export const PAYMENT_TITLE_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  TRANSFER: 'Transferencia',
  OTHER: 'Otros'
}

/** Ícono lucide de cada medio de pago. */
export const PAYMENT_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  DEBIT: CreditCard,
  CREDIT: CreditCard,
  TRANSFER: ArrowLeftRight,
  OTHER: Wallet
}

/** Texto (borrador) del monto tipeado en cada medio de pago. */
export type PaymentsDraft = Record<PaymentMethod, string>

export const initialPayments: PaymentsDraft = {
  CASH: '',
  DEBIT: '',
  CREDIT: '',
  TRANSFER: '',
  OTHER: ''
}

/** Tolerancia al comparar montos (medio centavo): evita errores de coma flotante. */
export const PAYMENT_EPSILON = 0.005

/**
 * Convierte el texto de un monto a número (convención es-AR: "10.000,00" → 10000).
 * Vacío, inválido o negativo → 0.
 */
export function parsePaymentAmount(raw: string): number {
  const n = parseDecimal(raw ?? '')
  return n === null || n < 0 ? 0 : n
}

export function sumPayments(state: PaymentsDraft): number {
  return PAYMENT_METHODS.reduce((acc, m) => acc + parsePaymentAmount(state[m]), 0)
}

export function sumPaymentsExcluding(state: PaymentsDraft, exclude: PaymentMethod): number {
  return PAYMENT_METHODS.reduce(
    (acc, m) => (m === exclude ? acc : acc + parsePaymentAmount(state[m])),
    0
  )
}

/** Vuelto con signo: Σpagos − total. Negativo = falta cubrir; 0 = exacto; positivo = vuelto. */
export function changeAmount(state: PaymentsDraft, total: number): number {
  return sumPayments(state) - total
}

/** true si los pagos cubren el total (con tolerancia de medio centavo). */
export function paymentsCoverTotal(state: PaymentsDraft, total: number): boolean {
  return sumPayments(state) >= total - PAYMENT_EPSILON
}

/**
 * Click en la etiqueta de un medio: suma al monto de ese medio lo que falta para cubrir el total.
 * Si ya está cubierto (o sobra), devuelve el mismo estado sin cambios.
 */
export function fillRemaining(state: PaymentsDraft, method: PaymentMethod, total: number): PaymentsDraft {
  const remaining = total - sumPayments(state)
  if (remaining <= PAYMENT_EPSILON) return state
  return { ...state, [method]: formatAmountInput(parsePaymentAmount(state[method]) + remaining) }
}

/**
 * Formatea el monto de un medio al salir del input: "20000" → "20.000,00".
 * Si no es un número mayor a 0, el campo se vacía.
 */
export function formatPaymentOnBlur(raw: string): string {
  const n = parseDecimal(raw)
  if (n === null || n <= 0) return ''
  return formatAmountInput(n)
}

export type ChangeState = { kind: 'due' | 'exact' | 'return'; amount: number }

/**
 * Estado del vuelto:
 *  - `due`: falta cubrir (`amount` = lo que falta, positivo);
 *  - `exact`: pago exacto (diferencia dentro de ±0,005);
 *  - `return`: hay que devolver `amount`.
 */
export function changeState(paid: number, total: number): ChangeState {
  const diff = paid - total
  if (diff < -PAYMENT_EPSILON) return { kind: 'due', amount: -diff }
  if (Math.abs(diff) <= PAYMENT_EPSILON) return { kind: 'exact', amount: 0 }
  return { kind: 'return', amount: diff }
}
