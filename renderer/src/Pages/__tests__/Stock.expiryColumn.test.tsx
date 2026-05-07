import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductFromApi, StockMovementFromApi } from '../../electron-api'
import Stock from '../Stock'

const listProductsMock = vi.fn()
const listLotsByProductIdsMock = vi.fn()

function product(overrides: Partial<ProductFromApi>): ProductFromApi {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Producto test',
    purchasePrice: '10',
    salePrice: '20',
    categoryId: 1,
    supplierId: 1,
    barcode: null,
    stock: 10,
    minStock: 0,
    createdAt: new Date(2026, 0, 1),
    category: { id: 1, name: 'Categoria' },
    supplier: { id: 1, name: 'Proveedor', phone: null, notes: null },
    ...overrides
  }
}

const products = [
  product({ id: 1, name: 'Yerba' }),
  product({ id: 2, name: 'Azucar' })
]

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
    product: {
      id: owner.id,
      name: owner.name,
      barcode: owner.barcode,
      purchasePrice: owner.purchasePrice,
      salePrice: owner.salePrice,
      stock: owner.stock,
      minStock: owner.minStock,
      createdAt: owner.createdAt,
      categoryId: owner.categoryId,
      supplierId: owner.supplierId
    },
    ...overrides
  }
}

beforeEach(() => {
  listProductsMock.mockReset()
  listLotsByProductIdsMock.mockReset()
  listProductsMock.mockResolvedValue(products)
  listLotsByProductIdsMock.mockResolvedValue([
    lot({ id: 1, productId: 1, quantity: 3, date: new Date(2026, 0, 2), expiryDate: null }),
    lot({ id: 2, productId: 1, quantity: 2, date: new Date(2026, 0, 1), expiryDate: new Date(2026, 4, 1) })
  ])

  ;(window as unknown as { api: unknown }).api = {
    listProducts: listProductsMock,
    listLotsByProductIds: listLotsByProductIdsMock,
    listCategories: vi.fn().mockResolvedValue([]),
    listSuppliers: vi.fn().mockResolvedValue([]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    createCategory: vi.fn(),
    createSupplier: vi.fn()
  }
})

async function renderLoadedStock() {
  render(<Stock />)
  await waitFor(() => expect(listProductsMock).toHaveBeenCalled())
  await waitFor(() => expect(screen.getByText('Yerba')).toBeInTheDocument())
}

function headerLabels(): string[] {
  return Array.from(document.querySelectorAll('.stock-grid__header')).map((node) =>
    node.textContent?.trim() ?? ''
  )
}

describe('Stock expiry column', () => {
  it('por defecto no renderiza la columna Vencimientos', async () => {
    await renderLoadedStock()

    expect(screen.queryByText('Vencimientos')).not.toBeInTheDocument()
    expect(listLotsByProductIdsMock).not.toHaveBeenCalled()
  })

  it('el boton muestra y oculta la columna', async () => {
    const user = userEvent.setup()
    await renderLoadedStock()

    await user.click(screen.getByText('Mostrar vencimientos'))
    expect(screen.getByText('Vencimientos')).toBeInTheDocument()
    expect(screen.getByText('Ocultar vencimientos')).toBeInTheDocument()

    await user.click(screen.getByText('Ocultar vencimientos'))
    expect(screen.queryByText('Vencimientos')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrar vencimientos')).toBeInTheDocument()
  })

  it('cuando la columna esta activa pide lotes con los IDs cargados', async () => {
    const user = userEvent.setup()
    await renderLoadedStock()

    await user.click(screen.getByText('Mostrar vencimientos'))

    await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalledWith([1, 2]))
  })

  it('renderiza lotes ordenados con fecha primero y sin vencimiento al final', async () => {
    const user = userEvent.setup()
    await renderLoadedStock()

    await user.click(screen.getByText('Mostrar vencimientos'))

    await waitFor(() => expect(screen.getByText(/2026-05-01/)).toBeInTheDocument())
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('2 u.')
    expect(rows[0]).toHaveTextContent('2026-05-01')
    expect(rows[1]).toHaveTextContent('3 u.')
    expect(rows[1]).toHaveTextContent('sin vencimiento')
  })

  it('muestra emptyText para productos sin lotes', async () => {
    const user = userEvent.setup()
    await renderLoadedStock()

    await user.click(screen.getByText('Mostrar vencimientos'))

    await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalled())
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('mantiene Acciones como ultima columna', async () => {
    const user = userEvent.setup()
    await renderLoadedStock()

    await user.click(screen.getByText('Mostrar vencimientos'))

    const labels = headerLabels()
    expect(labels.at(-2)).toBe('Vencimientos')
    expect(labels.at(-1)).toBe('Acciones')
  })

  it('F2 sigue abriendo el buscador de Stock con showExpiry=true', async () => {
    await renderLoadedStock()

    fireEvent.keyDown(window, { key: 'F2' })

    expect(screen.getByText('Buscador')).toBeInTheDocument()
  })
})
