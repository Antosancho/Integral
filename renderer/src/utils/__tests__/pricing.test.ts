import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PRICING_PREFS,
  PRICING_STORAGE_KEY,
  ROUNDING_STEPS,
  autoSalePriceText,
  computeSalePrice,
  formatMarginInput,
  isValidMarginPct,
  loadPricingPrefs,
  parseMarginInput,
  roundingStepLabel,
  savePricingPrefs,
  toRoundingStep,
} from '../pricing'
import type { RoundingStep } from '../pricing'

/** localStorage falso cuyos métodos lanzan (se pueden pisar algunos con `overrides`). */
function brokenStorage(overrides: Partial<Storage> = {}): Storage {
  const fail = () => {
    throw new Error('sin storage')
  }
  return { length: 0, clear: fail, key: fail, getItem: fail, removeItem: fail, setItem: fail, ...overrides } as Storage
}

describe('computeSalePrice', () => {
  const CASES: [number, number, RoundingStep, number | null][] = [
    // costo, margen %, paso, esperado
    [1000, 30, 0, 1300],
    [1234.56, 30, 0, 1604.93], // 1604,928 → al centavo
    [1234, 30, 0, 1604.2],
    [1650, 45, 0, 2392.5],
    [1000, 33.33, 0, 1333.3],
    [1000, 12.345, 0, 1123.5], // el margen se redondea a 2 decimales (12,35 %)
    [1000, 0, 0, 1000],
    [1000, 1000, 0, 11000], // margen máximo
    // Ejemplos del usuario: paso 100, al más cercano, la mitad sube
    [1570, 0, 100, 1600],
    [1530, 0, 100, 1500],
    [1550, 0, 100, 1600],
    [1549.99, 0, 100, 1500],
    // El mismo precio crudo (1604,20) con todos los pasos
    [1234, 30, 10, 1600],
    [1234, 30, 50, 1600],
    [1234, 30, 100, 1600],
    [1234, 30, 500, 1500],
    [1234, 30, 1000, 2000],
    [1650, 45, 100, 2400],
    // Mitades exactas con otros pasos
    [1000, 25, 500, 1500], // 1250 → 1500
    [2475, 0, 50, 2500],
    [2490, 0, 50, 2500],
    [2474.99, 0, 50, 2450],
    [5, 0, 10, 10],
    [1500, 0, 1000, 2000],
    [1499.99, 0, 1000, 1000],
    [1999.99, 0, 1000, 2000],
    // Nunca $ 0 para algo que cuesta: sube a un paso
    [30, 30, 100, 100], // 39 → 0 → 100
    [4, 0, 10, 10],
    [0.01, 0, 1000, 1000],
    [0.1, 0, 10, 10],
    // Costo 0
    [0, 30, 0, 0],
    [0, 30, 100, 0],
    [-0, 30, 0, 0],
    // Punto flotante
    [0.1 + 0.2, 0, 0, 0.3],
    [0.1 + 0.2, 100, 0, 0.6],
    [1.005, 0, 0, 1.01],
    [2.675, 0, 0, 2.68],
    [10.235, 0, 0, 10.24],
    [0.05, 50, 0, 0.08], // 7,5 centavos → 8
    [1.45, 10, 0, 1.6], // 159,5 centavos → 160
    [0.005, 0, 0, 0.01],
    [0.004, 0, 0, 0],
    // Números grandes
    [99999999.99, 1000, 0, 1099999999.89],
    [9999999.99, 30, 1000, 13000000],
    // Inválidos → null
    [-1, 30, 0, null],
    [Number.NaN, 30, 0, null],
    [Number.POSITIVE_INFINITY, 30, 0, null],
    [1000, -1, 0, null],
    [1000, 1000.01, 0, null],
    [1000, Number.NaN, 0, null],
  ]
  it.each(CASES)('computeSalePrice(%s, %s, %s) → %s', (cost, margin, step, expected) => {
    expect(computeSalePrice(cost, margin, step)).toBe(expected)
  })

  it('un paso no ofrecido devuelve null', () => {
    expect(computeSalePrice(1000, 30, 20 as RoundingStep)).toBeNull()
  })
})

