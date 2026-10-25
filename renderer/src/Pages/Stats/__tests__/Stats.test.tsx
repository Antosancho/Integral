import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Stats from '../Stats'
import type {
  StatsSummaryFromApi,
  TopProductFromApi,
  SalesByPeriodFromApi,
  LowRotationFromApi
} from '../../../electron-api'

/* eslint-disable @typescript-eslint/no-explicit-any */

const summary = (o: Partial<StatsSummaryFromApi> = {}): StatsSummaryFromApi => ({
  totalRevenue: '50000',
  saleCount: 10,
  averageTicket: '5000',
  totalProfit: '20000',
  ...o
})

const top = (id: number, name: string, value: string): TopProductFromApi => ({ productId: id, productName: name, value })
const hourRow = (label: string, saleCount: number, totalRevenue = '15000'): SalesByPeriodFromApi => ({ label, saleCount, totalRevenue })
const lowRow = (id: number, name: string, totalQuantity: number): LowRotationFromApi => ({ productId: id, productName: name, totalQuantity })

const navigate = vi.fn()
let api: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  navigate.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api = {
    getSalesSummary: vi.fn().mockResolvedValue(summary()),
    getTopProductsByQuantity: vi.fn().mockResolvedValue([top(1, 'Coca Cola', '100'), top(2, 'Yerba', '50')]),
    getTopProductsByRevenue: vi.fn().mockResolvedValue([top(1, 'Coca Cola', '80000')]),
    getSalesByHour: vi.fn().mockResolvedValue([hourRow('10', 3), hourRow('18', 7)]),
    getSalesByWeekday: vi.fn().mockResolvedValue([hourRow('1', 4), hourRow('6', 9)]),
    getLowRotationProducts: vi.fn().mockResolvedValue([lowRow(9, 'Aceite', 1)])
  }
  ;(window as any).api = api
})

afterEach(() => {
  vi.useRealTimers()
})

const renderStats = () => render(<Stats navigate={navigate} />)
const loaded = async () => screen.findByText('Ventas totales')
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement
const periodTab = (name: string) => within(screen.getByRole('tablist', { name: 'Período' })).getByRole('tab', { name })

describe('Stats — período y carga', () => {
  it('llama a las 7 funciones de la API (getSalesSummary dos veces: actual y anterior)', async () => {
    renderStats()
    await loaded()
    expect(api.getSalesSummary).toHaveBeenCalledTimes(2)
    for (const fn of ['getTopProductsByQuantity', 'getTopProductsByRevenue', 'getSalesByHour', 'getSalesByWeekday', 'getLowRotationProducts']) {
      expect(api[fn]).toHaveBeenCalledTimes(1)
    }
  })

  it('los rankings piden 5 productos y la menor rotación 10', async () => {
    renderStats()
    await loaded()
    expect(api.getTopProductsByQuantity.mock.calls[0][0].limit).toBe(5)
    expect(api.getLowRotationProducts.mock.calls[0][0].limit).toBe(10)
  })

  it('por defecto está seleccionado "Este mes" (aria-selected)', async () => {
    renderStats()
    expect(screen.getByRole('tab', { name: 'Este mes' })).toHaveAttribute('aria-selected', 'true')
    await loaded()
  })

  it('muestra el rango actual y el período anterior en el encabezado', async () => {
    renderStats()
    await loaded()
    expect(screen.getByText(/comparado con/)).toBeInTheDocument()
  })

  it('cambiar a "Hoy" recarga los datos', async () => {
    renderStats()
    await loaded()
    fireEvent.click(screen.getByRole('tab', { name: 'Hoy' }))
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(4))
    expect(screen.getByRole('tab', { name: 'Hoy' })).toHaveAttribute('aria-selected', 'true')
  })

  it('"Esta semana" también recarga', async () => {
    renderStats()
    await loaded()
    fireEvent.click(screen.getByRole('tab', { name: 'Esta semana' }))
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(4))
  })

  it('no muestra datos hasta terminar de cargar y el skeleton aparece pasados 300 ms', async () => {
    vi.useFakeTimers()
    api.getSalesSummary.mockReturnValue(new Promise(() => {}))
    renderStats()
    expect(screen.queryByText('Ventas totales')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(screen.queryByText('Calculando…')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getAllByText('Calculando…').length).toBeGreaterThan(0)
  })

  it('error de API: "No pudimos calcular las estadísticas" y Reintentar recarga', async () => {
    api.getSalesSummary.mockRejectedValueOnce(new Error('boom'))
    renderStats()
    expect(await screen.findByText('No pudimos calcular las estadísticas')).toBeInTheDocument()
    expect(screen.queryByText('Ventas totales')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await loaded()
  })
})

