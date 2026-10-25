import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StockMovementFromApi } from '../../electron-api'
import { makeProduct } from '../../test/fixtures'
import { renderWithProviders } from '../../test/renderWithProviders'
import StockProducts from '../Stock/StockProducts'

const listProductsMock = vi.fn()
const listLotsByProductIdsMock = vi.fn()

const products = [makeProduct({ id: 1, name: 'Yerba' }), makeProduct({ id: 2, name: 'Azucar' })]

function lot(overrides: Partial<StockMovementFromApi>): StockMovementFromApi {
  const owner = products.find((p) => p.id === (overrides.productId ?? 1)) ?? products[0]
  return {
    id: overrides.id ?? 1,
    productId: overrides.productId ?? owner.id,
    type: 'IN',
    quantity: overrides.quantity ?? 1,
    date: overrides.date ?? new Date(2026, 0, 1),
    notes: null,
    appliedDelta: null,
    saleId: null,
    expiryDate: overrides.expiryDate ?? null,
    expiryDismissedAt: null,
    product: owner,
    ...overrides,
  }
}

beforeEach(() => {
  listProductsMock.mockReset().mockResolvedValue(products)
  listLotsByProductIdsMock.mockReset().mockResolvedValue([
    lot({ id: 1, productId: 1, quantity: 3, date: new Date(2026, 0, 2), expiryDate: null }),
    lot({ id: 2, productId: 1, quantity: 2, date: new Date(2026, 0, 1), expiryDate: new Date(2026, 4, 1) }),
  ])
  ;(window as unknown as { api: unknown }).api = {
    listProducts: listProductsMock,
    listLotsByProductIds: listLotsByProductIdsMock,
    listCategories: vi.fn().mockResolvedValue([]),
    listSuppliers: vi.fn().mockResolvedValue([]),
  }
})

async function renderLoadedStock() {
  renderWithProviders(<StockProducts viewSwitcher={null} navigate={vi.fn()} />)
  await waitFor(() => expect(listProductsMock).toHaveBeenCalled())
  await screen.findByText('Yerba', { selector: 'td.name' })
}

const toggle = () => screen.getByRole('button', { name: 'Vencimientos' })
const headerLabels = () => Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent?.trim() ?? '')

describe('Stock › columna Vencimientos', () => {
  it('por defecto no hay columna Vencimientos ni se piden lotes', async () => {
    await renderLoadedStock()
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    expect(headerLabels()).not.toContain('Vencimientos')
    expect(listLotsByProductIdsMock).not.toHaveBeenCalled()
  })

  it('el botón muestra y oculta la columna', async () => {
    await renderLoadedStock()
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    expect(headerLabels()).toContain('Vencimientos')

    fireEvent.click(toggle())
    expect(headerLabels()).not.toContain('Vencimientos')
  })

  it('con la columna activa pide los lotes con los ids cargados', async () => {
    await renderLoadedStock()
    fireEvent.click(toggle())
    await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalledWith([1, 2]))
  })

  it('renderiza los lotes ordenados: con fecha primero y sin vencimiento al final', async () => {
    await renderLoadedStock()
    fireEvent.click(toggle())

    await waitFor(() => expect(screen.getByText(/01\/05\/2026/)).toBeInTheDocument())
    const badges = document.querySelectorAll('.ig-badge')
    expect(badges[0]).toHaveTextContent('2 u.')
    expect(badges[0]).toHaveTextContent('01/05/2026')
    expect(badges[1]).toHaveTextContent('3 u.')
    expect(badges[1]).toHaveTextContent('sin vencimiento')
  })

  it('muestra "—" para los productos sin lotes', async () => {
    await renderLoadedStock()
    fireEvent.click(toggle())
    await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalled())
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('mantiene Acciones como última columna', async () => {
    await renderLoadedStock()
    fireEvent.click(toggle())
    const labels = headerLabels()
    expect(labels.at(-2)).toBe('Vencimientos')
    expect(labels.at(-1)).toBe('Acciones')
  })
})
