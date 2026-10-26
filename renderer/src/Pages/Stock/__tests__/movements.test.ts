import { describe, expect, it } from 'vitest'
import { classifyMovement, lastSevenDays, matchesTypeFilter } from '../movements'

describe('classifyMovement', () => {
  it('SALE → Venta con delta negativo', () => {
    expect(classifyMovement({ type: 'SALE', quantity: 4, appliedDelta: -4 })).toEqual({
      kind: 'sale',
      label: 'Venta',
      tone: 'neutral',
      delta: -4,
    })
  })

  it('IN con appliedDelta 0 y cantidad positiva → Alta inicial', () => {
    expect(classifyMovement({ type: 'IN', quantity: 12, appliedDelta: 0 })).toEqual({
      kind: 'initial',
      label: 'Alta inicial',
      tone: 'info',
      delta: 12,
    })
  })

  it('IN con cantidad negativa → Merma', () => {
    expect(classifyMovement({ type: 'IN', quantity: -2, appliedDelta: -2 })).toEqual({
      kind: 'shrink',
      label: 'Merma',
      tone: 'warning',
      delta: -2,
    })
  })

  it('IN positivo → Reposición (también con appliedDelta null)', () => {
    expect(classifyMovement({ type: 'IN', quantity: 24, appliedDelta: 24 })).toMatchObject({ kind: 'restock', label: 'Reposición', tone: 'success', delta: 24 })
    expect(classifyMovement({ type: 'IN', quantity: 24, appliedDelta: null })).toMatchObject({ kind: 'restock', delta: 24 })
  })

  it('ADJUSTMENT → Ajuste con el delta aplicado (null si no se conoce)', () => {
    expect(classifyMovement({ type: 'ADJUSTMENT', quantity: 10, appliedDelta: -3 })).toEqual({
      kind: 'adjustment',
      label: 'Ajuste',
      tone: 'neutral',
      delta: -3,
    })
    expect(classifyMovement({ type: 'ADJUSTMENT', quantity: 10, appliedDelta: null }).delta).toBeNull()
  })
})

describe('matchesTypeFilter', () => {
  const info = (type: string, quantity: number, appliedDelta: number | null) => classifyMovement({ type, quantity, appliedDelta })
  const sale = info('SALE', 1, -1)
  const initial = info('IN', 5, 0)
  const restock = info('IN', 5, 5)
  const shrink = info('IN', -1, -1)
  const adjustment = info('ADJUSTMENT', 3, 1)

  it('all matchea todo', () => {
    for (const i of [sale, initial, restock, shrink, adjustment]) expect(matchesTypeFilter(i, 'all')).toBe(true)
  })

  it('restock incluye también el alta inicial', () => {
    expect(matchesTypeFilter(initial, 'restock')).toBe(true)
    expect(matchesTypeFilter(restock, 'restock')).toBe(true)
    expect(matchesTypeFilter(shrink, 'restock')).toBe(false)
  })

  it('cada tipo matchea solo el suyo', () => {
    expect(matchesTypeFilter(sale, 'sale')).toBe(true)
    expect(matchesTypeFilter(restock, 'sale')).toBe(false)
    expect(matchesTypeFilter(shrink, 'shrink')).toBe(true)
    expect(matchesTypeFilter(adjustment, 'adjustment')).toBe(true)
    expect(matchesTypeFilter(adjustment, 'shrink')).toBe(false)
  })
})

describe('lastSevenDays', () => {
  it('va desde hoy-6 a las 00:00 hasta hoy a las 23:59:59.999', () => {
    const { from, to } = lastSevenDays(new Date(2026, 9, 24, 15))
    expect(from).toEqual(new Date(2026, 9, 18, 0, 0, 0, 0))
    expect(to).toEqual(new Date(2026, 9, 24, 23, 59, 59, 999))
  })

  it('cruza el cambio de mes', () => {
    const { from } = lastSevenDays(new Date(2026, 10, 3, 9))
    expect(from).toEqual(new Date(2026, 9, 28, 0, 0, 0, 0))
  })
})
