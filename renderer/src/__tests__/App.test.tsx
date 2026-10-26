import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { popModal, pushModal } from '../ui/modalStack'

/** API mínima con todo lo que consultan las pantallas al montarse, siempre con listas vacías. */
function installApi() {
  const zeroSummary = { totalRevenue: '0', saleCount: 0, averageTicket: '0', totalProfit: '0' }
  ;(window as unknown as { api: unknown }).api = {
    listExpiringStockMovements: vi.fn().mockResolvedValue([]),
    listProducts: vi.fn().mockResolvedValue([]),
    listLotsByProductIds: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
    listSuppliers: vi.fn().mockResolvedValue([]),
    listStockMovements: vi.fn().mockResolvedValue([]),
    listSales: vi.fn().mockResolvedValue([]),
    getProductByBarcode: vi.fn().mockResolvedValue(null),
    getSalesSummary: vi.fn().mockResolvedValue(zeroSummary),
    getTopProductsByQuantity: vi.fn().mockResolvedValue([]),
    getTopProductsByRevenue: vi.fn().mockResolvedValue([]),
    getSalesByHour: vi.fn().mockResolvedValue([]),
    getSalesByWeekday: vi.fn().mockResolvedValue([]),
    getLowRotationProducts: vi.fn().mockResolvedValue([]),
  }
}

const ctrl = (key: string) => fireEvent.keyDown(window, { key, ctrlKey: true })

describe('App', () => {
  beforeEach(installApi)
  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api
  })

  it('arranca en Stock (botón Stock con aria-current)', async () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Stock' })).toHaveAttribute('aria-current', 'page')
    await waitFor(() => expect(window.api.listProducts).toHaveBeenCalled())
  })

  it('Ctrl+2 cambia a Ventas y Ctrl+3 a Estadísticas', async () => {
    render(<App />)
    await act(async () => ctrl('2'))
    expect(screen.getByRole('button', { name: 'Ventas' })).toHaveAttribute('aria-current', 'page')
    await act(async () => ctrl('3'))
    expect(screen.getByRole('button', { name: 'Estadísticas' })).toHaveAttribute('aria-current', 'page')
    await act(async () => ctrl('1'))
    expect(screen.getByRole('button', { name: 'Stock' })).toHaveAttribute('aria-current', 'page')
  })

  it('con un modal abierto, Ctrl+2 no navega', async () => {
    render(<App />)
    pushModal()
    try {
      await act(async () => ctrl('2'))
      expect(screen.getByRole('button', { name: 'Stock' })).toHaveAttribute('aria-current', 'page')
    } finally {
      popModal()
    }
  })

  it('click en el botón de navegación cambia de sección', async () => {
    render(<App />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ventas' }))
    })
    expect(screen.getByRole('button', { name: 'Ventas' })).toHaveAttribute('aria-current', 'page')
  })
})
