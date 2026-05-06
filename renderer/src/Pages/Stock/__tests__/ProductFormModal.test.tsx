import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import ProductFormModal from '../ProductFormModal'

/** Objeto mínimo válido retornado por createProduct. */
function mockProduct(): ProductFromApi {
  return {
    id: 1,
    name: 'Producto Test',
    purchasePrice: '50',
    salePrice: '80',
    categoryId: 1,
    supplierId: 1,
    barcode: null,
    stock: 0,
    minStock: 0,
    createdAt: new Date(),
    category: { id: 1, name: 'CatTest' },
    supplier: { id: 1, name: 'ProvTest', phone: null, notes: null }
  }
}

/** Objeto válido con datos para probar el modo edición. */
function mockProductForEdit(): ProductFromApi {
  return {
    id: 42,
    name: 'Producto Editable',
    purchasePrice: '100',
    salePrice: '150',
    categoryId: 1,
    supplierId: 1,
    barcode: null,
    stock: 10,
    minStock: 2,
    createdAt: new Date(),
    category: { id: 1, name: 'CatTest' },
    supplier: { id: 1, name: 'ProvTest', phone: null, notes: null }
  }
}

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'CatTest' }]),
    listSuppliers: vi.fn().mockResolvedValue([{ id: 1, name: 'ProvTest', phone: null, notes: null }]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    createCategory: vi.fn(),
    createSupplier: vi.fn()
  }
})

/** Renderiza el modal abierto con callbacks mockeados. Acepta `product` para modo edición. */
function renderModal(props?: Partial<React.ComponentProps<typeof ProductFormModal>>) {
  const onClose = props?.onClose ?? vi.fn()
  const onSuccess = props?.onSuccess ?? vi.fn()
  const utils = render(
    <ProductFormModal
      open={props?.open ?? true}
      onClose={onClose}
      onSuccess={onSuccess}
      product={props?.product}
    />
  )
  return { ...utils, onClose, onSuccess }
}

/**
 * Llena los campos mínimos obligatorios del formulario (nombre, precios,
 * categoría y proveedor).
 */
