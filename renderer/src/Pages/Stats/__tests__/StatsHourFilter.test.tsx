import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stats from '../Stats'
import { WORKDAY_STORAGE_KEY } from '../workdayStorage'
import type { SalesByPeriodFromApi, StatsSummaryFromApi } from '../../../electron-api'

/* eslint-disable @typescript-eslint/no-explicit-any */

const summary: StatsSummaryFromApi = { totalRevenue: '50000', saleCount: 10, averageTicket: '5000', totalProfit: '20000' }
const hourRow = (label: string, saleCount: number): SalesByPeriodFromApi => ({ label, saleCount, totalRevenue: '1000' })

const navigate = vi.fn()
let api: Record<string, ReturnType<typeof vi.fn>>

/** Fecha local (mes 0-based, como `new Date`). */
const d = (y: number, m: number, day: number, h = 0, min = 0, s = 0, ms = 0) => new Date(y, m, day, h, min, s, ms)
const iv = (from: Date, to: Date) => ({ from, to })
const periodTab = (name: string) => within(screen.getByRole('tablist', { name: 'Período' })).getByRole('tab', { name })
const hourTab = (name: string) => within(screen.getByRole('tablist', { name: 'Horario' })).getByRole('tab', { name })
/** Payload de la llamada n (0-based) a getSalesSummary: actual = 0, 2, 4…; anterior = 1, 3, 5… */
const summaryCall = (n: number) => api.getSalesSummary.mock.calls[n][0]
const lastCall = (fn: string) => api[fn].mock.calls[api[fn].mock.calls.length - 1][0]
const waitSummaryCalls = (n: number) => waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(n))
const renderStats = () => render(<Stats navigate={navigate} />)
const loaded = () => screen.findByText('Ventas totales')
const hourLabels = () =>
  Array.from(
    (screen.getByRole('heading', { name: 'Cuándo se vende más' }).closest('section') as HTMLElement).querySelectorAll(
      'tbody td.name'
    )
  ).map((td) => td.textContent)
const typeInto = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const flush = () => act(async () => {})

beforeEach(() => {
  localStorage.clear()
  // Solo se falsea Date: los setTimeout siguen siendo reales, así findBy / waitFor funcionan.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(d(2026, 9, 21, 15, 0)) // miércoles 21/10/2026 15:00
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api = {
    getSalesSummary: vi.fn().mockResolvedValue(summary),
    getTopProductsByQuantity: vi.fn().mockResolvedValue([]),
    getTopProductsByRevenue: vi.fn().mockResolvedValue([]),
    getSalesByHour: vi.fn().mockResolvedValue([hourRow('01', 2), hourRow('08', 1), hourRow('23', 1)]),
    getSalesByWeekday: vi.fn().mockResolvedValue([]),
    getLowRotationProducts: vi.fn().mockResolvedValue([])
  }
  ;(window as any).api = api
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Stats — filtro horario: payloads', () => {
  it('1. default "Todo el día" sin intervals', async () => {
    renderStats()
    await loaded()
    expect(hourTab('Todo el día')).toHaveAttribute('aria-selected', 'true')
    expect(summaryCall(0)).not.toHaveProperty('intervals')
    expect(summaryCall(1)).not.toHaveProperty('intervals')
    for (const fn of ['getTopProductsByQuantity', 'getTopProductsByRevenue', 'getSalesByHour', 'getSalesByWeekday', 'getLowRotationProducts']) {
      expect(lastCall(fn)).not.toHaveProperty('intervals')
    }
    expect(summaryCall(0).from).toEqual(d(2026, 9, 1))
  })

  it('2. Jornada + Este mes', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    const cur = summaryCall(2)
    expect(cur.from).toEqual(d(2026, 9, 1))
    expect(cur.to).toEqual(d(2026, 9, 31, 23, 59, 59, 999))
    expect(cur.intervals).toHaveLength(31)
    expect(cur.intervals[0]).toEqual(iv(d(2026, 9, 1, 8), d(2026, 9, 2, 2)))
    expect(cur.intervals[30]).toEqual(iv(d(2026, 9, 31, 8), d(2026, 10, 1, 2)))
    const prev = summaryCall(3)
    expect(prev.from).toEqual(d(2026, 8, 1))
    expect(prev.intervals).toHaveLength(30)
    expect(prev.intervals[29]).toEqual(iv(d(2026, 8, 30, 8), d(2026, 9, 1, 2)))
  })

  it('3. las 7 consultas usan la misma franja', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    for (const fn of ['getTopProductsByQuantity', 'getTopProductsByRevenue', 'getSalesByHour', 'getSalesByWeekday', 'getLowRotationProducts']) {
      await waitFor(() => expect(api[fn]).toHaveBeenCalledTimes(2))
      expect(lastCall(fn).intervals).toEqual(summaryCall(2).intervals)
    }
    expect(lastCall('getTopProductsByQuantity').limit).toBe(5)
    expect(lastCall('getLowRotationProducts').limit).toBe(10)
  })

  it('4. volver a "Todo el día" quita los intervals', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    fireEvent.click(hourTab('Todo el día'))
    await waitSummaryCalls(6)
    expect(summaryCall(4)).not.toHaveProperty('intervals')
    expect(summaryCall(5)).not.toHaveProperty('intervals')
  })

  it('5. "Hoy" + jornada a las 15:00', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Hoy'))
    await waitSummaryCalls(4)
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(6)
    expect(summaryCall(4).intervals).toEqual([iv(d(2026, 9, 21, 8), d(2026, 9, 22, 2))])
    expect(summaryCall(5).intervals).toEqual([iv(d(2026, 9, 20, 8), d(2026, 9, 21, 2))])
  })

  it('6. "Por hora" se ordena desde la apertura', async () => {
    renderStats()
    await loaded()
    expect(hourLabels()).toEqual(['01–02 h', '08–09 h', '23–00 h'])
    fireEvent.click(hourTab('Jornada laboral'))
    await waitFor(() => expect(hourLabels()).toEqual(['08–09 h', '23–00 h', '01–02 h']))
  })
})