describe('Stats — KPIs', () => {
  it('muestra los 4 KPIs con montos $ y la cantidad', async () => {
    renderStats()
    await loaded()
    expect(screen.getByText('Cantidad de ventas')).toBeInTheDocument()
    expect(screen.getByText('Ticket promedio')).toBeInTheDocument()
    expect(screen.getByText('Ganancia total')).toBeInTheDocument()
    expect(screen.getByText('$ 50.000,00')).toBeInTheDocument()
    expect(screen.getByText('$ 5.000,00')).toBeInTheDocument()
    expect(screen.getByText('$ 20.000,00')).toBeInTheDocument()
    expect(screen.getByText('10', { selector: '.ig-kpi .v' })).toBeInTheDocument()
  })

  it('con ventas iguales al período anterior muestra "0,0 %" y "vs. {mes}"', async () => {
    renderStats()
    await loaded()
    expect(screen.getAllByText('0,0 %')).toHaveLength(4)
    const now = new Date()
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const prev = months[(now.getMonth() + 11) % 12]
    expect(screen.getAllByText(`vs. ${prev}`)).toHaveLength(4)
  })

  it('un aumento se muestra como "+100,0 %"', async () => {
    api.getSalesSummary.mockResolvedValueOnce(summary({ totalRevenue: '100000' })).mockResolvedValueOnce(summary({ totalRevenue: '50000' }))
    renderStats()
    await loaded()
    expect(screen.getByText('+100,0 %')).toBeInTheDocument()
  })

  it('período anterior en 0: "Sin datos para comparar"', async () => {
    api.getSalesSummary
      .mockResolvedValueOnce(summary())
      .mockResolvedValueOnce(summary({ totalRevenue: '0', saleCount: 0, averageTicket: '0', totalProfit: '0' }))
    renderStats()
    await loaded()
    expect(screen.getAllByText('Sin datos para comparar')).toHaveLength(4)
  })

  it('sin ventas en el período: KPIs en "—" y "Sin ventas en este período" en las tarjetas', async () => {
    api.getSalesSummary.mockResolvedValue(summary({ totalRevenue: '0', saleCount: 0, averageTicket: '0', totalProfit: '0' }))
    api.getTopProductsByQuantity.mockResolvedValue([])
    api.getTopProductsByRevenue.mockResolvedValue([])
    api.getSalesByHour.mockResolvedValue([])
    api.getSalesByWeekday.mockResolvedValue([])
    api.getLowRotationProducts.mockResolvedValue([])
    renderStats()
    await loaded()
    expect(screen.getAllByText('—', { selector: '.ig-kpi .v' })).toHaveLength(4)
    expect(screen.getAllByText('Sin ventas en este período')).toHaveLength(4)
  })
})

