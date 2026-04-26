import { describe, it, expect } from 'vitest'
import {
  getPeriodDates,
  getPreviousPeriod,
  calcPctChange,
  formatPctChange,
  formatMoney,
  getStartOfDay,
  getEndOfDay
} from '../statsUtils'

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
  it('null → "N/A"', () => {
    expect(formatPctChange(null)).toBe('N/A')
  })

  it('20 → "+20.0%"', () => {
    expect(formatPctChange(20)).toBe('+20.0%')
  })

  it('-20 → "-20.0%"', () => {
    expect(formatPctChange(-20)).toBe('-20.0%')
  })

  it('0 → "+0.0%"', () => {
    expect(formatPctChange(0)).toBe('+0.0%')
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
