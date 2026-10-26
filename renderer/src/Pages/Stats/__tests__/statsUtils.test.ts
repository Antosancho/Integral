import { describe, it, expect } from 'vitest'
import {
  getPeriodDates,
  getPeriodDatesAt,
  getPreviousPeriod,
  calcPctChange,
  formatPctChange,
  formatMoney,
  getStartOfDay,
  getEndOfDay,
  formatRange,
  comparedToLabel,
  HOUR_LABEL,
  peakIndex
} from '../statsUtils'

describe('getPeriodDatesAt', () => {
  it.each([
    ['today', new Date(2026, 9, 20, 1, 0), new Date(2026, 9, 20, 0, 0, 0, 0), new Date(2026, 9, 20, 23, 59, 59, 999)],
    ['week', new Date(2026, 9, 25, 12, 0), new Date(2026, 9, 19, 0, 0, 0, 0), new Date(2026, 9, 25, 23, 59, 59, 999)],
    ['week', new Date(2026, 9, 19, 0, 0), new Date(2026, 9, 19, 0, 0, 0, 0), new Date(2026, 9, 25, 23, 59, 59, 999)],
    ['week', new Date(2026, 9, 26, 10, 0), new Date(2026, 9, 26, 0, 0, 0, 0), new Date(2026, 10, 1, 23, 59, 59, 999)],
    ['month', new Date(2026, 9, 31, 23, 0), new Date(2026, 9, 1, 0, 0, 0, 0), new Date(2026, 9, 31, 23, 59, 59, 999)],
    ['month', new Date(2028, 1, 10), new Date(2028, 1, 1, 0, 0, 0, 0), new Date(2028, 1, 29, 23, 59, 59, 999)],
    ['month', new Date(2026, 11, 15), new Date(2026, 11, 1, 0, 0, 0, 0), new Date(2026, 11, 31, 23, 59, 59, 999)]
  ] as const)('%s con ref %s', (preset, ref, from, to) => {
    expect(getPeriodDatesAt(preset, ref)).toEqual({ from, to })
  })
})

// ---------------------------------------------------------------------------
// getPeriodDates
// ---------------------------------------------------------------------------

describe('getPeriodDates', () => {
  it("'today' retorna from con hora 00:00:00 y to con hora 23:59:59", () => {
    const result = getPeriodDates('today')
    expect(result.from.getHours()).toBe(0)
    expect(result.from.getMinutes()).toBe(0)
    expect(result.from.getSeconds()).toBe(0)
    expect(result.to.getHours()).toBe(23)
    expect(result.to.getSeconds()).toBe(59)
  })

  it("'week' retorna un lunes como from", () => {
    const result = getPeriodDates('week')
    // getDay(): 0=Dom, 1=Lun ... 6=Sáb
    expect(result.from.getDay()).toBe(1)
  })

  it("'week' retorna un domingo como to", () => {
    const result = getPeriodDates('week')
    expect(result.to.getDay()).toBe(0)
  })

  it("'week' el to está exactamente 6 días después del from", () => {
    const result = getPeriodDates('week')
    const fromDay = getStartOfDay(result.from).getTime()
    const toDay = getStartOfDay(result.to).getTime()
    const diffDays = (toDay - fromDay) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(6)
  })

  it("'month' el from es el día 1 del mes", () => {
    const result = getPeriodDates('month')
    expect(result.from.getDate()).toBe(1)
  })

  it("'month' el to es el último día del mes (el día siguiente al to es día 1)", () => {
    const result = getPeriodDates('month')
    const dayAfterTo = new Date(result.to.getTime() + 1)
    expect(dayAfterTo.getDate()).toBe(1)
  })

  it("'custom' retorna exactamente los valores pasados", () => {
    const from = new Date('2025-03-01T00:00:00')
    const to = new Date('2025-03-31T23:59:59')
    const result = getPeriodDates('custom', from, to)
    expect(result.from.getTime()).toBe(from.getTime())
    expect(result.to.getTime()).toBe(to.getTime())
  })
})

// ---------------------------------------------------------------------------
// getPreviousPeriod — preset 'month'
// ---------------------------------------------------------------------------

describe("getPreviousPeriod con preset 'month'", () => {
  it('retorna el mes calendario anterior', () => {
    // Rango de abril 2025
    const range = {
      from: new Date('2025-04-01T00:00:00'),
      to: new Date('2025-04-30T23:59:59')
    }
    const result = getPreviousPeriod(range, 'month')
    // El mes anterior a abril (3) es marzo (2)
    expect(result.from.getMonth()).toBe(2)
  })

  it('para enero retorna diciembre del año anterior', () => {
    const range = {
      from: new Date('2025-01-01T00:00:00'),
      to: new Date('2025-01-31T23:59:59')
    }
    const result = getPreviousPeriod(range, 'month')
    expect(result.from.getFullYear()).toBe(2024)
    expect(result.from.getMonth()).toBe(11) // diciembre
  })
})

// ---------------------------------------------------------------------------
// getPreviousPeriod — preset 'week'
// ---------------------------------------------------------------------------

describe("getPreviousPeriod con preset 'week'", () => {
  it('retrocede exactamente 7 días', () => {
    const from = new Date('2025-04-07T00:00:00')
    const to = new Date('2025-04-13T23:59:59')
    const result = getPreviousPeriod({ from, to }, 'week')
    const expectedFrom = new Date(from)
    expectedFrom.setDate(from.getDate() - 7)
    expect(result.from.getTime()).toBe(expectedFrom.getTime())
  })
})