async function fillMinimumValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Producto Test')
  const priceInputs = screen.getAllByPlaceholderText('0.00')
  await user.type(priceInputs[0], '50')
  await user.type(priceInputs[1], '80')
  await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
  await user.selectOptions(screen.getByRole('combobox', { name: /categoría/i }), '1')
  await user.selectOptions(screen.getByRole('combobox', { name: /proveedor/i }), '1')
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite A: modo creación (sin prop product)
// ─────────────────────────────────────────────────────────────────────────────
describe('Modo creación (sin product prop)', () => {
  it('open=false no renderiza nada', () => {
    render(<ProductFormModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('open=true renderiza el título "Nuevo producto"', async () => {
    renderModal()
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('Submit con name vacío muestra error', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '50')
    await user.type(screen.getAllByPlaceholderText('0.00')[1], '80')
    await user.selectOptions(screen.getByRole('combobox', { name: /categoría/i }), '1')
    await user.selectOptions(screen.getByRole('combobox', { name: /proveedor/i }), '1')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('El nombre es obligatorio'))
    expect((window as any).api.createProduct).not.toHaveBeenCalled()
  })

  it('Submit con categoryId=0 muestra error', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Test')
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '50')
    await user.type(screen.getAllByPlaceholderText('0.00')[1], '80')
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.selectOptions(screen.getByRole('combobox', { name: /proveedor/i }), '1')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('Seleccioná una categoría'))
    expect(screen.getByText('Seleccioná una categoría')).toBeInTheDocument()
  })

  it('Submit con supplierId=0 muestra error', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Test')
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '50')
    await user.type(screen.getAllByPlaceholderText('0.00')[1], '80')
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.selectOptions(screen.getByRole('combobox', { name: /categoría/i }), '1')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('Seleccioná un proveedor'))
    expect(screen.getByText('Seleccioná un proveedor')).toBeInTheDocument()
  })

  it('Submit con barcode no numérico muestra error', async () => {
    const user = userEvent.setup()
    renderModal()
    await fillMinimumValidForm(user)
    await user.type(screen.getByPlaceholderText(/Sólo dígitos/i), 'abc123')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('El código de barras solo puede contener dígitos'))
    expect((window as any).api.createProduct).not.toHaveBeenCalled()
  })

  it('Submit completo válido llama createProduct con payload correcto', async () => {
    const user = userEvent.setup()
    const { onSuccess, onClose } = renderModal()
    ;(window as any).api.createProduct.mockResolvedValue(mockProduct())
    await fillMinimumValidForm(user)
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() =>
      expect((window as any).api.createProduct).toHaveBeenCalledWith({
        name: 'Producto Test',
        purchasePrice: '50',
        salePrice: '80',
        categoryId: 1,
        supplierId: 1,
        barcode: null,
        stock: 0,
        minStock: 0
      })
    )
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Precio con coma decimal se normaliza a punto', async () => {
    const user = userEvent.setup()
    renderModal()
    ;(window as any).api.createProduct.mockResolvedValue(mockProduct())
    await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Producto Test')
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '10,50')
    await user.type(screen.getAllByPlaceholderText('0.00')[1], '20')
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.selectOptions(screen.getByRole('combobox', { name: /categoría/i }), '1')
    await user.selectOptions(screen.getByRole('combobox', { name: /proveedor/i }), '1')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => expect((window as any).api.createProduct).toHaveBeenCalled())
    expect((window as any).api.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ purchasePrice: '10.50' })
    )
  })

  it('Submit con stock y minStock no vacíos se pasan como enteros', async () => {
    const user = userEvent.setup()
    renderModal()
    ;(window as any).api.createProduct.mockResolvedValue(mockProduct())
    await fillMinimumValidForm(user)
    const stockInputs = screen.getAllByPlaceholderText('0')
    await user.clear(stockInputs[0])
    await user.type(stockInputs[0], '5')
    await user.clear(stockInputs[1])
    await user.type(stockInputs[1], '2')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => expect((window as any).api.createProduct).toHaveBeenCalled())
    expect((window as any).api.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ stock: 5, minStock: 2 })
    )
  })

  it('Error del API muestra apiError sin cerrar el modal', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    ;(window as any).api.createProduct.mockRejectedValue(new Error('Unique constraint failed'))
    await fillMinimumValidForm(user)
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('Unique constraint failed'))
    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Botón Cancelar llama onClose', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
    expect((window as any).api.createProduct).not.toHaveBeenCalled()
  })

  it('Escape llama onClose cuando no está submitting', async () => {
    const { onClose } = renderModal()
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Botón muestra "Creando..." mientras submitting', async () => {
    const user = userEvent.setup()
    renderModal()
    ;(window as any).api.createProduct.mockReturnValue(new Promise(() => {}))
    await fillMinimumValidForm(user)
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('Creando...'))
    expect(screen.getByText('Creando...')).toBeDisabled()
  })

  it('Al reabrir el modal, el formulario arranca limpio', async () => {
    const user = userEvent.setup()
    const { rerender } = renderModal()
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Algo')
    rerender(<ProductFormModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    rerender(<ProductFormModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    const nameInput = screen.getByPlaceholderText(/Nombre del producto/i) as HTMLInputElement
    expect(nameInput.value).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite B+: campo de vencimiento del lote inicial
// ─────────────────────────────────────────────────────────────────────────────

describe('ProductFormModal — Vencimiento del lote inicial', () => {
  it('No aparece cuando stock=0 (valor por defecto)', async () => {
    renderModal()
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull()
  })

  it('No aparece cuando stock está vacío', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    const stockInputs = screen.getAllByPlaceholderText('0')
    await user.clear(stockInputs[0])
    expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull()
  })

  it('Aparece cuando stock > 0', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    const stockInputs = screen.getAllByPlaceholderText('0')
    await user.clear(stockInputs[0])
    await user.type(stockInputs[0], '5')
    await waitFor(() => screen.getByLabelText(/Vencimiento del lote/i))
    expect(screen.getByLabelText(/Vencimiento del lote/i)).toBeInTheDocument()
  })

  it('Desaparece al volver stock a vacío', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    const stockInputs = screen.getAllByPlaceholderText('0')
    await user.clear(stockInputs[0])
    await user.type(stockInputs[0], '5')
    await waitFor(() => screen.getByLabelText(/Vencimiento del lote/i))
    await user.clear(stockInputs[0])
    await waitFor(() => expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull())
  })

  it('En modo edición el campo NO aparece aunque stock > 0', async () => {
    renderModal({ product: mockProductForEdit() })
    await waitFor(() => screen.getByRole('heading', { name: 'Editar producto' }))
    expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull()
  })

  it('Submit con fecha incluye expiryDate en el payload de createProduct', async () => {
    const user = userEvent.setup()
    renderModal()
    ;(window as any).api.createProduct.mockResolvedValue(mockProduct())
    await fillMinimumValidForm(user)
    const stockInputs = screen.getAllByPlaceholderText('0')
    await user.clear(stockInputs[0])
    await user.type(stockInputs[0], '5')
    await waitFor(() => screen.getByLabelText(/Vencimiento del lote/i))
    const dateInput = screen.getByLabelText(/Vencimiento del lote/i) as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-12-31' } })
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => expect((window as any).api.createProduct).toHaveBeenCalled())
    const payload = (window as any).api.createProduct.mock.calls[0][0]
    expect(payload.expiryDate).toBeInstanceOf(Date)
    expect(payload.expiryDate.getFullYear()).toBe(2026)
    expect(payload.expiryDate.getDate()).toBe(31)
  })

  it('Submit sin fecha (stock > 0) no incluye expiryDate en el payload', async () => {
    const user = userEvent.setup()
    renderModal()
    ;(window as any).api.createProduct.mockResolvedValue(mockProduct())
    await fillMinimumValidForm(user)
    const stockInputs = screen.getAllByPlaceholderText('0')
    await user.clear(stockInputs[0])
    await user.type(stockInputs[0], '5')
    // No ingresamos fecha de vencimiento
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => expect((window as any).api.createProduct).toHaveBeenCalled())
    const payload = (window as any).api.createProduct.mock.calls[0][0]
    expect(payload.expiryDate).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite B: modo edición (con prop product)
// ─────────────────────────────────────────────────────────────────────────────
describe('Modo edición (con product prop)', () => {
  it('Renderiza "Editar producto" como título', async () => {
    renderModal({ product: mockProductForEdit() })
    await waitFor(() => screen.getByRole('heading', { name: 'Editar producto' }))
    expect(screen.getByRole('heading', { name: 'Editar producto' })).toBeInTheDocument()
  })

  it('Los campos se pre-rellenan con los datos del producto', async () => {
    renderModal({ product: mockProductForEdit() })
    await waitFor(() => screen.getByRole('heading', { name: 'Editar producto' }))
    const nameInput = screen.getByPlaceholderText(/Nombre del producto/i) as HTMLInputElement
    expect(nameInput.value).toBe('Producto Editable')
    const priceInputs = screen.getAllByPlaceholderText('0.00')
    expect((priceInputs[0] as HTMLInputElement).value).toBe('100')
    expect((priceInputs[1] as HTMLInputElement).value).toBe('150')
    // minStock precargado con '2'
    const zeroInputs = screen.getAllByPlaceholderText('0')
    const minStockInput = zeroInputs.find(el => (el as HTMLInputElement).value === '2') as HTMLInputElement
    expect(minStockInput).toBeDefined()
    expect(minStockInput.value).toBe('2')
  })

  it('El campo stock es read-only', async () => {
    renderModal({ product: mockProductForEdit() })
    await waitFor(() => screen.getByRole('heading', { name: 'Editar producto' }))
    // El input de stock en modo edición muestra el valor actual sin placeholder
    const stockInput = screen.getByDisplayValue('10') as HTMLInputElement
    expect(stockInput.readOnly).toBe(true)
  })

  it('Botón submit dice "Guardar cambios"', async () => {
    renderModal({ product: mockProductForEdit() })
    await waitFor(() => screen.getByRole('heading', { name: 'Editar producto' }))
    expect(screen.getByText('Guardar cambios')).toBeInTheDocument()
  })

  it('Submit válido llama updateProduct y no createProduct', async () => {
    const user = userEvent.setup()
    renderModal({ product: mockProductForEdit() })
    ;(window as any).api.updateProduct.mockResolvedValue(mockProductForEdit())
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.click(screen.getByText('Guardar cambios'))
    await waitFor(() => expect((window as any).api.updateProduct).toHaveBeenCalled())
    expect((window as any).api.updateProduct).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ name: 'Producto Editable' })
    )
    expect((window as any).api.createProduct).not.toHaveBeenCalled()
  })

  it('El payload de edición no incluye el campo stock', async () => {
    const user = userEvent.setup()
    renderModal({ product: mockProductForEdit() })
    ;(window as any).api.updateProduct.mockResolvedValue(mockProductForEdit())
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.click(screen.getByText('Guardar cambios'))
    await waitFor(() => expect((window as any).api.updateProduct).toHaveBeenCalled())
    const [, payload] = (window as any).api.updateProduct.mock.calls[0]
    // stock no debe estar en el payload enviado a la API
    expect(payload).not.toMatchObject({ stock: expect.anything() })
  })

  it('Error del API en edición muestra error sin cerrar', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal({ product: mockProductForEdit() })
    ;(window as any).api.updateProduct.mockRejectedValue(new Error('Error backend'))
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.click(screen.getByText('Guardar cambios'))
    await waitFor(() => screen.getByText('Error backend'))
    expect(screen.getByRole('heading', { name: 'Editar producto' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Botón muestra "Guardando..." durante submit', async () => {
    const user = userEvent.setup()
    renderModal({ product: mockProductForEdit() })
    ;(window as any).api.updateProduct.mockReturnValue(new Promise(() => {}))
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.click(screen.getByText('Guardar cambios'))
    await waitFor(() => screen.getByText('Guardando...'))
    expect(screen.getByText('Guardando...')).toBeDisabled()
  })

  it('Al abrir con un producto diferente, el draft se re-inicializa', async () => {
    const first = mockProductForEdit()
    const second = { ...mockProductForEdit(), id: 99, name: 'Otro Producto' }
    const { rerender } = renderModal({ product: first, open: true })
    await waitFor(() => screen.getByRole('heading', { name: 'Editar producto' }))
    // Cambiar al segundo producto manteniendo el modal abierto
    rerender(
      <ProductFormModal
        open={true}
        product={second}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText(/Nombre del producto/i) as HTMLInputElement
      expect(nameInput.value).toBe('Otro Producto')
    })
  })
})
