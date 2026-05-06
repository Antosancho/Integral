import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { StockMovementFromApi } from '../../../electron-api'
import ExpiryAlertWidget from '../ExpiryAlertWidget'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockMovement(overrides: Partial<StockMovementFromApi> = {}): StockMovementFromApi {
  return {
    id: 1,
    productId: 1,
    type: 'IN',
    quantity: 5,
    date: new Date(),
    notes: null,
    appliedDelta: 5,
    saleId: null,
    expiryDate: null,
    expiryDismissedAt: null,
    product: {
      id: 1,
      name: 'Yerba Mate',
      barcode: null,
      purchasePrice: '500',
      salePrice: '800',
      stock: 10,
      minStock: 2,
      createdAt: new Date(),
      categoryId: 1,
      supplierId: 1
    },
    ...overrides
  }
}

/** Fecha de ayer a las 12:00 (timezone local) */
function yesterday(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(12, 0, 0, 0)
  return d
}

/** Fecha de hoy a las 12:00 (timezone local) */
function todayNoon(): Date {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Setup global del mock de window.api
// ---------------------------------------------------------------------------

const mockList = vi.fn()
const mockDismiss = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { api: unknown }).api = {
    listExpiringStockMovements: mockList,
    dismissStockMovementExpiry: mockDismiss
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpiryAlertWidget', () => {
  it('Sin items: no renderiza ningún botón', async () => {
    mockList.mockResolvedValue([])
    render(<ExpiryAlertWidget />)
    await waitFor(() => expect(mockList).toHaveBeenCalled())
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('Con items mixtos: botón dice "⚠ 1 vencido · 2 vencen hoy"', async () => {
    mockList.mockResolvedValue([
      mockMovement({ id: 1, expiryDate: yesterday() }),
      mockMovement({ id: 2, expiryDate: todayNoon() }),
      mockMovement({ id: 3, expiryDate: todayNoon() })
    ])
    render(<ExpiryAlertWidget />)
    await waitFor(() => screen.getByRole('button', { name: /Ver lotes vencidos/i }))
    expect(screen.getByRole('button', { name: /Ver lotes vencidos/i }).textContent).toBe('⚠ 1 vencido · 2 vencen hoy')
  })

  it('Solo vencidos: botón dice "⚠ 2 vencidos" sin segmento "vencen hoy"', async () => {
    mockList.mockResolvedValue([
      mockMovement({ id: 1, expiryDate: yesterday() }),
      mockMovement({ id: 2, expiryDate: yesterday() })
    ])
    render(<ExpiryAlertWidget />)
    await waitFor(() => screen.getByRole('button', { name: /Ver lotes vencidos/i }))
    expect(screen.getByRole('button', { name: /Ver lotes vencidos/i }).textContent).toBe('⚠ 2 vencidos')
  })

  it('Solo vencen hoy: botón dice "⚠ 3 vencen hoy" sin segmento "vencidos"', async () => {
    mockList.mockResolvedValue([
      mockMovement({ id: 1, expiryDate: todayNoon() }),
      mockMovement({ id: 2, expiryDate: todayNoon() }),
      mockMovement({ id: 3, expiryDate: todayNoon() })
    ])
    render(<ExpiryAlertWidget />)
    await waitFor(() => screen.getByRole('button', { name: /Ver lotes vencidos/i }))
    expect(screen.getByRole('button', { name: /Ver lotes vencidos/i }).textContent).toBe('⚠ 3 vencen hoy')
  })

  it('Click abre popup; segundo click cierra popup', async () => {
    const user = userEvent.setup()
    mockList.mockResolvedValue([mockMovement({ id: 1, expiryDate: yesterday() })])
    render(<ExpiryAlertWidget />)
    const btn = await waitFor(() => screen.getByRole('button', { name: /Ver lotes vencidos/i }))

    // Abrir
    await user.click(btn)
    expect(screen.getByText('Vencidos')).toBeInTheDocument()

    // Cerrar
    await user.click(btn)
    expect(screen.queryByText('Vencidos')).toBeNull()
  })

  it('Click en "Ya lo saqué" llama dismissStockMovementExpiry y remueve la fila', async () => {
    const user = userEvent.setup()
    mockDismiss.mockResolvedValue({})
    mockList.mockResolvedValue([mockMovement({ id: 42, expiryDate: yesterday() })])
    render(<ExpiryAlertWidget />)
    const btn = await waitFor(() => screen.getByRole('button', { name: /Ver lotes vencidos/i }))
    await user.click(btn) // abrir popup

    await waitFor(() => screen.getByText('Ya lo saqué'))
    await user.click(screen.getByText('Ya lo saqué'))

    await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith(42))
    // La fila ya no aparece
    expect(screen.queryByText('Yerba Mate')).toBeNull()
  })

  it('Click en "Recordame luego" NO llama al backend pero remueve la fila', async () => {
    const user = userEvent.setup()
    mockList.mockResolvedValue([mockMovement({ id: 7, expiryDate: yesterday() })])
    render(<ExpiryAlertWidget />)
    const btn = await waitFor(() => screen.getByRole('button', { name: /Ver lotes vencidos/i }))
    await user.click(btn)

    await waitFor(() => screen.getByText('Recordame luego'))
    await user.click(screen.getByText('Recordame luego'))

    expect(mockDismiss).not.toHaveBeenCalled()
    expect(screen.queryByText('Yerba Mate')).toBeNull()
  })

  it('Cuando todos se descartan, el botón consolidado desaparece', async () => {
    const user = userEvent.setup()
    mockDismiss.mockResolvedValue({})
    mockList.mockResolvedValue([mockMovement({ id: 1, expiryDate: yesterday() })])
    render(<ExpiryAlertWidget />)
    const btn = await waitFor(() => screen.getByRole('button', { name: /Ver lotes vencidos/i }))
    await user.click(btn)
    await waitFor(() => screen.getByText('Ya lo saqué'))
    await user.click(screen.getByText('Ya lo saqué'))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Ver lotes vencidos/i })).toBeNull())
  })

  it('Si la API falla al montar, el componente no rompe la app y no renderiza botón', async () => {
    mockList.mockRejectedValue(new Error('Network error'))
    render(<ExpiryAlertWidget />)
    await waitFor(() => expect(mockList).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Ver lotes vencidos/i })).toBeNull()
  })
})