// ---------------------------------------------------------------------------
// getPreviousPeriod — preset 'today'
// ---------------------------------------------------------------------------

describe("getPreviousPeriod con preset 'today'", () => {
  it('retorna el día anterior', () => {
    const today = new Date()
    const from = getStartOfDay(today)
    const to = getEndOfDay(today)
    const result = getPreviousPeriod({ from, to }, 'today')

    const expectedFrom = getStartOfDay(new Date(today))
    expectedFrom.setDate(today.getDate() - 1)
    const expectedTo = getEndOfDay(new Date(today))
    expectedTo.setDate(today.getDate() - 1)

    expect(result.from.getTime()).toBe(expectedFrom.getTime())
    expect(result.to.getTime()).toBe(expectedTo.getTime())
  })
})

// ---------------------------------------------------------------------------
// calcPctChange
// ---------------------------------------------------------------------------

describe('calcPctChange', () => {
  it('(120, 100) → 20', () => {
    expect(calcPctChange(120, 100)).toBe(20)
  })

  it('(80, 100) → -20', () => {
    expect(calcPctChange(80, 100)).toBe(-20)
  })

  it('(100, 0) → null', () => {
    expect(calcPctChange(100, 0)).toBeNull()
  })

  it('(0, 0) → null', () => {
    expect(calcPctChange(0, 0)).toBeNull()
  })

  it('(0, 100) → -100', () => {
    expect(calcPctChange(0, 100)).toBe(-100)
  })

  it('(100, 100) → 0', () => {
    expect(calcPctChange(100, 100)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// formatPctChange
// ---------------------------------------------------------------------------

describe('formatPctChange', () => {
  it('null → "—"', () => {
    expect(formatPctChange(null)).toBe('—')
  })

  it('20 → "+20,0 %"', () => {
    expect(formatPctChange(20)).toBe('+20,0 %')
  })

  it('12.4 → "+12,4 %"', () => {
    expect(formatPctChange(12.4)).toBe('+12,4 %')
  })

  it('-20 → "−20,0 %" (con el menos tipográfico)', () => {
    expect(formatPctChange(-20)).toBe('−20,0 %')
  })

  it('0 → "0,0 %" (sin signo)', () => {
    expect(formatPctChange(0)).toBe('0,0 %')
  })
})

// ---------------------------------------------------------------------------
// formatRange / comparedToLabel / HOUR_LABEL / peakIndex
// ---------------------------------------------------------------------------

describe('formatRange', () => {
  const range = (a: Date, b: Date) => ({ from: a, to: b })

  it('mismo mes y año → "1 – 24 oct 2026"', () => {
    expect(formatRange(range(new Date(2026, 9, 1), new Date(2026, 9, 24)))).toBe('1 – 24 oct 2026')
  })

  it('distinto mes → "28 sep – 4 oct 2026"', () => {
    expect(formatRange(range(new Date(2026, 8, 28), new Date(2026, 9, 4)))).toBe('28 sep – 4 oct 2026')
  })

  it('distinto año → "28 dic 2025 – 3 ene 2026"', () => {
    expect(formatRange(range(new Date(2025, 11, 28), new Date(2026, 0, 3)))).toBe('28 dic 2025 – 3 ene 2026')
  })

  it('un solo día se muestra como rango del mismo día', () => {
    expect(formatRange(range(new Date(2026, 9, 24), new Date(2026, 9, 24)))).toBe('24 – 24 oct 2026')
  })
})

describe('comparedToLabel', () => {
  const prev = { from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) }

  it('hoy → "vs. ayer"', () => expect(comparedToLabel('today', prev)).toBe('vs. ayer'))
  it('semana → "vs. semana anterior"', () => expect(comparedToLabel('week', prev)).toBe('vs. semana anterior'))
  it('mes → nombre del mes anterior en minúscula', () => expect(comparedToLabel('month', prev)).toBe('vs. septiembre'))
  it('personalizado → "vs. período anterior"', () => expect(comparedToLabel('custom', prev)).toBe('vs. período anterior'))
})

describe('HOUR_LABEL', () => {
  it.each([
    ['18', '18–19 h'],
    ['07', '07–08 h'],
    ['00', '00–01 h'],
    ['23', '23–00 h']
  ])('HOUR_LABEL(%j) → %s', (input, expected) => {
    expect(HOUR_LABEL(input)).toBe(expected)
  })

  it('una etiqueta no numérica se devuelve igual', () => {
    expect(HOUR_LABEL('xx')).toBe('xx')
  })
})

describe('peakIndex', () => {
  const row = (label: string, saleCount: number) => ({ label, saleCount, totalRevenue: '0' })

  it('devuelve el índice de la fila con más ventas', () => {
    expect(peakIndex([row('10', 3), row('11', 9), row('12', 4)])).toBe(1)
  })

  it('con empate, el primero', () => {
    expect(peakIndex([row('10', 5), row('11', 5)])).toBe(0)
  })

  it('lista vacía → -1', () => {
    expect(peakIndex([])).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// formatMoney
// ---------------------------------------------------------------------------

describe('formatMoney', () => {
  it("'1000' produce un string que contiene '1.000'", () => {
    // es-AR usa punto como separador de miles
    expect(formatMoney('1000')).toContain('1.000')
  })

  it('0 produce un string que contiene "0"', () => {
    expect(formatMoney(0)).toContain('0')
  })
})
