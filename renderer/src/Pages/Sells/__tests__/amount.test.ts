import { describe, it, expect } from 'vitest'
import { normalizeAmount, validateGeneralAmount } from '../amount'

describe('normalizeAmount', () => {
  it("'150.50' → '150.50'", () => {
    expect(normalizeAmount('150.50')).toBe('150.50')
  })

  it("'  150,50 ' → '150.50' (trim + coma → punto)", () => {
    expect(normalizeAmount('  150,50 ')).toBe('150.50')
  })

  it("'' → '' (vacío no se normaliza)", () => {
    expect(normalizeAmount('')).toBe('')
  })

  it("' 200 ' → '200' (trim)", () => {
    expect(normalizeAmount(' 200 ')).toBe('200')
  })
})

describe('validateGeneralAmount', () => {
  it("'500' → válido, value='500'", () => {
    expect(validateGeneralAmount('500')).toEqual({ ok: true, value: '500' })
  })

  it("'150.50' → válido, value='150.50'", () => {
    expect(validateGeneralAmount('150.50')).toEqual({ ok: true, value: '150.50' })
  })

  it("'150,50' → válido, value='150.50' (coma normalizada a punto)", () => {
    expect(validateGeneralAmount('150,50')).toEqual({ ok: true, value: '150.50' })
  })

  it("' 200 ' → válido, value='200' (trim)", () => {
    expect(validateGeneralAmount(' 200 ')).toEqual({ ok: true, value: '200' })
  })

  it("'1.234,56' → inválido (múltiples separadores)", () => {
    expect(validateGeneralAmount('1.234,56').ok).toBe(false)
  })

  it("'' → inválido, error='Ingresá un monto'", () => {
    expect(validateGeneralAmount('')).toEqual({ ok: false, error: 'Ingresá un monto' })
  })

  it("'0' → inválido (no es positivo)", () => {
    expect(validateGeneralAmount('0').ok).toBe(false)
  })

  it("'-3' → inválido (negativo)", () => {
    expect(validateGeneralAmount('-3').ok).toBe(false)
  })

  it("'-3,5' → inválido (negativo con coma)", () => {
    expect(validateGeneralAmount('-3,5').ok).toBe(false)
  })

  it("'abc' → inválido (NaN)", () => {
    expect(validateGeneralAmount('abc').ok).toBe(false)
  })

  it("'NaN' → inválido (string 'NaN')", () => {
    expect(validateGeneralAmount('NaN').ok).toBe(false)
  })
})