import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import Stock from '../../Stock'

const selectedProduct: ProductFromApi = {
  id: 99,
  name: 'Producto Buscado',
  purchasePrice: '50',
  salePrice: '90',
  categoryId: 1,
  supplierId: 1,
  barcode: 789n,
  stock: 7,
  minStock: 1,
  createdAt: new Date(),
  category: { id: 1, name: 'Categoria Test' },
  supplier: { id: 1, name: 'Proveedor Test', phone: null, notes: null }
}

vi.mock('../../Sells/SearchPopup', () => ({
  default: ({
    open,
    onClose,
    onSelect
  }: {
    open: boolean
    onClose: () => void
    onSelect: (product: ProductFromApi) => void
  }) => (
    <div data-testid="search-popup" data-open={String(open)}>
      <button onClick={() => onSelect(selectedProduct)}>Simular seleccion</button>
      <button onClick={onClose}>Cerrar</button>
    </div>
  )
}))

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listProducts: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'Categoria Test' }]),
    listSuppliers: vi.fn().mockResolvedValue([
      { id: 1, name: 'Proveedor Test', phone: null, notes: null }
    ]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    createCategory: vi.fn(),
    createSupplier: vi.fn()
  }
})

function expectPopupOpen(open: boolean) {
  expect(screen.getByTestId('search-popup')).toHaveAttribute('data-open', String(open))
}

describe('Stock search integration', () => {
  it('inicia con el popup cerrado', async () => {
    render(<Stock />)

    await waitFor(() => expect(window.api.listProducts).toHaveBeenCalled())
    expectPopupOpen(false)
  })

  it('el boton Buscar abre el popup', async () => {
    const user = userEvent.setup()
    render(<Stock />)

    await user.click(screen.getByText('Buscar (F2)'))

    expectPopupOpen(true)
  })

  it('F2 abre el popup', () => {
    render(<Stock />)

    fireEvent.keyDown(window, { key: 'F2' })

    expectPopupOpen(true)
  })

  it('F2 con el popup abierto lo cierra', () => {
    render(<Stock />)

    fireEvent.keyDown(window, { key: 'F2' })
    expectPopupOpen(true)
    fireEvent.keyDown(window, { key: 'F2' })

    expectPopupOpen(false)
  })

  it('onClose del popup cierra el popup', async () => {
    const user = userEvent.setup()
    render(<Stock />)

    await user.click(screen.getByText('Buscar (F2)'))
    await user.click(screen.getByText('Cerrar'))

    expectPopupOpen(false)
  })

  it('seleccionar un producto abre ProductFormModal en modo edicion', async () => {
    const user = userEvent.setup()
    render(<Stock />)

    await user.click(screen.getByText('Buscar (F2)'))
    await user.click(screen.getByText('Simular seleccion'))

    await waitFor(() => screen.getByRole('heading', { name: 'Editar producto' }))
    expect(screen.getByDisplayValue(selectedProduct.name)).toBeInTheDocument()
  })
})
