import { describe, it, expect } from 'vitest'
import {
  PAYMENT_METHODS,
  PAYMENT_LABELS,
  initialPayments,
  parsePaymentAmount,
  sumPayments,
  sumPaymentsExcluding,
  changeAmount,
  autoFillFor,
  paymentsCoverTotal,
  formatPaymentAmount
} from '../payments'

describe('payments — constantes', () => {
  it('tiene los 5 métodos en el orden visual del esquema', () => {
    expect(PAYMENT_METHODS).toEqual(['CASH', 'DEBIT', 'CREDIT', 'TRANSFER', 'OTHER'])
  })

  it('cada método tiene un label en español en MAYÚSCULAS', () => {
    expect(PAYMENT_LABELS.CASH).toBe('EFECTIVO')
    expect(PAYMENT_LABELS.DEBIT).toBe('DÉBITO')
    expect(PAYMENT_LABELS.CREDIT).toBe('CRÉDITO')
    expect(PAYMENT_LABELS.TRANSFER).toBe('TRANSFERENCIA')
    expect(PAYMENT_LABELS.OTHER).toBe('OTROS')
  })

  it('initialPayments tiene todos los métodos como string vacío', () => {
    PAYMENT_METHODS.forEach(m => expect(initialPayments[m]).toBe(''))
  })
})

describe('payments — parsePaymentAmount', () => {
  it('vacío o solo espacios → 0', () => {
    expect(parsePaymentAmount('')).toBe(0)
    expect(parsePaymentAmount('   ')).toBe(0)
  })
  it('admite punto decimal', () => {
    expect(parsePaymentAmount('1500.50')).toBe(1500.5)
  })
  it('admite coma decimal (es-AR)', () => {
    expect(parsePaymentAmount('1500,50')).toBe(1500.5)
  })
  it('texto inválido → 0', () => {
    expect(parsePaymentAmount('abc')).toBe(0)
  })
  it('número negativo → 0', () => {
    expect(parsePaymentAmount('-50')).toBe(0)
  })
})

describe('payments — sumPayments / sumPaymentsExcluding', () => {
  it('suma todos los inputs parseados', () => {
    const s = { CASH: '500', DEBIT: '200', CREDIT: '', TRANSFER: '300', OTHER: '' }
    expect(sumPayments(s)).toBe(1000)
  })
  it('sumPaymentsExcluding ignora el método indicado', () => {
    const s = { CASH: '500', DEBIT: '200', CREDIT: '', TRANSFER: '300', OTHER: '' }
    expect(sumPaymentsExcluding(s, 'CASH')).toBe(500)
    expect(sumPaymentsExcluding(s, 'TRANSFER')).toBe(700)
  })
})

describe('payments — autoFillFor (click en label)', () => {
  it('todos vacíos → autocompletar el total', () => {
    expect(autoFillFor(initialPayments, 'CASH', 1000)).toBe(1000)
  })
  it('parcial: total=1000, CASH=500 → click TRANSFER → 500', () => {
    const s = { ...initialPayments, CASH: '500' }
    expect(autoFillFor(s, 'TRANSFER', 1000)).toBe(500)
  })
  it('si los otros ya cubren el total → 0', () => {
    const s = { ...initialPayments, CASH: '1000' }
    expect(autoFillFor(s, 'TRANSFER', 1000)).toBe(0)
  })
  it('el monto del propio método se ignora al calcular faltante', () => {
    const s = { ...initialPayments, CASH: '999', TRANSFER: '999' }
    expect(autoFillFor(s, 'TRANSFER', 1000)).toBe(1)
  })
})

describe('payments — changeAmount (vuelto)', () => {
  it('sin pagos → negativo igual al total (todo por pagar)', () => {
    expect(changeAmount(initialPayments, 1000)).toBe(-1000)
  })
  it('pagos == total → 0 (exacto)', () => {
    const s = { ...initialPayments, CASH: '1000' }
    expect(changeAmount(s, 1000)).toBe(0)
  })
  it('pagos > total → diferencia positiva (vuelto a devolver)', () => {
    const s = { ...initialPayments, CASH: '1200' }
    expect(changeAmount(s, 1000)).toBe(200)
  })
  it('pagos < total → diferencia negativa (déficit)', () => {
    const s = { ...initialPayments, CASH: '500' }
    expect(changeAmount(s, 1000)).toBe(-500)
  })
})

describe('payments — paymentsCoverTotal', () => {
  it('exacto → true', () => {
    const s = { ...initialPayments, CASH: '1000' }
    expect(paymentsCoverTotal(s, 1000)).toBe(true)
  })
  it('déficit ≤ 0.01 → true (epsilon)', () => {
    const s = { ...initialPayments, CASH: '999.995' }
    expect(paymentsCoverTotal(s, 1000)).toBe(true)
  })
  it('déficit > 0.01 → false (pagos insuficientes)', () => {
    const s = { ...initialPayments, CASH: '999.50' }
    expect(paymentsCoverTotal(s, 1000)).toBe(false)
  })
  it('exceso sobre el total → true (puede recibir vuelto)', () => {
    const s = { ...initialPayments, CASH: '1100' }
    expect(paymentsCoverTotal(s, 1000)).toBe(true)
  })
})

describe('payments — formatPaymentAmount', () => {
  it('0 o NaN → string vacío', () => {
    expect(formatPaymentAmount(0)).toBe('')
    expect(formatPaymentAmount(NaN)).toBe('')
  })
  it('entero → sin decimales', () => {
    expect(formatPaymentAmount(1000)).toBe('1000')
  })
  it('decimal → hasta 2 decimales sin trailing zeros', () => {
    expect(formatPaymentAmount(500.5)).toBe('500.5')
    expect(formatPaymentAmount(500.55)).toBe('500.55')
  })
})
