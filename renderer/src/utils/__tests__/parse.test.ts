import { describe, expect, it } from 'vitest'
import { maskDateInput, parseDateAR, parseDecimal, parseInteger } from '../parse'

describe('parseDecimal', () => {
  it.each([
    ['1.234,50', 1234.5],
    ['1234,50', 1234.5],
    ['1234.50', 1234.5],
    ['1.500', 1500],
    ['2.5', 2.5],
    ['$ 1.234', 1234],
    ['−5', -5],
    ['-5,5', -5.5],
    ['0', 0],
    ['', null],
    ['  ', null],
    ['abc', null],
    ['1,2,3', null],
    ['1..2', null],
    ['10.000,00', 10000],
    ['0.500', 0.5],
  ])('parseDecimal(%j) → %j', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected)
  })
})

describe('parseInteger', () => {
  it.each([
    ['24', 24],
    ['−2', -2],
    ['-2', -2],
    [' 7 ', 7],
    ['0', 0],
    ['2,5', null],
    ['2.5', null],
    ['abc', null],
    ['', null],
  ])('parseInteger(%j) → %j', (input, expected) => {
    expect(parseInteger(input)).toBe(expected)
  })

  it('"-0" devuelve 0 y no -0', () => {
    expect(Object.is(parseInteger('-0'), 0)).toBe(true)
  })
})

describe('parseDateAR', () => {
  it('parsea una fecha válida a Date local 00:00', () => {
    const d = parseDateAR('24/10/2026')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(9)
    expect(d!.getDate()).toBe(24)
    expect(d!.getHours()).toBe(0)
  })

  it.each(['31/02/2026', '00/10/2026', '24/13/2026', '2026-10-24', '', '1/1/2026'])(
    'parseDateAR(%j) → null',
    (input) => {
      expect(parseDateAR(input)).toBeNull()
    },
  )

  it('acepta el 29/02 solo en años bisiestos', () => {
    expect(parseDateAR('29/02/2028')).not.toBeNull()
    expect(parseDateAR('29/02/2027')).toBeNull()
  })
})

describe('maskDateInput', () => {
  it.each([
    ['24102026', '24/10/2026'],
    ['241', '24/1'],
    ['24', '24'],
    ['24/10/2026x', '24/10/2026'],
    ['240', '24/0'],
    ['123456789', '12/34/5678'],
    ['', ''],
  ])('maskDateInput(%j) → %j', (input, expected) => {
    expect(maskDateInput(input)).toBe(expected)
  })

  it('borrar con backspace desde "24/1" no deja una barra colgando', () => {
    expect(maskDateInput('24/')).toBe('24')
  })
})