describe('isValidMarginPct', () => {
  it.each([
    [0, true],
    [1000, true],
    [30.5, true],
    [-0.01, false],
    [1000.01, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
  ])('isValidMarginPct(%s) → %s', (n, expected) => {
    expect(isValidMarginPct(n)).toBe(expected)
  })
})

describe('toRoundingStep', () => {
  it.each([
    [0, 0],
    [10, 10],
    [50, 50],
    [100, 100],
    [500, 500],
    [1000, 1000],
    [20, null],
    ['100', null],
    [null, null],
    [undefined, null],
    [Number.NaN, null],
  ])('toRoundingStep(%s) → %s', (value, expected) => {
    expect(toRoundingStep(value)).toBe(expected)
  })
  it('ROUNDING_STEPS tiene los pasos ofrecidos en orden', () => {
    expect(ROUNDING_STEPS).toEqual([0, 10, 50, 100, 500, 1000])
  })
})

describe('parseMarginInput', () => {
  const CASES: [string, number | null][] = [
    ['30', 30], ['30,5', 30.5], ['30.5', 30.5], [' 45 ', 45], ['45%', 45], ['45 %', 45],
    ['0', 0], ['-0', 0], ['1000', 1000], ['1.000', 1000], ['12,345', 12.35], ['0,1', 0.1], ['99,999', 100],
    ['1000,01', null], ['1.001', null], ['-5', null], ['−5', null], ['', null], ['   ', null],
    ['abc', null], ['1e3', null], ['%', null],
  ]
  it.each(CASES)('parseMarginInput(%j) → %s', (text, expected) => {
    expect(parseMarginInput(text)).toBe(expected)
  })
})

describe('formatMarginInput', () => {
  it.each([
    [30, '30'],
    [32.5, '32,5'],
    [0, '0'],
    [1000, '1000'],
    [12.35, '12,35'],
    [0.1 + 0.2, '0,3'],
    [33.333, '33,33'],
  ])('formatMarginInput(%s) → %j', (n, expected) => {
    expect(formatMarginInput(n)).toBe(expected)
  })
})

describe('roundingStepLabel', () => {
  it.each([
    [0, 'Sin redondeo'],
    [10, '$ 10'],
    [50, '$ 50'],
    [100, '$ 100'],
    [500, '$ 500'],
    [1000, '$ 1.000'],
  ] as [RoundingStep, string][])('roundingStepLabel(%s) → %j', (step, expected) => {
    expect(roundingStepLabel(step)).toBe(expected)
  })
})

describe('autoSalePriceText', () => {
  const CASES: [string, number, RoundingStep, string][] = [
    ['1.000,00', 30, 0, '1.300,00'], ['1000', 30, 0, '1.300,00'], ['1.000', 30, 0, '1.300,00'],
    ['1234,56', 30, 0, '1.604,93'], ['1570', 0, 100, '1.600,00'], ['1234', 30, 100, '1.600,00'],
    ['100', 30, 0, '130,00'], ['100,00', 50, 10, '150,00'], ['0', 30, 100, '0,00'], ['0,5', 30, 0, '0,65'],
    ['', 30, 0, ''], ['   ', 30, 0, ''], ['abc', 30, 0, ''], ['-5', 30, 0, ''], ['1000', 1001, 0, ''],
  ]
  it.each(CASES)('autoSalePriceText(%j, %s, %s) → %j', (text, margin, step, expected) => {
    expect(autoSalePriceText(text, margin, step)).toBe(expected)
  })
})

describe('preferencias de precio', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('la clave y los defaults son los acordados', () => {
    expect(PRICING_STORAGE_KEY).toBe('integral.pricing')
    expect(DEFAULT_PRICING_PREFS).toEqual({ enabled: true, marginPct: 30, roundingStep: 100 })
  })

  it('sin nada guardado devuelve los defaults', () => {
    expect(loadPricingPrefs()).toEqual(DEFAULT_PRICING_PREFS)
  })

  it('devuelve una copia de los defaults', () => {
    const p = loadPricingPrefs()
    p.marginPct = 99
    expect(DEFAULT_PRICING_PREFS.marginPct).toBe(30)
  })

  it('lee lo guardado', () => {
    const saved = { enabled: false, marginPct: 45, roundingStep: 50 }
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(saved))
    expect(loadPricingPrefs()).toEqual(saved)
  })

  it('JSON corrupto → defaults', () => {
    localStorage.setItem(PRICING_STORAGE_KEY, '{no es json')
    expect(loadPricingPrefs()).toEqual(DEFAULT_PRICING_PREFS)
  })

  it.each(['5', '"hola"', 'null', '[]', 'true'])('JSON que no es objeto (%s) → defaults', (raw) => {
    localStorage.setItem(PRICING_STORAGE_KEY, raw)
    expect(loadPricingPrefs()).toEqual(DEFAULT_PRICING_PREFS)
  })

  it.each([
    [{ enabled: 'si', marginPct: 45, roundingStep: 20 }, { enabled: true, marginPct: 45, roundingStep: 100 }],
    [{ enabled: false, marginPct: 5000, roundingStep: 50 }, { enabled: false, marginPct: 30, roundingStep: 50 }],
    [{ marginPct: -1 }, { enabled: true, marginPct: 30, roundingStep: 100 }],
    [{ marginPct: '45' }, { enabled: true, marginPct: 30, roundingStep: 100 }],
    [{ roundingStep: '50' }, { enabled: true, marginPct: 30, roundingStep: 100 }],
  ])('campos inválidos se reemplazan uno por uno (%j)', (stored, expected) => {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(stored))
    expect(loadPricingPrefs()).toEqual(expected)
  })

  it('el margen guardado con más decimales se normaliza', () => {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ marginPct: 12.345 }))
    expect(loadPricingPrefs().marginPct).toBe(12.35)
  })

  it('si el storage lanza, loadPricingPrefs devuelve los defaults', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(() => localStorage.getItem('x')).toThrow()
    expect(() => loadPricingPrefs()).not.toThrow()
    expect(loadPricingPrefs()).toEqual(DEFAULT_PRICING_PREFS)
  })

  it('savePricingPrefs sin nada previo guarda combinado con los defaults', () => {
    savePricingPrefs({ enabled: false })
    expect(JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY)!)).toEqual({ enabled: false, marginPct: 30, roundingStep: 100 })
  })

  it('savePricingPrefs combina guardados parciales', () => {
    savePricingPrefs({ enabled: false })
    savePricingPrefs({ marginPct: 45 })
    savePricingPrefs({ roundingStep: 50 })
    expect(loadPricingPrefs()).toEqual({ enabled: false, marginPct: 45, roundingStep: 50 })
  })

  it('savePricingPrefs ignora valores inválidos', () => {
    savePricingPrefs({ marginPct: 45 })
    savePricingPrefs({ marginPct: 5000 })
    savePricingPrefs({ roundingStep: 20 as RoundingStep })
    const p = loadPricingPrefs()
    expect(p.marginPct).toBe(45)
    expect(p.roundingStep).toBe(100)
  })

  it('si el storage lanza, savePricingPrefs no lanza', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(() => savePricingPrefs({ enabled: true })).not.toThrow()
  })

  it('si getItem lanza pero setItem funciona, combina con los defaults', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', brokenStorage({ setItem }))
    savePricingPrefs({ marginPct: 45 })
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(setItem.mock.calls[0][0]).toBe(PRICING_STORAGE_KEY)
    expect(JSON.parse(setItem.mock.calls[0][1] as string)).toEqual({ enabled: true, marginPct: 45, roundingStep: 100 })
  })

  it('después de los stubs el storage real vuelve', () => {
    localStorage.setItem('x', '1')
    expect(localStorage.getItem('x')).toBe('1')
  })
})
