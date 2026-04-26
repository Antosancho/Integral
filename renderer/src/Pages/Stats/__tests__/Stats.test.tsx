import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Stats from '../Stats'
import type {
  StatsSummaryFromApi,
  TopProductFromApi,
  SalesByPeriodFromApi,
  LowRotationFromApi
} from '../../../electron-api'

// ---------------------------------------------------------------------------
// Datos mock
// ---------------------------------------------------------------------------

const mockSummary: StatsSummaryFromApi = {
  totalRevenue: '50000',
  saleCount: 10,
  averageTicket: '5000',
  totalProfit: '20000'
}

const mockTopProduct: TopProductFromApi = {
  productId: 1,
  productName: 'Coca Cola',
  value: '100'
}

const mockPeriodRow: SalesByPeriodFromApi = {
  label: '10',
  saleCount: 3,
  totalRevenue: '15000'
}

const mockLowRot: LowRotationFromApi = {
  productId: 2,
  productName: 'Aceite',
  totalQuantity: 1
}

// ---------------------------------------------------------------------------
// Setup: inyectar window.api antes de cada test
// ---------------------------------------------------------------------------

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    getSalesSummary: vi.fn().mockResolvedValue(mockSummary),
    getTopProductsByQuantity: vi.fn().mockResolvedValue([mockTopProduct]),
    getTopProductsByRevenue: vi.fn().mockResolvedValue([mockTopProduct]),
    getSalesByHour: vi.fn().mockResolvedValue([mockPeriodRow]),
    getSalesByWeekday: vi.fn().mockResolvedValue([mockPeriodRow]),
    getLowRotationProducts: vi.fn().mockResolvedValue([mockLowRot])
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stats', () => {
  it('renderiza los 4 botones de período', () => {
    render(<Stats />)
    expect(screen.getByText('Hoy')).toBeDefined()
    expect(screen.getByText('Esta semana')).toBeDefined()
    expect(screen.getByText('Este mes')).toBeDefined()
    expect(screen.getByText('Personalizado')).toBeDefined()
  })

  it('el preset default "Este mes" está activo al montar', () => {
    render(<Stats />)
    const btn = screen.getByText('Este mes')
    expect(btn.className).toContain('stats-period-btn--active')
  })

  it('al montar llama a getSalesSummary exactamente 2 veces (actual + anterior)', async () => {
    render(<Stats />)
    const api = (window as unknown as { api: { getSalesSummary: ReturnType<typeof vi.fn> } }).api
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(2))
  })

  it('al montar llama a las 7 funciones de la API', async () => {
    render(<Stats />)
    const api = (window as unknown as { api: Record<string, ReturnType<typeof vi.fn>> }).api
    await waitFor(() => {
      expect(api.getSalesSummary).toHaveBeenCalled()
      expect(api.getTopProductsByQuantity).toHaveBeenCalled()
      expect(api.getTopProductsByRevenue).toHaveBeenCalled()
      expect(api.getSalesByHour).toHaveBeenCalled()
      expect(api.getSalesByWeekday).toHaveBeenCalled()
      expect(api.getLowRotationProducts).toHaveBeenCalled()
    })
  })

  it('muestra "Cargando..." mientras fetchea', () => {
    // Promesas que nunca resuelven → estado de carga perpetuo
    ;(window as unknown as { api: unknown }).api = {
      getSalesSummary: vi.fn().mockReturnValue(new Promise(() => {})),
      getTopProductsByQuantity: vi.fn().mockReturnValue(new Promise(() => {})),
      getTopProductsByRevenue: vi.fn().mockReturnValue(new Promise(() => {})),
      getSalesByHour: vi.fn().mockReturnValue(new Promise(() => {})),
      getSalesByWeekday: vi.fn().mockReturnValue(new Promise(() => {})),
      getLowRotationProducts: vi.fn().mockReturnValue(new Promise(() => {}))
    }
    render(<Stats />)
    expect(screen.getByText('Cargando...')).toBeDefined()
  })

  it('después de cargar muestra las 4 cards de resumen', async () => {
    render(<Stats />)
    await waitFor(() => {
      expect(screen.getByText('Ventas Totales')).toBeDefined()
      expect(screen.getByText('Cantidad de Ventas')).toBeDefined()
      expect(screen.getByText('Ticket Promedio')).toBeDefined()
      expect(screen.getByText('Ganancia Total')).toBeDefined()
    })
  })

  it('muestra el valor formateado de totalRevenue en la card (contiene $ y el valor)', async () => {
    render(<Stats />)
    await waitFor(() => {
      // formatMoney en es-AR produce algo como "$ 50.000,00"
      const matches = screen.getAllByText((_, el) =>
        (el?.textContent ?? '').includes('$') && (el?.textContent ?? '').includes('50')
      )
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  it('muestra la tabla "Más vendidos" con el producto mockeado', async () => {
    render(<Stats />)
    await waitFor(() => {
      const items = screen.getAllByText('Coca Cola')
      expect(items.length).toBeGreaterThan(0)
    })
  })

  it('la sección temporal muestra "Por hora" activo por default', async () => {
    render(<Stats />)
    await waitFor(() => {
      const btn = screen.getByText('Por hora')
      expect(btn.className).toContain('stats-temporal-tab--active')
    })
  })

  it('la tabla temporal muestra el label de hora formateado (10:00)', async () => {
    render(<Stats />)
    await waitFor(() => {
      expect(screen.getByText('10:00')).toBeDefined()
    })
  })

  it('click en "Por día de semana" cambia la tab activa', async () => {
    render(<Stats />)
    await waitFor(() => screen.getByText('Por hora'))
    fireEvent.click(screen.getByText('Por día de semana'))
    await waitFor(() => {
      const btn = screen.getByText('Por día de semana')
      expect(btn.className).toContain('stats-temporal-tab--active')
    })
  })

  it('muestra la tabla de baja rotación con el producto mockeado', async () => {
    render(<Stats />)
    await waitFor(() => {
      expect(screen.getByText('Aceite')).toBeDefined()
    })
  })

  it('click en "Esta semana" recarga los datos (getSalesSummary llamado más veces)', async () => {
    render(<Stats />)
    const api = (window as unknown as { api: { getSalesSummary: ReturnType<typeof vi.fn> } }).api
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByText('Esta semana'))
    await waitFor(() => expect(api.getSalesSummary.mock.calls.length).toBeGreaterThan(2))
  })

  it('click en "Hoy" recarga los datos', async () => {
    render(<Stats />)
    const api = (window as unknown as { api: { getSalesSummary: ReturnType<typeof vi.fn> } }).api
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByText('Hoy'))
    await waitFor(() => expect(api.getSalesSummary.mock.calls.length).toBeGreaterThan(2))
  })

  it('al seleccionar "Personalizado" aparecen los dos inputs de fecha', async () => {
    render(<Stats />)
    fireEvent.click(screen.getByText('Personalizado'))
    await waitFor(() => {
      const inputs = screen.getAllByDisplayValue('')
      expect(inputs.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('con "Personalizado" sin fechas no dispara fetch adicional', async () => {
    render(<Stats />)
    const api = (window as unknown as { api: { getSalesSummary: ReturnType<typeof vi.fn> } }).api
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByText('Personalizado'))
    // Sin completar fechas no debe llamar más veces
    expect(api.getSalesSummary.mock.calls.length).toBe(2)
  })

  it('con "Personalizado" con ambas fechas completas dispara fetch', async () => {
    render(<Stats />)
    const api = (window as unknown as { api: { getSalesSummary: ReturnType<typeof vi.fn> } }).api
    await waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByText('Personalizado'))
    const inputs = screen.getAllByDisplayValue('')
    fireEvent.change(inputs[0], { target: { value: '2025-01-01' } })
    fireEvent.change(inputs[1], { target: { value: '2025-01-31' } })
    await waitFor(() => expect(api.getSalesSummary.mock.calls.length).toBeGreaterThan(2))
  })

  it('error de API muestra mensaje de error y no muestra cards', async () => {
    ;(window as unknown as { api: unknown }).api = {
      getSalesSummary: vi.fn().mockRejectedValue(new Error('Fallo de red')),
      getTopProductsByQuantity: vi.fn().mockResolvedValue([]),
      getTopProductsByRevenue: vi.fn().mockResolvedValue([]),
      getSalesByHour: vi.fn().mockResolvedValue([]),
      getSalesByWeekday: vi.fn().mockResolvedValue([]),
      getLowRotationProducts: vi.fn().mockResolvedValue([])
    }
    render(<Stats />)
    await waitFor(() => {
      expect(screen.getByText('Fallo de red')).toBeDefined()
    })
    expect(screen.queryByText('Ventas Totales')).toBeNull()
  })

  it('la card de cantidad de ventas muestra el saleCount del mock', async () => {
    render(<Stats />)
    await waitFor(() => {
      expect(screen.getByText('10')).toBeDefined()
    })
  })

  it('el cambio % aparece como +0.0% cuando current y previous son iguales', async () => {
    render(<Stats />)
    await waitFor(() => {
      const matches = screen.getAllByText('+0.0% vs período anterior')
      expect(matches.length).toBeGreaterThan(0)
    })
  })
})
