import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, beforeEach, vi, expect, beforeAll } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import LoadStockModal from '../LoadStockModal'

beforeAll(() => {
  global.window = global.window || {}
  global.window.api = {
    listProducts: vi.fn().mockResolvedValue([]),
    getProductByBarcode: vi.fn().mockResolvedValue(null),
    createStockMovement: vi.fn()
  }
})

function mockProduct(overrides: Partial<ProductFromApi> = {}): ProductFromApi {
  return {
    id: 1,
    name: 'Yerba Mate',
    purchasePrice: '500',
    salePrice: '800',
    categoryId: 1,
    supplierId: 1,
    barcode: null,
    stock: 10,
    minStock: 2,
    createdAt: new Date(),
    category: { id: 1, name: 'Infusiones' },
    supplier: { id: 1, name: 'ProvTest', phone: null, notes: null },
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoadStockModal', () => {
  it('open=false no renderiza nada', () => {
    render(<LoadStockModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('open=true renderiza el título "Cargar stock"', () => {
    render(<LoadStockModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Cargar stock' })).toBeInTheDocument()
  })

  it('open=true muestra el input de búsqueda en paso search', () => {
    render(<LoadStockModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Buscar por nombre o código/i)).toBeInTheDocument()
  })

  it('botón Cancelar llama onClose desde el paso search', async () => {
    const onClose = vi.fn()
    render(<LoadStockModal open={true} onClose={onClose} onSuccess={vi.fn()} />)
    await fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape en paso search llama onClose', async () => {
    const onClose = vi.fn()
    render(<LoadStockModal open={true} onClose={onClose} onSuccess={vi.fn()} />)
    fireEvent.keyDown(screen.getByPlaceholderText(/Buscar por nombre o código/i), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})