describe('Stats — filtro horario: día comercial en curso', () => {
  it('7. Hoy a la 01:00 con jornada = lunes', async () => {
    vi.setSystemTime(d(2026, 9, 20, 1, 0))
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Hoy'))
    await waitSummaryCalls(4)
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(6)
    const cur = summaryCall(4)
    expect(cur.from).toEqual(d(2026, 9, 19))
    expect(cur.to).toEqual(d(2026, 9, 19, 23, 59, 59, 999))
    expect(cur.intervals).toEqual([iv(d(2026, 9, 19, 8), d(2026, 9, 20, 2))])
    expect(summaryCall(5).intervals).toEqual([iv(d(2026, 9, 18, 8), d(2026, 9, 19, 2))])
    await screen.findByText(/19 – 19 oct 2026 · comparado con 18 – 18 oct 2026/)
  })

  it('8. Hoy a la 01:00 sin franja = martes', async () => {
    vi.setSystemTime(d(2026, 9, 20, 1, 0))
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Hoy'))
    await waitSummaryCalls(4)
    expect(summaryCall(2).from).toEqual(d(2026, 9, 20))
    expect(summaryCall(2)).not.toHaveProperty('intervals')
  })

  it('9. Hoy a las 05:00 con jornada = martes (P3)', async () => {
    vi.setSystemTime(d(2026, 9, 20, 5, 0))
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Hoy'))
    await waitSummaryCalls(4)
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(6)
    expect(summaryCall(4).intervals).toEqual([iv(d(2026, 9, 20, 8), d(2026, 9, 21, 2))])
  })

  it('10. Este mes el 1/11 a la 01:00 con jornada = octubre', async () => {
    vi.setSystemTime(d(2026, 10, 1, 1, 0))
    renderStats()
    await loaded()
    expect(summaryCall(0).from).toEqual(d(2026, 10, 1))
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    expect(summaryCall(2).from).toEqual(d(2026, 9, 1))
    expect(summaryCall(2).intervals).toHaveLength(31)
    expect(summaryCall(3).from).toEqual(d(2026, 8, 1))
  })

  it('11. "Últimos 7 días" a la 01:00 con jornada', async () => {
    vi.setSystemTime(d(2026, 9, 20, 1, 0))
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    fireEvent.click(periodTab('Personalizado'))
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }))
    expect(screen.getByLabelText('Desde')).toHaveValue('13/10/2026')
    expect(screen.getByLabelText('Hasta')).toHaveValue('19/10/2026')
  })

  it('12. "Últimos 7 días" sin franja', async () => {
    vi.setSystemTime(d(2026, 9, 20, 1, 0))
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }))
    expect(screen.getByLabelText('Desde')).toHaveValue('14/10/2026')
    expect(screen.getByLabelText('Hasta')).toHaveValue('20/10/2026')
  })

  it('13. "Mes pasado" el 1/11 a la 01:00 con jornada', async () => {
    vi.setSystemTime(d(2026, 10, 1, 1, 0))
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    fireEvent.click(periodTab('Personalizado'))
    fireEvent.click(screen.getByRole('button', { name: 'Mes pasado' }))
    expect(screen.getByLabelText('Desde')).toHaveValue('01/09/2026')
    expect(screen.getByLabelText('Hasta')).toHaveValue('30/09/2026')
  })
})

