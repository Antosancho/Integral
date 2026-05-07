import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BareProductFromApi, StockMovementFromApi } from '../../../electron-api'
import LotsList from '../LotsList'

const product: BareProductFromApi = {
  id: 1,
  name: 'Producto test',
  barcode: null,
  purchasePrice: '10',
  salePrice: '20',
  stock: 10,
  minStock: 0,
  createdAt: new Date(2026, 0, 1),
  categoryId: 1,
  supplierId: 1
}

function lot(overrides: Partial<StockMovementFromApi>): StockMovementFromApi {
  return {
    id: overrides.id ?? 1,
    productId: overrides.productId ?? 1,
    type: 'IN',
    quantity: overrides.quantity ?? 1,
    date: overrides.date ?? new Date(2026, 0, 1),
    notes: null,
    appliedDelta: null,
    saleId: null,
    expiryDate: overrides.expiryDate ?? null,
    expiryDismissedAt: null,
    product,
    ...overrides
  }
}

describe('LotsList', () => {
  it('sin lotes renderiza el emptyText por defecto y no renderiza ul', () => {
    const { container } = render(<LotsList lots={[]} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(container.querySelector('ul')).toBeNull()
  })

  it('respeta un emptyText custom', () => {
    render(<LotsList lots={[]} emptyText="Sin lotes" />)

    expect(screen.getByText('Sin lotes')).toBeInTheDocument()
  })

  it('renderiza una fila por lote con cantidad y fecha', () => {
    render(
      <LotsList
        lots={[
          lot({ id: 1, quantity: 2, expiryDate: new Date(2026, 4, 1) }),
          lot({ id: 2, quantity: 3, expiryDate: new Date(2026, 4, 2) }),
          lot({ id: 3, quantity: 4, expiryDate: new Date(2026, 4, 3) })
        ]}
      />
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('2 u.')).toBeInTheDocument()
    expect(rows[0]).toHaveTextContent('2026-05-01')
  })

  it('muestra "sin vencimiento" cuando expiryDate es null', () => {
    render(<LotsList lots={[lot({ id: 1, quantity: 2, expiryDate: null })]} />)

    expect(screen.getByRole('listitem')).toHaveTextContent('sin vencimiento')
  })

  it('marca como expired un lote vencido', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    render(<LotsList lots={[lot({ id: 1, expiryDate: yesterday })]} />)

    expect(screen.getByRole('listitem')).toHaveClass('lots-list__item--expired')
  })

  it('marca como today un lote que vence hoy', () => {
    const today = new Date()

    render(<LotsList lots={[lot({ id: 1, expiryDate: today })]} />)

    expect(screen.getByRole('listitem')).toHaveClass('lots-list__item--today')
  })
})
