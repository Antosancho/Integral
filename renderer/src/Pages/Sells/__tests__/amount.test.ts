import { describe, it, expect } from 'vitest'
import { validateGeneralAmount } from '../amount'

const ERROR = 'Ingresá un monto mayor a 0.'

describe('validateGeneralAmount', () => {
  it.each([
    ['500', '500'],
    ['150.50', '150.5'],
    ['150,50', '150.5'],
    [' 200 ', '200'],
    ['1.500,50', '1500.5'],
    ['1.234,56', '1234.56'],
    ['1500', '1500'],
    ['$ 850,50', '850.5']
  ])('%j → válido, value=%j (formato máquina)', (raw, value) => {
    expect(validateGeneralAmount(raw)).toEqual({ ok: true, value })
  })

  it.each(['', '   ', '0', '-3', '-3,5', 'abc', 'NaN', '0,001'])('%j → inválido con el copy del design system', (raw) => {
    expect(validateGeneralAmount(raw)).toEqual({ ok: false, error: ERROR })
  })

  it('redondea a centavos para que el valor guardado nunca tenga 3 decimales', () => {
    expect(validateGeneralAmount('100,129')).toEqual({ ok: true, value: '100.13' })
  })
})
