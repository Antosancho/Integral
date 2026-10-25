import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKDAY,
  MAX_FILTERED_DAYS,
  buildIntervals,
  countDays,
  crossesMidnight,
  describeWindow,
  getBusinessToday,
  orderHourRows,
  resolveHourFilter,
  toStatsInput,
  type TimeWindow
} from '../hourFilter'
import { getPeriodDatesAt, getPreviousPeriod } from '../statsUtils'

const W: TimeWindow = { startMinute: 480, endMinute: 120 } // 08→02

const day = (y: number, m: number, d: number) => ({
  from: new Date(y, m, d, 0, 0, 0, 0),
  to: new Date(y, m, d, 23, 59, 59, 999)
})
const days = (y: number, m: number, d: number, y2: number, m2: number, d2: number) => ({
  from: new Date(y, m, d, 0, 0, 0, 0),
  to: new Date(y2, m2, d2, 23, 59, 59, 999)
})
const iv = (from: Date, to: Date) => ({ from, to })

describe('crossesMidnight', () => {
  it.each([
    [480, 120, true],
    [540, 780, false],
    [480, 480, true],
    [0, 0, true],
    [480, 0, true],
    [0, 1439, false],
    [1380, 1439, false]
  ])('{%i, %i} → %s', (startMinute, endMinute, expected) => {
    expect(crossesMidnight({ startMinute, endMinute })).toBe(expected)
  })
})

describe('getBusinessToday', () => {
  const d = (y: number, m: number, dd: number) => new Date(y, m, dd)
  it.each<[string, Date, TimeWindow | null, Date]>([
    ['mar 20/10 01:00 · W', new Date(2026, 9, 20, 1, 0), W, d(2026, 9, 19)],
    ['mar 20/10 00:00 · W', new Date(2026, 9, 20, 0, 0), W, d(2026, 9, 19)],
    ['mar 20/10 01:59 · W', new Date(2026, 9, 20, 1, 59), W, d(2026, 9, 19)],
    ['mar 20/10 02:00 · W', new Date(2026, 9, 20, 2, 0), W, d(2026, 9, 20)],
    ['mar 20/10 05:00 · W (P3)', new Date(2026, 9, 20, 5, 0), W, d(2026, 9, 20)],
    ['mar 20/10 08:00 · W', new Date(2026, 9, 20, 8, 0), W, d(2026, 9, 20)],
    ['mar 20/10 23:59 · W', new Date(2026, 9, 20, 23, 59), W, d(2026, 9, 20)],
    ['mar 20/10 01:00 · sin franja', new Date(2026, 9, 20, 1, 0), null, d(2026, 9, 20)],
    ['mar 20/10 01:00 · 09→13', new Date(2026, 9, 20, 1, 0), { startMinute: 540, endMinute: 780 }, d(2026, 9, 20)],
    ['mar 20/10 00:30 · 08→00', new Date(2026, 9, 20, 0, 30), { startMinute: 480, endMinute: 0 }, d(2026, 9, 20)],
    ['mar 20/10 05:00 · 06→06', new Date(2026, 9, 20, 5, 0), { startMinute: 360, endMinute: 360 }, d(2026, 9, 19)],
    ['mar 20/10 06:00 · 06→06', new Date(2026, 9, 20, 6, 0), { startMinute: 360, endMinute: 360 }, d(2026, 9, 20)],
    ['mar 20/10 00:00 · 00→00', new Date(2026, 9, 20, 0, 0), { startMinute: 0, endMinute: 0 }, d(2026, 9, 20)],
    ['dom 1/11 01:00 · W', new Date(2026, 10, 1, 1, 0), W, d(2026, 9, 31)],
    ['vie 1/1/2027 01:30 · W', new Date(2027, 0, 1, 1, 30), W, d(2026, 11, 31)]
  ])('%s', (_name, now, w, expected) => {
    expect(getBusinessToday(now, w)).toEqual(expected)
  })
})

describe('getPeriodDatesAt con el día comercial', () => {
  it.each([
    ['month', new Date(2026, 10, 1, 1, 0), W, new Date(2026, 9, 1, 0, 0, 0, 0), new Date(2026, 9, 31, 23, 59, 59, 999)],
    ['week', new Date(2026, 9, 26, 1, 0), W, new Date(2026, 9, 19, 0, 0, 0, 0), new Date(2026, 9, 25, 23, 59, 59, 999)],
    ['week', new Date(2026, 9, 26, 1, 0), null, new Date(2026, 9, 26, 0, 0, 0, 0), new Date(2026, 10, 1, 23, 59, 59, 999)],
    ['today', new Date(2026, 9, 20, 1, 0), W, new Date(2026, 9, 19, 0, 0, 0, 0), new Date(2026, 9, 19, 23, 59, 59, 999)]
  ] as const)('%s · %s', (preset, now, w, from, to) => {
    expect(getPeriodDatesAt(preset, getBusinessToday(now, w))).toEqual({ from, to })
  })
})

