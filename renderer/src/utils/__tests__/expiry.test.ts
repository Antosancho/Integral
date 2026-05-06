import { describe, it, expect } from 'vitest'
import { classifyExpiry, parseExpiryInput, formatExpiryInput } from '../expiry'

describe('parseExpiryInput', () => {
  it('parsea una fecha válida a Date local a las 00:00', () => {
    const result = parseExpiryInput('2026-05-10')
    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2026)
    expect(result!.getMonth()).toBe(4) // mayo = índice 4
    expect(result!.getDate()).toBe(10)
    expect(result!.getHours()).toBe(0)
    expect(result!.getMinutes()).toBe(0)
  })

  it('devuelve null para string vacío', () => {
    expect(parseExpiryInput('')).toBeNull()
    expect(parseExpiryInput('   ')).toBeNull()
  })

  it('devuelve null para formato inválido', () => {
    expect(parseExpiryInput('not-a-date')).toBeNull()
    expect(parseExpiryInput('10/05/2026')).toBeNull()
    expect(parseExpiryInput('2026/05/10')).toBeNull()
  })

  it('devuelve null para mes inválido (13)', () => {
    expect(parseExpiryInput('2026-13-01')).toBeNull()
  })

  it('devuelve null para día inválido que se normaliza silenciosamente (ej: 31 de febrero → marzo)', () => {
    // 2026-02-31 → Date(2026,1,31) normaliza a marzo → se detecta como inválido
    expect(parseExpiryInput('2026-02-31')).toBeNull()
  })

  it('devuelve null para día 40 (pasa regex pero falla bounds)', () => {
    expect(parseExpiryInput('2026-05-40')).toBeNull()
  })
})

describe('formatExpiryInput', () => {
  it('formatea una Date a YYYY-MM-DD con padding', () => {
    // new Date(año, mes-1, día)
    expect(formatExpiryInput(new Date(2026, 4, 3))).toBe('2026-05-03')
    expect(formatExpiryInput(new Date(2026, 11, 31))).toBe('2026-12-31')
    expect(formatExpiryInput(new Date(2026, 0, 1))).toBe('2026-01-01')
  })

  it('devuelve string vacío para null', () => {
    expect(formatExpiryInput(null)).toBe('')
  })
})

describe('classifyExpiry', () => {
  it('devuelve null para fecha null', () => {
    expect(classifyExpiry(null)).toBeNull()
  })

  it('devuelve "expired" para ayer', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(classifyExpiry(yesterday)).toBe('expired')
  })

  it('devuelve "expiring_today" para hoy a las 12:00', () => {
    const now = new Date()
    const today12 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    expect(classifyExpiry(today12)).toBe('expiring_today')
  })

  it('devuelve "expiring_today" para hoy a las 00:00:00.000 (inicio exacto)', () => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    expect(classifyExpiry(startOfToday)).toBe('expiring_today')
  })

  it('devuelve "expiring_today" para hoy a las 23:59:59.999 (fin exacto)', () => {
    const now = new Date()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    expect(classifyExpiry(endOfToday)).toBe('expiring_today')
  })

  it('devuelve null para mañana', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(classifyExpiry(tomorrow)).toBeNull()
  })
})
