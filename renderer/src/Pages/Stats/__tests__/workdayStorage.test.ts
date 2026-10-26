import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORKDAY } from '../hourFilter'
import { WORKDAY_STORAGE_KEY, loadWorkday, saveWorkday } from '../workdayStorage'

const DEFAULT = { startMinute: 480, endMinute: 120 }

describe('workdayStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('usa la clave integral.stats.workday', () => {
    expect(WORKDAY_STORAGE_KEY).toBe('integral.stats.workday')
  })

  it('sin nada guardado devuelve 08:00 → 02:00', () => {
    expect(loadWorkday()).toEqual(DEFAULT)
  })

  it('lee la jornada guardada', () => {
    localStorage.setItem(WORKDAY_STORAGE_KEY, '{"start":"09:30","end":"03:00"}')
    expect(loadWorkday()).toEqual({ startMinute: 570, endMinute: 180 })
  })

  it.each([
    '{oops',
    'null',
    '123',
    '"08:00"',
    '[]',
    '{"start":"25:00","end":"02:00"}',
    '{"start":"08:00"}',
    '{"start":8,"end":2}',
    '{"start":"8:00","end":"02:00"}'
  ])('valor inválido %s → default', (raw) => {
    localStorage.setItem(WORKDAY_STORAGE_KEY, raw)
    expect(loadWorkday()).toEqual(DEFAULT)
  })

  it('si getItem lanza → default', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin storage')
    })
    expect(loadWorkday()).toEqual(DEFAULT)
  })

  it('saveWorkday guarda el string exacto', () => {
    saveWorkday({ startMinute: 570, endMinute: 180 })
    expect(localStorage.getItem(WORKDAY_STORAGE_KEY)).toBe('{"start":"09:30","end":"03:00"}')
  })

  it('si setItem lanza, saveWorkday no lanza', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin storage')
    })
    expect(() => saveWorkday({ startMinute: 570, endMinute: 180 })).not.toThrow()
  })

  it.each([
    { startMinute: 1320, endMinute: 360 },
    { startMinute: 480, endMinute: 480 }
  ])('ida y vuelta %j', (w) => {
    saveWorkday(w)
    expect(loadWorkday()).toEqual(w)
  })

  it('loadWorkday devuelve una copia', () => {
    const w = loadWorkday()
    w.startMinute = 1
    expect(DEFAULT_WORKDAY.startMinute).toBe(480)
    expect(loadWorkday().startMinute).toBe(480)
  })
})