describe('buildIntervals', () => {
  it.each<[string, ReturnType<typeof day>, TimeWindow, ReturnType<typeof iv>[]]>([
    ['lun 19 · W', day(2026, 9, 19), W, [iv(new Date(2026, 9, 19, 8), new Date(2026, 9, 20, 2))]],
    [
      'lun 19 – mar 20 · W',
      days(2026, 9, 19, 2026, 9, 20),
      W,
      [iv(new Date(2026, 9, 19, 8), new Date(2026, 9, 20, 2)), iv(new Date(2026, 9, 20, 8), new Date(2026, 9, 21, 2))]
    ],
    [
      'lun 19 – mar 20 · 09→13',
      days(2026, 9, 19, 2026, 9, 20),
      { startMinute: 540, endMinute: 780 },
      [iv(new Date(2026, 9, 19, 9), new Date(2026, 9, 19, 13)), iv(new Date(2026, 9, 20, 9), new Date(2026, 9, 20, 13))]
    ],
    ['lun 19 · 08→08', day(2026, 9, 19), { startMinute: 480, endMinute: 480 }, [iv(new Date(2026, 9, 19, 8), new Date(2026, 9, 20, 8))]],
    ['lun 19 · 00→00', day(2026, 9, 19), { startMinute: 0, endMinute: 0 }, [iv(new Date(2026, 9, 19, 0), new Date(2026, 9, 20, 0))]],
    ['lun 19 · 08→00', day(2026, 9, 19), { startMinute: 480, endMinute: 0 }, [iv(new Date(2026, 9, 19, 8), new Date(2026, 9, 20, 0))]],
    ['lun 19 · 08:30→01:15', day(2026, 9, 19), { startMinute: 510, endMinute: 75 }, [iv(new Date(2026, 9, 19, 8, 30), new Date(2026, 9, 20, 1, 15))]],
    ['sáb 31/10 · W (cambio de mes)', day(2026, 9, 31), W, [iv(new Date(2026, 9, 31, 8), new Date(2026, 10, 1, 2))]],
    ['jue 31/12/2026 · W (cambio de año)', day(2026, 11, 31), W, [iv(new Date(2026, 11, 31, 8), new Date(2027, 0, 1, 2))]]
  ])('%s', (_name, range, w, expected) => {
    expect(buildIntervals(range, w)).toEqual(expected)
  })

  it('octubre 2026: 31 intervalos ordenados y sin solapamientos', () => {
    const list = buildIntervals(getPeriodDatesAt('month', new Date(2026, 9, 21)), W)
    expect(list).toHaveLength(31)
    expect(list[0]).toEqual(iv(new Date(2026, 9, 1, 8), new Date(2026, 9, 2, 2)))
    expect(list[30]).toEqual(iv(new Date(2026, 9, 31, 8), new Date(2026, 10, 1, 2)))
    list.forEach((it, i) => {
      expect(it.from.getTime()).toBeLessThan(it.to.getTime())
      if (i < list.length - 1) expect(it.to.getTime()).toBeLessThanOrEqual(list[i + 1].from.getTime())
    })
  })

  it('febrero 2028 (bisiesto): 29 intervalos', () => {
    expect(buildIntervals(getPeriodDatesAt('month', new Date(2028, 1, 10)), W)).toHaveLength(29)
  })
})

describe('countDays', () => {
  it.each([
    ['lun 19', day(2026, 9, 19), 1],
    ['octubre 2026', days(2026, 9, 1, 2026, 9, 31), 31],
    ['2024 (bisiesto)', days(2024, 0, 1, 2024, 11, 31), 366],
    ['2024–2025', days(2024, 0, 1, 2025, 11, 31), 731]
  ])('%s → %i', (_name, range, expected) => {
    expect(countDays(range)).toBe(expected)
  })

  it('MAX_FILTERED_DAYS es 366', () => {
    expect(MAX_FILTERED_DAYS).toBe(366)
  })
})

