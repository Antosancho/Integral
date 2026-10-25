import { describe, expect, it } from 'vitest'
import {
  formatAmountInput,
  formatDate,
  formatDayMonth,
  formatDayMonthTime,
  formatInt,
  formatMoney,
  formatPct,
  formatSignedInt,
  formatTime,
} from '../format'

/** Intl usa espacio duro (U+00A0) entre "$" y el número: se normaliza para comparar. */
const norm = (s: string) => s.replace(/\u00a0/g, ' ')

describe('formatMoney', () => {
  it.each([
    [1234.5, '$ 1.234,50'],
    ['1000', '$ 1.000,00'],
    [0, '$ 0,00'],
    [-3, '−$ 3,00'],
    ['abc', 'abc'],
  ])('formatMoney(%j) → %s', (input, expected) => {
    expect(norm(formatMoney(input))).toBe(expected)
  })
})

describe('formatAmountInput', () => {
  it.each([
    [4890, '4.890,00'],
    ['1450.5', '1.450,50'],
    [null, ''],
    ['x', ''],
    ['', ''],
  ])('formatAmountInput(%j) → %j', (input, expected) => {
    expect(norm(formatAmountInput(input))).toBe(expected)
  })
})

describe('formatInt / formatSignedInt', () => {
  it('formatInt separa miles y usa el menos tipográfico', () => {
    expect(formatInt(1284)).toBe('1.284')
    expect(formatInt(-6)).toBe('−6')
    expect(formatInt(0)).toBe('0')
  })

  it.each([
    [24, '+24'],
    [-2, '−2'],
    [0, '0'],
  ])('formatSignedInt(%d) → %s', (input, expected) => {
    expect(formatSignedInt(input)).toBe(expected)
  })
})

describe('formatPct', () => {
  it.each([
    [12.4, '+12,4 %'],
    [-2.345, '−2,3 %'],
    [0, '0,0 %'],
    [null, '—'],
  ])('formatPct(%j) → %s', (input, expected) => {
    expect(norm(formatPct(input))).toBe(expected)
  })

  it('un cambio que redondea a cero no lleva signo', () => {
    expect(norm(formatPct(-0.04))).toBe('0,0 %')
  })
})

describe('fechas y horas', () => {
  it('formatDate usa DD/MM/AAAA con ceros', () => {
    expect(formatDate(new Date(2026, 9, 4))).toBe('04/10/2026')
  })

  it('formatDayMonth y formatTime', () => {
    expect(formatDayMonth(new Date(2026, 9, 24))).toBe('24/10')
    expect(formatTime(new Date(2026, 9, 24, 18, 42))).toBe('18:42')
  })

  it('formatDayMonthTime combina día/mes y hora', () => {
    expect(formatDayMonthTime(new Date(2026, 9, 24, 8, 5))).toBe('24/10 08:05')
  })
})
