import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import { makeProduct } from '../../../test/fixtures'
import { renderWithProviders } from '../../../test/renderWithProviders'
import StockProducts from '../StockProducts'

const selectedProduct = makeProduct({
  id: 99,
  name: 'Producto Buscado',
  purchasePrice: '50',
  salePrice: '90',
  barcode: 789n,
  stock: 7,
  minStock: 1,
  category: { id: 1, name: 'Categoria Test' },
  supplier: { id: 1, name: 'Proveedor Test', phone: null, notes: null },
})

// El SearchPopup real se prueba en Sells; acá se simula su contrato con StockProducts.
// Igual que el real, al elegir llama onSelect y luego onClose.
vi.mock('../../Sells/SearchPopup', () => ({
  default: ({
    open,
    onClose,
    onSelect,
  }: {
    open: boolean
    onClose: () => void
    onSelect: (product: ProductFromApi) => void
  }) => (
    <div data-testid="search-popup" data-open={String(open)}>
      <button
        onClick={() => {
          onSelect(selectedProduct)
          onClose()
        }}
      >
        Simular seleccion
      </button>
      <button onClick={onClose}>Cerrar</button>
    </div>
  ),
}))

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listProducts: vi.fn().mockResolvedValue([]),
    listLotsByProductIds: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'Categoria Test' }]),
    listSuppliers: vi.fn().mockResolvedValue([{ id: 1, name: 'Proveedor Test', phone: null, notes: null }]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  }
})

function renderStock() {
  return renderWithProviders(<StockProducts viewSwitcher={null} navigate={vi.fn()} />)
}

function expectPopupOpen(open: boolean) {
  expect(screen.getByTestId('search-popup')).toHaveAttribute('data-open', String(open))
}

describe('Stock › buscador F2 (integración)', () => {
  it('inicia con el popup cerrado', async () => {
    renderStock()
    await waitFor(() => expect(window.api.listProducts).toHaveBeenCalled())
    expectPopupOpen(false)
  })

  it('el botón Buscar abre el popup', () => {
    renderStock()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expectPopupOpen(true)
  })

  it('F2 abre el popup y un segundo F2 lo cierra', () => {
    renderStock()
    fireEvent.keyDown(window, { key: 'F2' })
    expectPopupOpen(true)
    fireEvent.keyDown(window, { key: 'F2' })
    expectPopupOpen(false)
  })

  it('onClose del popup lo cierra', () => {
    renderStock()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click(screen.getByText('Cerrar'))
    expectPopupOpen(false)
  })

  it('elegir un producto abre Editar producto y el cierre del popup no lo pisa', async () => {
    renderStock()
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click(screen.getByText('Simular seleccion'))

    expect(await screen.findByRole('dialog', { name: 'Editar producto' })).toBeInTheDocument()
    expect(screen.getByDisplayValue(selectedProduct.name)).toBeInTheDocument()
    expectPopupOpen(false)
  })
})