describe('Stats — filtro horario: jornada laboral', () => {
  const saveTen = async () => {
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar jornada' }))
    typeInto('Abre', '1000')
    typeInto('Cierra', '0300')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jornada' }))
  }

  it('14. usa la jornada guardada', async () => {
    localStorage.setItem(WORKDAY_STORAGE_KEY, '{"start":"09:00","end":"21:00"}')
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    expect(screen.getByText('De 09:00 a 21:00')).toBeInTheDocument()
    expect(summaryCall(2).intervals[0]).toEqual(iv(d(2026, 9, 1, 9), d(2026, 9, 1, 21)))
  })

  it('15. storage corrupto → 08→02', async () => {
    localStorage.setItem(WORKDAY_STORAGE_KEY, '{oops')
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    expect(screen.getByText('De 08:00 a 02:00 del día siguiente')).toBeInTheDocument()
  })

  it('16. Cambiar jornada guarda y recarga', async () => {
    renderStats()
    await loaded()
    await saveTen()
    await waitSummaryCalls(6)
    expect(localStorage.getItem(WORKDAY_STORAGE_KEY)).toBe('{"start":"10:00","end":"03:00"}')
    expect(screen.getByText('De 10:00 a 03:00 del día siguiente')).toBeInTheDocument()
    expect(summaryCall(4).intervals[0]).toEqual(iv(d(2026, 9, 1, 10), d(2026, 9, 2, 3)))
  })

  it('17. hora inválida no guarda ni consulta', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar jornada' }))
    typeInto('Abre', '2500')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jornada' }))
    await flush()
    expect(screen.getByText('Ingresá una hora entre 00:00 y 23:59.')).toBeInTheDocument()
    expect(localStorage.getItem(WORKDAY_STORAGE_KEY)).toBeNull()
    expect(api.getSalesSummary).toHaveBeenCalledTimes(4)
  })

  it('18. Cancelar no cambia nada', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(4)
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar jornada' }))
    typeInto('Abre', '1000')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await flush()
    expect(screen.getByText('De 08:00 a 02:00 del día siguiente')).toBeInTheDocument()
    expect(localStorage.getItem(WORKDAY_STORAGE_KEY)).toBeNull()
    expect(api.getSalesSummary).toHaveBeenCalledTimes(4)
  })

  it('19. el modo no se recuerda, la jornada sí', async () => {
    const first = renderStats()
    await loaded()
    await saveTen()
    await waitSummaryCalls(6)
    first.unmount()
    renderStats()
    await loaded()
    expect(hourTab('Todo el día')).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(hourTab('Jornada laboral'))
    expect(screen.getByText('De 10:00 a 03:00 del día siguiente')).toBeInTheDocument()
  })
})

