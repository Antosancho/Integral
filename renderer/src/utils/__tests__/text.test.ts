import { describe, expect, it } from 'vitest'
import { foldText, includesFolded, splitMatch } from '../text'

describe('foldText', () => {
  it('quita tildes, pasa a minúsculas y conserva el largo', () => {
    const original = 'Serenísima'
    expect(foldText(original)).toBe('serenisima')
    expect(foldText(original)).toHaveLength(original.length)
  })

  it('cadena vacía', () => {
    expect(foldText('')).toBe('')
  })
})

describe('splitMatch', () => {
  it('marca la coincidencia al principio', () => {
    expect(splitMatch('Yerba Playadito', 'yer')).toEqual([
      { text: 'Yer', match: true },
      { text: 'ba Playadito', match: false },
    ])
  })

  it('ignora tildes y conserva el texto original en el segmento', () => {
    expect(splitMatch('La Serenísima', 'serenisima')).toEqual([
      { text: 'La ', match: false },
      { text: 'Serenísima', match: true },
    ])
  })

  it('coincidencia en el medio produce tres segmentos', () => {
    expect(splitMatch('Leche entera', 'he e')).toEqual([
      { text: 'Lec', match: false },
      { text: 'he e', match: true },
      { text: 'ntera', match: false },
    ])
  })

  it('sin coincidencia o query vacía devuelve un solo segmento', () => {
    expect(splitMatch('Leche', 'xyz')).toEqual([{ text: 'Leche', match: false }])
    expect(splitMatch('Leche', '')).toEqual([{ text: 'Leche', match: false }])
    expect(splitMatch('Leche', '   ')).toEqual([{ text: 'Leche', match: false }])
  })
})

describe('includesFolded', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(includesFolded('Serenísima', 'SERENI')).toBe(true)
  })

  it('false cuando no está', () => {
    expect(includesFolded('Leche', 'yerba')).toBe(false)
  })

  it('query vacía → true', () => {
    expect(includesFolded('x', '')).toBe(true)
  })
})
