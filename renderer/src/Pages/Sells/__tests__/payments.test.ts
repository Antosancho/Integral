import { describe, it, expect } from 'vitest'
import {
  PAYMENT_METHODS,
  PAYMENT_LABELS,
  initialPayments,
  parsePaymentAmount,
  sumPayments,
  sumPaymentsExcluding,
  changeAmount,
  paymentsCoverTotal,
  fillRemaining,
  formatPaymentOnBlur,
  changeState,
  PAYMENT_EPSILON,
  PAYMENT_TITLE_LABELS,
  PAYMENT_ICONS
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
  it('admite separador de miles con coma decimal ("10.000,00" → 10000)', () => {
    expect(parsePaymentAmount('10.000,00')).toBe(10000)
    expect(parsePaymentAmount('1.234,50')).toBe(1234.5)
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

describe('payments — fillRemaining (click en la etiqueta)', () => {
  it('todos vacíos → completa el total con formato es-AR', () => {
    expect(fillRemaining(initialPayments, 'CASH', 1000).CASH).toBe('1.000,00')
  })
  it('parcial: total 1500, CASH "1000", click TRANSFER → TRANSFER "500,00"', () => {
    const s = { ...initialPayments, CASH: '1000' }
    const next = fillRemaining(s, 'TRANSFER', 1500)
    expect(next.TRANSFER).toBe('500,00')
    expect(next.CASH).toBe('1000')
  })
  it('suma a un método que ya tenía monto: CASH "1000", total 1500 → CASH "1.500,00"', () => {
    const s = { ...initialPayments, CASH: '1000' }
    expect(fillRemaining(s, 'CASH', 1500).CASH).toBe('1.500,00')
  })
  it('si ya está todo cubierto no cambia nada (misma referencia)', () => {
    const s = { ...initialPayments, CASH: '1500' }
    expect(fillRemaining(s, 'TRANSFER', 1500)).toBe(s)
  })
  it('si los pagos exceden el total tampoco cambia nada', () => {
    const s = { ...initialPayments, CASH: '2000' }
    expect(fillRemaining(s, 'DEBIT', 1500)).toBe(s)
  })
  it('un faltante de centavos se redondea a 2 decimales', () => {
    const s = { ...initialPayments, CASH: '100' }
    expect(fillRemaining(s, 'DEBIT', 100.3333).DEBIT).toBe('0,33')
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
  it('déficit menor a medio centavo → true (epsilon)', () => {
    const s = { ...initialPayments, CASH: '999,996' }
    expect(paymentsCoverTotal(s, 1000)).toBe(true)
  })
  it('déficit mayor al epsilon → false (pagos insuficientes)', () => {
    const s = { ...initialPayments, CASH: '999,50' }
    expect(paymentsCoverTotal(s, 1000)).toBe(false)
  })
  it('exceso sobre el total → true (puede recibir vuelto)', () => {
    const s = { ...initialPayments, CASH: '1100' }
    expect(paymentsCoverTotal(s, 1000)).toBe(true)
  })
})

describe('payments — formatPaymentOnBlur', () => {
  it('formatea con separador de miles y 2 decimales', () => {
    expect(formatPaymentOnBlur('20000')).toBe('20.000,00')
    expect(formatPaymentOnBlur('1500,5')).toBe('1.500,50')
  })
  it('texto inválido, vacío o no positivo → vacío', () => {
    expect(formatPaymentOnBlur('abc')).toBe('')
    expect(formatPaymentOnBlur('')).toBe('')
    expect(formatPaymentOnBlur('0')).toBe('')
    expect(formatPaymentOnBlur('-5')).toBe('')
  })
})

describe('payments — changeState', () => {
  it('pagó menos → due con el faltante', () => {
    expect(changeState(500, 1000)).toEqual({ kind: 'due', amount: 500 })
    expect(changeState(0, 100)).toEqual({ kind: 'due', amount: 100 })
  })
  it('pagó justo → exact', () => {
    expect(changeState(1000, 1000)).toEqual({ kind: 'exact', amount: 0 })
  })
  it('pagó de más → return con el vuelto', () => {
    expect(changeState(20000, 1000)).toEqual({ kind: 'return', amount: 19000 })
  })
  it('una diferencia de −0.004 (dentro del epsilon) cuenta como exacto', () => {
    expect(changeState(999.996, 1000)).toEqual({ kind: 'exact', amount: 0 })
  })
})

describe('payments — constantes de presentación', () => {
  it('el epsilon es medio centavo', () => {
    expect(PAYMENT_EPSILON).toBe(0.005)
  })
  it('hay un nombre y un ícono por cada medio de pago', () => {
    expect(PAYMENT_TITLE_LABELS.CASH).toBe('Efectivo')
    expect(PAYMENT_TITLE_LABELS.TRANSFER).toBe('Transferencia')
    for (const m of PAYMENT_METHODS) expect(PAYMENT_ICONS[m]).toBeDefined()
  })
})
