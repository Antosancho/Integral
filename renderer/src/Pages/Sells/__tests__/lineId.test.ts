import { describe, it, expect } from 'vitest'
import { newLineId } from '../lineId'

describe('newLineId', () => {
  it('devuelve string no vacío', () => {
    expect(newLineId()).not.toBe('')
    expect(newLineId()).toBeTruthy()
  })

  it('dos llamadas consecutivas devuelven strings distintos', () => {
    const id1 = newLineId()
    const id2 = newLineId()
    expect(id1).not.toBe(id2)
  })

  it('devuelve string con longitud suficiente para ser un identificador único', () => {
    expect(newLineId().length).toBeGreaterThanOrEqual(8)
  })
})