describe('período anterior con la misma franja', () => {
  it('today: el anterior (lun 19) termina antes del primer intervalo actual', () => {
    const cur = day(2026, 9, 20)
    const prev = getPreviousPeriod(cur, 'today')
    const intervals = toStatsInput(prev, W).intervals!
    expect(intervals).toEqual([iv(new Date(2026, 9, 19, 8), new Date(2026, 9, 20, 2))])
    expect(intervals[0].to.getTime()).toBeLessThanOrEqual(buildIntervals(cur, W)[0].from.getTime())
  })

  it('week: 7 intervalos, el último [18 08:00 → 19 02:00)', () => {
    const prev = getPreviousPeriod(days(2026, 9, 19, 2026, 9, 25), 'week')
    const list = toStatsInput(prev, W).intervals!
    expect(list).toHaveLength(7)
    expect(list[6]).toEqual(iv(new Date(2026, 9, 18, 8), new Date(2026, 9, 19, 2)))
  })

  it('month: 30 intervalos, el último [30/9 08:00 → 1/10 02:00)', () => {
    const prev = getPreviousPeriod(getPeriodDatesAt('month', new Date(2026, 9, 21)), 'month')
    const list = toStatsInput(prev, W).intervals!
    expect(list).toHaveLength(30)
    expect(list[29]).toEqual(iv(new Date(2026, 8, 30, 8), new Date(2026, 9, 1, 2)))
  })

  it('custom 1–15/10: el anterior es 16–30/9 con 15 intervalos', () => {
    const prev = getPreviousPeriod(days(2026, 9, 1, 2026, 9, 15), 'custom')
    expect(prev).toEqual(days(2026, 8, 16, 2026, 8, 30))
    expect(toStatsInput(prev, W).intervals).toHaveLength(15)
  })
})

describe('toStatsInput', () => {
  it('sin franja no lleva la clave intervals', () => {
    const range = day(2026, 9, 19)
    const input = toStatsInput(range, null)
    expect(Object.keys(input)).toEqual(['from', 'to'])
    expect(input.from).toEqual(range.from)
    expect(input.to).toEqual(range.to)
  })

  it('con franja incluye los intervalos', () => {
    const range = days(2026, 9, 19, 2026, 9, 20)
    expect(toStatsInput(range, W).intervals).toEqual(buildIntervals(range, W))
  })
})

describe('orderHourRows', () => {
  const rows = (labels: string[]) => labels.map((label) => ({ label, saleCount: 1, totalRevenue: '1' }))
  const labels = (r: { label: string }[]) => r.map((x) => x.label)

  it('sin franja devuelve la misma referencia', () => {
    const input = rows(['01', '08', '23'])
    expect(orderHourRows(input, null)).toBe(input)
  })

  it.each<[string[], TimeWindow, string[]]>([
    [['01', '08', '23'], W, ['08', '23', '01']],
    [['00', '05', '22', '23'], { startMinute: 1350, endMinute: 360 }, ['22', '23', '00', '05']],
    [['10', '12'], { startMinute: 540, endMinute: 780 }, ['10', '12']],
    [[], W, []]
  ])('%j · %j', (input, w, expected) => {
    expect(labels(orderHourRows(rows(input), w))).toEqual(expected)
  })

  it('no muta la entrada', () => {
    const input = rows(['01', '08', '23'])
    orderHourRows(input, W)
    expect(labels(input)).toEqual(['01', '08', '23'])
  })
})

describe('describeWindow', () => {
  it.each([
    [{ startMinute: 480, endMinute: 120 }, 'De 08:00 a 02:00 del día siguiente'],
    [{ startMinute: 540, endMinute: 780 }, 'De 09:00 a 13:00'],
    [{ startMinute: 480, endMinute: 480 }, 'De 08:00 a 08:00 del día siguiente (24 h)'],
    [{ startMinute: 480, endMinute: 0 }, 'De 08:00 a 00:00 del día siguiente'],
    [{ startMinute: 0, endMinute: 0 }, 'De 00:00 a 00:00 del día siguiente (24 h)']
  ])('%j', (w, expected) => {
    expect(describeWindow(w)).toBe(expected)
  })
})

describe('resolveHourFilter', () => {
  it.each<[Parameters<typeof resolveHourFilter>[0], string, string, ReturnType<typeof resolveHourFilter>]>([
    ['all', '22:00', '06:00', { kind: 'all' }],
    ['workday', '', '', { kind: 'window', window: W }],
    ['custom', '', '', { kind: 'incomplete' }],
    ['custom', '22:00', '', { kind: 'incomplete' }],
    ['custom', '22:00', '06:0', { kind: 'incomplete' }],
    ['custom', '25:00', '06:00', { kind: 'incomplete' }],
    ['custom', '22:00', '06:00', { kind: 'window', window: { startMinute: 1320, endMinute: 360 } }],
    ['custom', '08:00', '08:00', { kind: 'window', window: { startMinute: 480, endMinute: 480 } }]
  ])('%s %j %j', (mode, a, b, expected) => {
    expect(resolveHourFilter(mode, W, a, b)).toEqual(expected)
  })
})

describe('DEFAULT_WORKDAY', () => {
  it('es 08:00 → 02:00', () => {
    expect(DEFAULT_WORKDAY).toEqual({ startMinute: 480, endMinute: 120 })
  })
})
