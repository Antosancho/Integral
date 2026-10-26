import { render, screen } from '@testing-library/react'
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
  it('sin lotes renderiza el emptyText por defecto y ningún badge', () => {
    const { container } = render(<LotsList lots={[]} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(container.querySelector('.ig-badge')).toBeNull()
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

    const rows = document.querySelectorAll('.ig-badge')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('2 u.')
    expect(rows[0]).toHaveTextContent('01/05/2026')
  })

  it('muestra "sin vencimiento" cuando expiryDate es null', () => {
    render(<LotsList lots={[lot({ id: 1, quantity: 2, expiryDate: null })]} />)

    expect(document.querySelector('.ig-badge')).toHaveTextContent('sin vencimiento')
    expect(document.querySelector('.ig-badge')).toHaveClass('ig-badge-neutral')
  })

  it('marca en rojo (ig-badge-danger) un lote vencido', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    render(<LotsList lots={[lot({ id: 1, expiryDate: yesterday })]} />)

    expect(document.querySelector('.ig-badge')).toHaveClass('ig-badge-danger')
  })

  it('marca en azul (ig-badge-info) un lote que vence hoy', () => {
    const today = new Date()

    render(<LotsList lots={[lot({ id: 1, expiryDate: today })]} />)

    expect(document.querySelector('.ig-badge')).toHaveClass('ig-badge-info')
  })
})