describe('Stats — rankings y tablas', () => {
  it('"más vendidos" muestra unidades y "que más facturan" montos', async () => {
    renderStats()
    await loaded()
    expect(within(card('Productos más vendidos')).getByText('100 u.')).toBeInTheDocument()
    expect(within(card('Productos que más facturan')).getByText('$ 80.000,00')).toBeInTheDocument()
  })

  it('click en un producto de un ranking abre Stock › Movimientos de ese producto', async () => {
    renderStats()
    await loaded()
    fireEvent.click(within(card('Productos más vendidos')).getByRole('button', { name: 'Yerba' }))
    expect(navigate).toHaveBeenCalledWith({
      section: 'stock',
      stockView: 'movements',
      movementsProduct: { id: 2, name: 'Yerba' }
    })
  })

  it('click en un producto de menor rotación también navega a Movimientos', async () => {
    renderStats()
    await loaded()
    fireEvent.click(within(card('Menor rotación')).getByRole('button', { name: 'Aceite' }))
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ movementsProduct: { id: 9, name: 'Aceite' } }))
  })

  it('"Cuándo se vende más": por hora con etiqueta de franja y el pico resaltado', async () => {
    renderStats()
    await loaded()
    const temporal = card('Cuándo se vende más')
    expect(within(temporal).getByText('10–11 h')).toBeInTheDocument()
    expect(within(temporal).getByText('18–19 h')).toBeInTheDocument()
    const bars = temporal.querySelectorAll('.ig-bar > i')
    expect(bars[1]).toHaveClass('is-peak')
    expect(bars[0]).not.toHaveClass('is-peak')
    expect((bars[1] as HTMLElement).style.width).toBe('100%')
  })

  it('la pestaña "Por día de semana" muestra los días', async () => {
    renderStats()
    await loaded()
    fireEvent.click(screen.getByRole('tab', { name: 'Por día de semana' }))
    const temporal = card('Cuándo se vende más')
    expect(within(temporal).getByText('Lunes')).toBeInTheDocument()
    expect(within(temporal).getByText('Sábado')).toBeInTheDocument()
  })

  it('"Menor rotación" muestra 5 filas y "Ver los 10" expande las demás', async () => {
    api.getLowRotationProducts.mockResolvedValue(Array.from({ length: 10 }, (_, i) => lowRow(i + 1, `Prod ${i + 1}`, i)))
    renderStats()
    await loaded()
    const section = () => card('Menor rotación')
    expect(section().querySelectorAll('tbody tr')).toHaveLength(5)

    fireEvent.click(within(section()).getByRole('button', { name: 'Ver los 10' }))
    expect(section().querySelectorAll('tbody tr')).toHaveLength(10)

    fireEvent.click(within(section()).getByRole('button', { name: 'Ver menos' }))
    expect(section().querySelectorAll('tbody tr')).toHaveLength(5)
  })

  it('con 5 productos o menos no ofrece "Ver los 10"', async () => {
    renderStats()
    await loaded()
    expect(screen.queryByRole('button', { name: /^Ver los/ })).toBeNull()
  })
})

describe('Stats — período personalizado', () => {
  it('"Personalizado" muestra Desde / Hasta y no consulta hasta tener ambas fechas', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    expect(screen.getByLabelText('Desde')).toBeInTheDocument()
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument()
    await act(async () => {})
    expect(api.getSalesSummary).toHaveBeenCalledTimes(2)
  })

  it('con ambas fechas válidas dispara la carga con ese rango', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '01102026' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '15102026' } })
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(4))
    const call = api.getSalesSummary.mock.calls[2][0]
    expect(call.from).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0))
    expect(call.to).toEqual(new Date(2026, 9, 15, 23, 59, 59, 999))
    expect(await screen.findByText(/1 – 15 oct 2026/)).toBeInTheDocument()
  })

  it('desde > hasta no consulta', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '20102026' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '10102026' } })
    await act(async () => {})
    expect(api.getSalesSummary).toHaveBeenCalledTimes(2)
  })

  it('"Últimos 7 días" completa las fechas y dispara la carga', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    fireEvent.click(screen.getByRole('button', { name: 'Últimos 7 días' }))
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(4))
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('"Mes pasado" completa el primer y último día del mes anterior', async () => {
    renderStats()
    await loaded()
    fireEvent.click(periodTab('Personalizado'))
    fireEvent.click(screen.getByRole('button', { name: 'Mes pasado' }))
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(4))
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe(`01/${pad(first.getMonth() + 1)}/${first.getFullYear()}`)
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe(`${pad(last.getDate())}/${pad(last.getMonth() + 1)}/${last.getFullYear()}`)
  })
})
