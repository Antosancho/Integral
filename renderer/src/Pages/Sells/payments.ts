export type PaymentMethod = 'CASH' | 'TRANSFER' | 'DEBIT' | 'CREDIT' | 'OTHER'

export const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'DEBIT',
  'CREDIT',
  'TRANSFER',
  'OTHER'
]

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'EFECTIVO',
  DEBIT: 'DÉBITO',
  CREDIT: 'CRÉDITO',
  TRANSFER: 'TRANSFERENCIA',
  OTHER: 'OTROS'
}

export type PaymentsDraft = Record<PaymentMethod, string>

export const initialPayments: PaymentsDraft = {
  CASH: '',
  DEBIT: '',
  CREDIT: '',
  TRANSFER: '',
  OTHER: ''
}

export const PAYMENT_EPSILON = 0.01

export function parsePaymentAmount(raw: string): number {
  if (raw == null) return 0
  const trimmed = String(raw).trim().replace(',', '.')
  if (trimmed === '') return 0
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
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

export function changeAmount(state: PaymentsDraft, total: number): number {
  return sumPayments(state) - total
}

export function autoFillFor(state: PaymentsDraft, method: PaymentMethod, total: number): number {
  const others = sumPaymentsExcluding(state, method)
  const missing = total - others
  return missing > 0 ? missing : 0
}

export function paymentsCoverTotal(state: PaymentsDraft, total: number): boolean {
  return sumPayments(state) >= total - PAYMENT_EPSILON
}

export function formatPaymentAmount(n: number): string {
  if (!Number.isFinite(n) || n === 0) return ''
  return Number(n.toFixed(2)).toString()
}
