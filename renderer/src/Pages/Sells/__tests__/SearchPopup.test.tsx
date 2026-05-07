import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import type { StockMovementFromApi } from '../../../electron-api'
import SearchPopup from '../SearchPopup'
import { searchProducts } from '../searchProducts'

vi.mock('../searchProducts', () => ({
  searchProducts: vi.fn()
}))

const products: ProductFromApi[] = [
  {
    id: 1,
    name: 'Coca Cola',
    purchasePrice: '100',
    salePrice: '150',
    categoryId: 1,
    supplierId: 1,
    barcode: 123n,
    stock: 10,
    minStock: 2,
    createdAt: new Date(),
    category: { id: 1, name: 'Bebidas' },
    supplier: { id: 1, name: 'Proveedor', phone: null, notes: null }
  },
  {
    id: 2,
    name: 'Agua',
    purchasePrice: '80',
    salePrice: '120',
    categoryId: 1,
    supplierId: 1,
    barcode: 456n,
    stock: 5,
    minStock: 1,
    createdAt: new Date(),
    category: { id: 1, name: 'Bebidas' },
    supplier: { id: 1, name: 'Proveedor', phone: null, notes: null }
  }
]

const searchProductsMock = vi.mocked(searchProducts)
const listLotsByProductIdsMock = vi.fn()

beforeEach(() => {
  searchProductsMock.mockReset()
  listLotsByProductIdsMock.mockReset()
  ;(window as unknown as { api: unknown }).api = {
    listLotsByProductIds: listLotsByProductIdsMock
  }
  searchProductsMock.mockResolvedValue(products)
  listLotsByProductIdsMock.mockResolvedValue([])
})

async function renderWithResults(props?: Partial<ComponentProps<typeof SearchPopup>>) {
  const user = userEvent.setup()
  const onClose = props?.onClose ?? vi.fn()
  const onSelect = props?.onSelect ?? vi.fn()

  render(
    <SearchPopup
      open={props?.open ?? true}
      onClose={onClose}
      onSelect={onSelect}
      allowNumericEnter={props?.allowNumericEnter}
      showExpiry={props?.showExpiry}
    />
  )

  return { user, onClose, onSelect }
}

function lot(overrides: Partial<StockMovementFromApi>): StockMovementFromApi {
  const product = products.find((p) => p.id === (overrides.productId ?? 1)) ?? products[0]

  return {
    id: overrides.id ?? 1,
    productId: overrides.productId ?? product.id,
    type: 'IN',
    quantity: overrides.quantity ?? 1,
    date: overrides.date ?? new Date(2026, 0, 1),
    notes: null,
    appliedDelta: null,
    saleId: null,
    expiryDate: overrides.expiryDate ?? null,
    expiryDismissedAt: null,
    product: {
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      stock: product.stock,
      minStock: product.minStock,
      createdAt: product.createdAt,
      categoryId: product.categoryId,
      supplierId: product.supplierId
    },
    ...overrides
  }
}

async function typeQueryAndWait(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.type(screen.getByRole('textbox'), query)
  await waitFor(() => expect(screen.getByText(products[0].name)).toBeInTheDocument())
}

describe('SearchPopup', () => {
  it('mantiene activo el guard de Enter numerico por defecto', async () => {
    const { user, onSelect } = await renderWithResults()
    await typeQueryAndWait(user, '123')

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selecciona con Enter numerico cuando allowNumericEnter=true', async () => {
    const { user, onSelect } = await renderWithResults({ allowNumericEnter: true })
    await typeQueryAndWait(user, '123')

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(products[0])
  })

  it('selecciona con Enter cuando la query no es numerica', async () => {
    const { user, onSelect } = await renderWithResults()
    await typeQueryAndWait(user, 'coca')

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(products[0])
  })

  it('Escape llama onClose', async () => {
    const { onClose } = await renderWithResults()

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('click en una fila llama onSelect y onClose', async () => {
    const { user, onClose, onSelect } = await renderWithResults()
    await typeQueryAndWait(user, 'coca')

    await user.click(screen.getByText(products[0].name))

    expect(onSelect).toHaveBeenCalledWith(products[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('ArrowDown mueve la seleccion a la segunda fila', async () => {
    const { user } = await renderWithResults()
    await typeQueryAndWait(user, 'coca')

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowDown' })

    expect(screen.getByText(products[1].name).closest('tr')).toHaveClass('search-popup__row--selected')
  })

  describe('showExpiry', () => {
    it('por defecto no renderiza la columna de vencimientos', async () => {
      const { user } = await renderWithResults()
      await typeQueryAndWait(user, 'coca')

      expect(screen.queryByText('Vencimientos')).not.toBeInTheDocument()
      expect(listLotsByProductIdsMock).not.toHaveBeenCalled()
    })

    it('con showExpiry=true renderiza la columna y pide lotes para los resultados visibles', async () => {
      listLotsByProductIdsMock.mockResolvedValue([
        lot({ id: 1, productId: 1, quantity: 2, expiryDate: new Date(2026, 4, 1) })
      ])
      const { user } = await renderWithResults({ showExpiry: true })
      await typeQueryAndWait(user, 'coca')

      expect(screen.getByText('Vencimientos')).toBeInTheDocument()
      await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalledWith([1, 2]))
      expect(screen.getByText('2 u.')).toBeInTheDocument()
      expect(screen.getByText(/2026-05-01/)).toBeInTheDocument()
    })

    it('al cambiar la query vuelve a pedir lotes con los IDs nuevos', async () => {
      searchProductsMock.mockImplementation(async (query) =>
        query.toLowerCase().includes('agua') ? [products[1]] : [products[0]]
      )
      const { user } = await renderWithResults({ showExpiry: true })

      await typeQueryAndWait(user, 'coca')
      await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalledWith([1]))

      await user.clear(screen.getByRole('textbox'))
      await user.type(screen.getByRole('textbox'), 'agua')
      await waitFor(() => expect(screen.getByText(products[1].name)).toBeInTheDocument())
      await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalledWith([2]))
    })

    it('muestra el emptyText cuando la API no devuelve lotes para un producto', async () => {
      const { user } = await renderWithResults({ showExpiry: true })
      await typeQueryAndWait(user, 'agua')

      await waitFor(() => expect(listLotsByProductIdsMock).toHaveBeenCalledWith([1, 2]))
      expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    })

    it('con showExpiry=false nunca llama listLotsByProductIds', async () => {
      const { user } = await renderWithResults({ showExpiry: false })
      await typeQueryAndWait(user, 'coca')

      expect(listLotsByProductIdsMock).not.toHaveBeenCalled()
    })
  })
})