describe('Stats — filtro horario: personalizado', () => {
  it('20. no consulta hasta tener las dos horas', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Personalizado'))
    await flush()
    typeInto('Desde hora', '2200')
    await flush()
    expect(screen.getByLabelText('Desde hora')).toBeInTheDocument()
    expect(screen.getByLabelText('Hasta hora')).toBeInTheDocument()
    expect(screen.getByText('Completá las dos horas para aplicar el filtro.')).toBeInTheDocument()
    expect(api.getSalesSummary).toHaveBeenCalledTimes(2)
  })

  it('21. con las dos horas consulta (cruza medianoche)', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Personalizado'))
    typeInto('Desde hora', '2200')
    typeInto('Hasta hora', '0600')
    await waitSummaryCalls(4)
    expect(summaryCall(2).intervals[0]).toEqual(iv(d(2026, 9, 1, 22), d(2026, 9, 2, 6)))
    expect(screen.getByText('De 22:00 a 06:00 del día siguiente')).toBeInTheDocument()
  })

  it('22. hora fuera de rango: error y no consulta', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Personalizado'))
    typeInto('Desde hora', '2500')
    typeInto('Hasta hora', '0600')
    await flush()
    expect(screen.getByText('Ingresá una hora entre 00:00 y 23:59.')).toBeInTheDocument()
    expect(screen.getByLabelText('Desde hora')).toHaveAttribute('aria-invalid', 'true')
    expect(api.getSalesSummary).toHaveBeenCalledTimes(2)
  })

  it('23. misma hora = 24 h', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Personalizado'))
    typeInto('Desde hora', '0800')
    typeInto('Hasta hora', '0800')
    await waitSummaryCalls(4)
    expect(summaryCall(2).intervals[0]).toEqual(iv(d(2026, 9, 1, 8), d(2026, 9, 2, 8)))
    expect(screen.getByText('De 08:00 a 08:00 del día siguiente (24 h)')).toBeInTheDocument()
  })

  it('24. franja del mismo día', async () => {
    renderStats()
    await loaded()
    fireEvent.click(hourTab('Personalizado'))
    typeInto('Desde hora', '0900')
    typeInto('Hasta hora', '1300')
    await waitSummaryCalls(4)
    expect(summaryCall(2).intervals[0]).toEqual(iv(d(2026, 9, 1, 9), d(2026, 9, 1, 13)))
    expect(summaryCall(2).intervals).toHaveLength(31)
  })
})

describe('Stats — filtro horario: período personalizado', () => {
  it('25. el último día llega hasta las 02:00 del siguiente', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    typeInto('Desde', '01102026')
    typeInto('Hasta', '15102026')
    await waitSummaryCalls(4)
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(6)
    const cur = summaryCall(4).intervals
    expect(cur).toHaveLength(15)
    expect(cur[14]).toEqual(iv(d(2026, 9, 15, 8), d(2026, 9, 16, 2)))
    const prev = summaryCall(5)
    expect(prev.from).toEqual(d(2026, 8, 16))
    expect(prev.to).toEqual(d(2026, 8, 30, 23, 59, 59, 999))
    expect(prev.intervals).toHaveLength(15)
    expect(prev.intervals[14]).toEqual(iv(d(2026, 8, 30, 8), d(2026, 9, 1, 2)))
  })

  it('26. más de 366 días con franja: avisa y no consulta', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    typeInto('Desde', '01012024')
    typeInto('Hasta', '31122025')
    await waitSummaryCalls(4)
    fireEvent.click(hourTab('Jornada laboral'))
    await flush()
    expect(screen.getByText(/hasta 366 días/)).toBeInTheDocument()
    expect(api.getSalesSummary).toHaveBeenCalledTimes(4)
    fireEvent.click(hourTab('Todo el día'))
    await waitSummaryCalls(6)
    expect(screen.queryByText(/hasta 366 días/)).toBeNull()
  })

  it('27. 366 días exactos con franja sí consulta', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    typeInto('Desde', '01012024')
    typeInto('Hasta', '31122024')
    await waitSummaryCalls(4)
    fireEvent.click(hourTab('Jornada laboral'))
    await waitSummaryCalls(6)
    expect(summaryCall(4).intervals).toHaveLength(366)
    expect(screen.queryByText(/hasta 366 días/)).toBeNull()
  })
})
