import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import CreateProductModal from '../CreateProductModal'

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

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'CatTest' }]),
    listSuppliers: vi.fn().mockResolvedValue([{ id: 1, name: 'ProvTest', phone: null, notes: null }]),
    createProduct: vi.fn(),
    createCategory: vi.fn(),
    createSupplier: vi.fn()
  }
})

/** Renderiza el modal abierto con callbacks mockeados. */
function renderModal(props?: Partial<React.ComponentProps<typeof CreateProductModal>>) {
  const onClose = props?.onClose ?? vi.fn()
  const onSuccess = props?.onSuccess ?? vi.fn()
  const utils = render(
    <CreateProductModal open={props?.open ?? true} onClose={onClose} onSuccess={onSuccess} />
  )
  return { ...utils, onClose, onSuccess }
}

/**
 * Llena los campos mínimos obligatorios del formulario.
 * Requiere que los selects de categoría y proveedor ya hayan cargado.
 */
async function fillMinimumValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Producto Test')
  // Hay dos inputs con placeholder "0.00": precio de compra y venta
  const priceInputs = screen.getAllByPlaceholderText('0.00')
  await user.type(priceInputs[0], '50')
  await user.type(priceInputs[1], '80')
  // Esperar que los selects carguen
  await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
  await user.selectOptions(screen.getByRole('combobox', { name: /categoría/i }), '1')
  await user.selectOptions(screen.getByRole('combobox', { name: /proveedor/i }), '1')
}

describe('CreateProductModal', () => {
  it('open=false no renderiza nada', () => {
    render(<CreateProductModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('open=true renderiza el título', async () => {
    renderModal()
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('Submit con name vacío muestra error y no llama createProduct', async () => {
    const user = userEvent.setup()
    renderModal()
    // Esperar que los selects carguen y seleccionar categoría y proveedor
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '50')
    await user.type(screen.getAllByPlaceholderText('0.00')[1], '80')
    await user.selectOptions(screen.getByRole('combobox', { name: /categoría/i }), '1')
    await user.selectOptions(screen.getByRole('combobox', { name: /proveedor/i }), '1')
    // Dejar nombre vacío y hacer submit
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('El nombre es obligatorio'))
    expect((window as any).api.createProduct).not.toHaveBeenCalled()
  })

  it('Submit con categoryId = 0 muestra error de categoría', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Test')
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '50')
    await user.type(screen.getAllByPlaceholderText('0.00')[1], '80')
    // No seleccionar categoría (queda en 0)
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.selectOptions(screen.getByRole('combobox', { name: /proveedor/i }), '1')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('Seleccioná una categoría'))
    expect(screen.getByText('Seleccioná una categoría')).toBeInTheDocument()
  })

  it('Submit con supplierId = 0 muestra error de proveedor', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Test')
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '50')
    await user.type(screen.getAllByPlaceholderText('0.00')[1], '80')
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2))
    await user.selectOptions(screen.getByRole('combobox', { name: /categoría/i }), '1')
    // No seleccionar proveedor (queda en 0)
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('Seleccioná un proveedor'))
    expect(screen.getByText('Seleccioná un proveedor')).toBeInTheDocument()
  })

  it('Submit con barcode no numérico muestra error de barcode', async () => {
    const user = userEvent.setup()
    renderModal()
    await fillMinimumValidForm(user)
    await user.type(screen.getByPlaceholderText(/Sólo dígitos/i), 'abc123')
    await user.click(screen.getByText('Crear producto'))
    await waitFor(() => screen.getByText('El código de barras solo puede contener dígitos'))
    expect(screen.getByText('El código de barras solo puede contener dígitos')).toBeInTheDocument()
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
    // El cierre lo maneja el padre via onSuccess, no onClose directamente
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
    // Los inputs de stock tienen placeholder "0"; limpiar y escribir valor nuevo
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
    // El modal sigue abierto
    expect(screen.getByRole('heading', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Botón Cancelar llama onClose sin llamar createProduct', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await user.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
    expect((window as any).api.createProduct).not.toHaveBeenCalled()
  })

  it('Escape llama onClose cuando no está submitting', async () => {
    const { onClose } = renderModal()
    // Esperar render completo
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Botón muestra "Creando..." mientras submitting', async () => {
    const user = userEvent.setup()
    renderModal()
    // createProduct nunca resuelve: simula estado de carga indefinida
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
    // Escribir algo en el nombre
    await user.type(screen.getByPlaceholderText(/Nombre del producto/i), 'Algo')
    // Cerrar y reabrir
    rerender(<CreateProductModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    rerender(<CreateProductModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))
    const nameInput = screen.getByPlaceholderText(/Nombre del producto/i) as HTMLInputElement
    expect(nameInput.value).toBe('')
  })
})
