import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, beforeEach, vi, expect, beforeAll } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import LoadStockModal from '../LoadStockModal'

const mockCreateStockMovement = vi.fn()

beforeAll(() => {
  ;(window as unknown as { api: unknown }).api = {
    listProducts: vi.fn().mockResolvedValue([]),
    getProductByBarcode: vi.fn().mockResolvedValue(null),
    createStockMovement: mockCreateStockMovement
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

/** Avanza el modal al paso "confirm" seleccionando un producto mockeado. */
async function goToConfirmStep() {
  const product = mockProduct()
  ;(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([product])
  const user = userEvent.setup()
  render(<LoadStockModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
  const searchInput = screen.getByPlaceholderText(/Buscar por nombre o código/i)
  await user.type(searchInput, 'Yerba')
  await waitFor(() => screen.getByText('Yerba Mate'))
  await user.click(screen.getByText('Yerba Mate'))
  await waitFor(() => screen.getByText('Yerba Mate', { selector: '.load-stock-modal__product-name' }))
  return { user, product }
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Vencimiento
// ─────────────────────────────────────────────────────────────────────────────

describe('LoadStockModal — Vencimiento', () => {
  it('El campo de vencimiento aparece en el paso confirm', async () => {
    await goToConfirmStep()
    const dateInput = screen.getByLabelText(/Vencimiento/i)
    expect(dateInput).toBeInTheDocument()
    expect(dateInput).toHaveAttribute('type', 'date')
  })

  it('Al confirmar sin fecha, el payload no incluye expiryDate', async () => {
    mockCreateStockMovement.mockResolvedValue({})
    const { user } = await goToConfirmStep()
    await user.type(screen.getByPlaceholderText(/Ej: 10/i), '5')
    await user.click(screen.getByRole('button', { name: 'Cargar stock' }))
    await waitFor(() => expect(mockCreateStockMovement).toHaveBeenCalled())
    const payload = mockCreateStockMovement.mock.calls[0][0]
    expect(payload.expiryDate).toBeUndefined()
  })

  it('Al confirmar con fecha válida, el payload incluye expiryDate como Date correcta', async () => {
    mockCreateStockMovement.mockResolvedValue({})
    const { user } = await goToConfirmStep()
    await user.type(screen.getByPlaceholderText(/Ej: 10/i), '5')
    const dateInput = screen.getByLabelText(/Vencimiento/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } })
    await user.click(screen.getByRole('button', { name: 'Cargar stock' }))
    await waitFor(() => expect(mockCreateStockMovement).toHaveBeenCalled())
    const { expiryDate } = mockCreateStockMovement.mock.calls[0][0]
    expect(expiryDate).toBeInstanceOf(Date)
    expect(expiryDate.getFullYear()).toBe(2026)
    expect(expiryDate.getMonth()).toBe(11) // diciembre = índice 11
    expect(expiryDate.getDate()).toBe(31)
  })

  // Nota: el test de "fecha inválida → error" se omite aquí porque <input type="date">
  // sanitiza cualquier string inválido a '' según la spec HTML (tanto en browsers como en
  // happy-dom), lo que impide simular el error de validación en una prueba de integración.
  // La función parseExpiryInput ya está cubierta exhaustivamente en expiry.test.ts.
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Cantidad negativa (merma)
// ─────────────────────────────────────────────────────────────────────────────

describe('LoadStockModal — Cantidad negativa (merma)', () => {
  it('Cantidad -5 pasa validación (no muestra error)', async () => {
    const { user } = await goToConfirmStep()
    await user.type(screen.getByPlaceholderText(/Ej: 10/i), '-5')
    await user.click(screen.getByRole('button', { name: 'Cargar stock' }))
    // Si hubiera error de cantidad, aparecería el texto de validación
    expect(screen.queryByText(/número entero distinto de 0/i)).toBeNull()
  })

  it('Cantidad 0 muestra error de validación', async () => {
    const { user } = await goToConfirmStep()
    await user.type(screen.getByPlaceholderText(/Ej: 10/i), '0')
    await user.click(screen.getByRole('button', { name: 'Cargar stock' }))
    await waitFor(() => screen.getByText(/número entero distinto de 0/i))
    expect(screen.getByText(/número entero distinto de 0/i)).toBeInTheDocument()
  })

  it('Al confirmar con -5, el payload tiene quantity: -5 y type: IN', async () => {
    mockCreateStockMovement.mockResolvedValue({})
    const { user } = await goToConfirmStep()
    await user.type(screen.getByPlaceholderText(/Ej: 10/i), '-5')
    await user.click(screen.getByRole('button', { name: 'Cargar stock' }))
    await waitFor(() => expect(mockCreateStockMovement).toHaveBeenCalled())
    const payload = mockCreateStockMovement.mock.calls[0][0]
    expect(payload.quantity).toBe(-5)
    expect(payload.type).toBe('IN')
  })
})