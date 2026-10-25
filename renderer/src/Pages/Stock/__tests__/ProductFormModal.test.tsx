import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import { makeProduct } from '../../../test/fixtures'
import ProductFormModal from '../ProductFormModal'

/* eslint-disable @typescript-eslint/no-explicit-any */
const api = () => (window as any).api

/** Producto devuelto por createProduct. */
function createdProduct(): ProductFromApi {
  return makeProduct({ id: 1, name: 'Producto Test', salePrice: '80', purchasePrice: '50', stock: 0, minStock: 0, barcode: null })
}

/** Producto existente para el modo edición. */
function productForEdit(): ProductFromApi {
  return makeProduct({
    id: 42,
    name: 'Producto Editable',
    purchasePrice: '100',
    salePrice: '1000',
    stock: 10,
    minStock: 2,
    barcode: null,
    category: { id: 1, name: 'CatTest' },
    supplier: { id: 1, name: 'ProvTest', phone: null, notes: null },
  })
}

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'CatTest' }]),
    listSuppliers: vi.fn().mockResolvedValue([{ id: 1, name: 'ProvTest', phone: null, notes: null }]),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    getProductByBarcode: vi.fn().mockResolvedValue(null),
    createCategory: vi.fn(),
    createSupplier: vi.fn(),
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** Renderiza el modal abierto con callbacks mockeados. */
function renderModal(props?: Partial<React.ComponentProps<typeof ProductFormModal>>) {
  const onClose = props?.onClose ?? vi.fn()
  const onSuccess = props?.onSuccess ?? vi.fn()
  const utils = render(
    <ProductFormModal
      open={props?.open ?? true}
      onClose={onClose}
      onSuccess={onSuccess}
      product={props?.product}
      initialValues={props?.initialValues}
    />,
  )
  return { ...utils, onClose, onSuccess }
}

const nameInput = () => screen.getByLabelText(/^Nombre/)
const purchaseInput = () => screen.getByLabelText(/^Precio de compra/) as HTMLInputElement
const saleInput = () => screen.getByLabelText(/^Precio de venta/) as HTMLInputElement
const barcodeInput = () => screen.getByLabelText(/^Código de barras/) as HTMLInputElement
const stockInput = () => screen.getByLabelText(/^Stock inicial/) as HTMLInputElement
const minStockInput = () => screen.getByLabelText(/^Stock mínimo/) as HTMLInputElement
const saveButton = (name = 'Guardar producto') => screen.getByRole('button', { name })

const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

/** Abre un picker, elige la opción por nombre. */
async function pick(triggerName: RegExp, option: string) {
  fireEvent.click(screen.getByRole('button', { name: triggerName }))
  fireEvent.click(await screen.findByRole('option', { name: option }))
}
const pickCategory = () => pick(/^Categoría/, 'CatTest')
const pickSupplier = () => pick(/^Proveedor/, 'ProvTest')

/** Llena los campos mínimos obligatorios (nombre, precios, categoría y proveedor). */
async function fillMinimumValidForm(prices: { purchase?: string; sale?: string } = {}) {
  type(nameInput(), 'Producto Test')
  type(purchaseInput(), prices.purchase ?? '50')
  type(saleInput(), prices.sale ?? '80')
  await pickCategory()
  await pickSupplier()
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite A: modo creación
// ─────────────────────────────────────────────────────────────────────────────
describe('Modo creación (sin product prop)', () => {
  it('open=false no renderiza nada', () => {
    render(<ProductFormModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('open=true muestra el título "Nuevo producto" y la bajada', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(screen.getByText('Los campos con * son obligatorios.')).toBeInTheDocument()
  })

  it('el foco inicial va al campo Nombre', async () => {
    renderModal()
    await waitFor(() => expect(nameInput()).toHaveFocus())
  })

  it('guardar vacío muestra los 5 errores obligatorios con los copys nuevos y enfoca Nombre', async () => {
    renderModal()
    fireEvent.click(saveButton())
    expect(screen.getByText('Ingresá el nombre del producto.')).toBeInTheDocument()
    expect(screen.getByText('Elegí o creá una categoría.')).toBeInTheDocument()
    expect(screen.getByText('Elegí o creá un proveedor.')).toBeInTheDocument()
    expect(screen.getAllByText('Ingresá un precio mayor o igual a 0.')).toHaveLength(2)
    expect(nameInput()).toHaveFocus()
    expect(api().createProduct).not.toHaveBeenCalled()
  })

  it('el foco va al primer campo con error según el orden visual', async () => {
    renderModal()
    type(nameInput(), 'Algo')
    fireEvent.click(saveButton())
    // Nombre ok → el primero con error es Categoría.
    expect(screen.getByRole('button', { name: /^Categoría/ })).toHaveFocus()
  })

  it('un código de barras no numérico muestra el error y no llama a la API', async () => {
    renderModal()
    await fillMinimumValidForm()
    type(barcodeInput(), 'abc123')
    fireEvent.click(saveButton())
    expect(screen.getByText('El código solo puede tener números (hasta 20).')).toBeInTheDocument()
    expect(api().createProduct).not.toHaveBeenCalled()
    expect(barcodeInput()).toHaveFocus()
  })

  it('guardar válido llama createProduct con el payload correcto y avisa onSuccess', async () => {
    const { onSuccess, onClose } = renderModal()
    api().createProduct.mockResolvedValue(createdProduct())
    await fillMinimumValidForm()
    fireEvent.click(saveButton())
    await waitFor(() =>
      expect(api().createProduct).toHaveBeenCalledWith({
        name: 'Producto Test',
        purchasePrice: '50',
        salePrice: '80',
        categoryId: 1,
        supplierId: 1,
        barcode: null,
        stock: 0,
        minStock: 0,
      }),
    )
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('los precios con puntos de miles y coma ("1.650,00") se envían como "1650"', async () => {
    renderModal()
    api().createProduct.mockResolvedValue(createdProduct())
    await fillMinimumValidForm({ purchase: '1.650,00', sale: '2.390,50' })
    fireEvent.click(saveButton())
    await waitFor(() => expect(api().createProduct).toHaveBeenCalled())
    expect(api().createProduct).toHaveBeenCalledWith(expect.objectContaining({ purchasePrice: '1650', salePrice: '2390.5' }))
  })

  it('al salir de un precio se reformatea ("50" → "50,00")', () => {
    renderModal()
    type(purchaseInput(), '50')
    fireEvent.blur(purchaseInput())
    expect(purchaseInput().value).toBe('50,00')
  })

  it('stock y stock mínimo se envían como enteros', async () => {
    renderModal()
    api().createProduct.mockResolvedValue(createdProduct())
    await fillMinimumValidForm()
    type(stockInput(), '5')
    type(minStockInput(), '2')
    fireEvent.click(saveButton())
    await waitFor(() => expect(api().createProduct).toHaveBeenCalled())
    expect(api().createProduct).toHaveBeenCalledWith(expect.objectContaining({ stock: 5, minStock: 2 }))
  })

  it('margen en vivo: compra 1650, venta 2390 → "Margen: 44,8 % · ganancia $ 740,00 por unidad"', () => {
    renderModal()
    type(purchaseInput(), '1650')
    type(saleInput(), '2390')
    expect(screen.getByText(/Margen: 44,8 % · ganancia \$ 740,00 por unidad/)).toBeInTheDocument()
  })

  it('vender por debajo del costo avisa pero igual permite guardar', async () => {
    renderModal()
    api().createProduct.mockResolvedValue(createdProduct())
    await fillMinimumValidForm({ purchase: '100', sale: '80' })
    expect(screen.getByText('Estás vendiendo por debajo del costo.')).toBeInTheDocument()
    fireEvent.click(saveButton())
    await waitFor(() => expect(api().createProduct).toHaveBeenCalled())
  })

  it('un error genérico del backend muestra el aviso sin cerrar el modal', async () => {
    const { onClose } = renderModal()
    api().createProduct.mockRejectedValue(new Error('disco lleno'))
    await fillMinimumValidForm()
    fireEvent.click(saveButton())
    expect(await screen.findByText('No se pudo guardar el producto. Probá de nuevo.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('código duplicado: nombra al producto que lo usa, marca el campo y sigue abierto', async () => {
    renderModal()
    api().createProduct.mockRejectedValue(new Error('Unique constraint failed on barcode'))
    api().getProductByBarcode.mockResolvedValue(makeProduct({ id: 9, name: 'Yerba' }))
    await fillMinimumValidForm()
    type(barcodeInput(), '7790001')
    fireEvent.click(saveButton())
    expect(await screen.findByText('Ese código ya lo usa «Yerba». Usá otro o dejalo vacío.')).toBeInTheDocument()
    expect(api().getProductByBarcode).toHaveBeenCalledWith('7790001')
    expect(barcodeInput()).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('el error de código duplicado se limpia al editar el código', async () => {
    renderModal()
    api().createProduct.mockRejectedValue(new Error('Unique constraint failed on barcode'))
    api().getProductByBarcode.mockResolvedValue(makeProduct({ id: 9, name: 'Yerba' }))
    await fillMinimumValidForm()
    type(barcodeInput(), '7790001')
    fireEvent.click(saveButton())
    await screen.findByText(/Ese código ya lo usa/)
    type(barcodeInput(), '7790002')
    expect(screen.queryByText(/Ese código ya lo usa/)).toBeNull()
  })

  it('Enter en "Código de barras" no guarda y pasa el foco a "Stock inicial"', async () => {
    renderModal()
    await fillMinimumValidForm()
    barcodeInput().focus()
    fireEvent.keyDown(barcodeInput(), { key: 'Enter' })
    expect(api().createProduct).not.toHaveBeenCalled()
    expect(stockInput()).toHaveFocus()
  })

  it('Ctrl+Enter guarda desde cualquier campo', async () => {
    renderModal()
    api().createProduct.mockResolvedValue(createdProduct())
    await fillMinimumValidForm()
    fireEvent.keyDown(nameInput(), { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(api().createProduct).toHaveBeenCalled())
  })

  it('el botón dice "Guardando…" y queda deshabilitado mientras guarda', async () => {
    renderModal()
    api().createProduct.mockReturnValue(new Promise(() => {}))
    await fillMinimumValidForm()
    fireEvent.click(saveButton())
    const busy = await screen.findByRole('button', { name: 'Guardando…' })
    expect(busy).toBeDisabled()
  })

  it('al reabrir el modal, el formulario arranca limpio', () => {
    const { rerender } = renderModal()
    type(nameInput(), 'Algo')
    rerender(<ProductFormModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    rerender(<ProductFormModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect((nameInput() as HTMLInputElement).value).toBe('')
  })

  it('initialValues precarga el código de barras (y el nombre)', () => {
    renderModal({ initialValues: { barcode: '779123', name: 'Galletitas' } })
    expect(barcodeInput().value).toBe('779123')
    expect((nameInput() as HTMLInputElement).value).toBe('Galletitas')
  })
})

describe('ProductFormModal — cerrar y descartar', () => {
  it('Cancelar sin cambios llama onClose directamente', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc sin cambios cierra', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Nuevo producto' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc con cambios pide confirmación; "Seguir editando" vuelve y "Descartar" cierra', () => {
    const { onClose } = renderModal()
    type(nameInput(), 'Algo')
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Nuevo producto' }), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: '¿Descartar los cambios?' })).toBeInTheDocument()
    expect(screen.getByText('Lo que tipeaste se va a perder.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(screen.queryByRole('dialog', { name: '¿Descartar los cambios?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect((nameInput() as HTMLInputElement).value).toBe('Algo')

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Nuevo producto' }), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Vencimiento del lote inicial
// ─────────────────────────────────────────────────────────────────────────────
describe('ProductFormModal — Vencimiento del lote inicial', () => {
  it('no aparece con stock 0 (valor por defecto) ni con stock vacío', () => {
    renderModal()
    expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull()
    type(stockInput(), '')
    expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull()
  })

  it('aparece con stock 12 y desaparece al volver a vacío', () => {
    renderModal()
    type(stockInput(), '12')
    expect(screen.getByLabelText(/Vencimiento del lote/i)).toBeInTheDocument()
    expect(screen.getByText('Opcional. Aparece porque cargaste stock inicial.')).toBeInTheDocument()
    type(stockInput(), '')
    expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull()
  })

  it('en modo edición NO aparece aunque stock > 0', () => {
    renderModal({ product: productForEdit() })
    expect(screen.queryByLabelText(/Vencimiento del lote/i)).toBeNull()
  })

  it('una fecha tipeada con máscara ("01052026") viaja como expiryDate', async () => {
    renderModal()
    api().createProduct.mockResolvedValue(createdProduct())
    await fillMinimumValidForm()
    type(stockInput(), '5')
    type(screen.getByLabelText(/Vencimiento del lote/i), '01052026')
    expect((screen.getByLabelText(/Vencimiento del lote/i) as HTMLInputElement).value).toBe('01/05/2026')
    fireEvent.click(saveButton())
    await waitFor(() => expect(api().createProduct).toHaveBeenCalled())
    expect(api().createProduct.mock.calls[0][0].expiryDate).toEqual(new Date(2026, 4, 1))
  })

  it('sin fecha (stock > 0) no incluye expiryDate en el payload', async () => {
    renderModal()
    api().createProduct.mockResolvedValue(createdProduct())
    await fillMinimumValidForm()
    type(stockInput(), '5')
    fireEvent.click(saveButton())
    await waitFor(() => expect(api().createProduct).toHaveBeenCalled())
    expect(api().createProduct.mock.calls[0][0].expiryDate).toBeUndefined()
  })

  it('una fecha inválida ("31022026") muestra el error y no llama a la API', async () => {
    renderModal()
    await fillMinimumValidForm()
    type(stockInput(), '5')
    type(screen.getByLabelText(/Vencimiento del lote/i), '31022026')
    fireEvent.click(saveButton())
    expect(screen.getByText('Revisá la fecha (DD/MM/AAAA).')).toBeInTheDocument()
    expect(api().createProduct).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Vencimiento del lote/i)).toHaveFocus()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Suite B: modo edición
// ─────────────────────────────────────────────────────────────────────────────
describe('Modo edición (con product prop)', () => {
  it('título "Editar producto" y subtítulo con el nombre actual', () => {
    renderModal({ product: productForEdit() })
    expect(screen.getByRole('dialog', { name: 'Editar producto' })).toBeInTheDocument()
    expect(screen.getByText('Producto Editable', { selector: 'p' })).toBeInTheDocument()
  })

  it('los campos se precargan, con los precios formateados', () => {
    renderModal({ product: productForEdit() })
    expect((nameInput() as HTMLInputElement).value).toBe('Producto Editable')
    expect(purchaseInput().value).toBe('100,00')
    expect(saleInput().value).toBe('1.000,00')
    expect(minStockInput().value).toBe('2')
  })

  it('el stock es de solo lectura y muestra la ayuda', () => {
    renderModal({ product: productForEdit() })
    const stock = screen.getByLabelText('Stock') as HTMLInputElement
    expect(stock.readOnly).toBe(true)
    expect(stock.value).toBe('10')
    expect(screen.getByText('Para modificar el stock usá «Cargar stock».')).toBeInTheDocument()
  })

  it('el botón dice "Guardar cambios"', () => {
    renderModal({ product: productForEdit() })
    expect(saveButton('Guardar cambios')).toBeInTheDocument()
  })

  it('guardar llama updateProduct (no createProduct) y el payload no incluye stock', async () => {
    const { onSuccess } = renderModal({ product: productForEdit() })
    api().updateProduct.mockResolvedValue(productForEdit())
    // Esperar a que los pickers carguen y muestren la selección precargada.
    await screen.findByText('CatTest')
    fireEvent.click(saveButton('Guardar cambios'))
    await waitFor(() => expect(api().updateProduct).toHaveBeenCalled())
    const [id, payload] = api().updateProduct.mock.calls[0]
    expect(id).toBe(42)
    expect(payload).toEqual(expect.objectContaining({ name: 'Producto Editable', purchasePrice: '100', salePrice: '1000' }))
    expect(payload).not.toHaveProperty('stock')
    expect(api().createProduct).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalled()
  })

  it('un error del backend en edición muestra el aviso sin cerrar', async () => {
    const { onClose } = renderModal({ product: productForEdit() })
    api().updateProduct.mockRejectedValue(new Error('Error backend'))
    await screen.findByText('CatTest')
    fireEvent.click(saveButton('Guardar cambios'))
    expect(await screen.findByText('No se pudo guardar el producto. Probá de nuevo.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('el código duplicado propio no se reporta como error (es el mismo producto)', async () => {
    const product = makeProduct({ ...productForEdit(), barcode: 7790001n })
    renderModal({ product })
    api().updateProduct.mockRejectedValue(new Error('Unique constraint failed on barcode'))
    api().getProductByBarcode.mockResolvedValue(product)
    await screen.findByText('CatTest')
    fireEvent.click(saveButton('Guardar cambios'))
    expect(await screen.findByText('No se pudo guardar el producto. Probá de nuevo.')).toBeInTheDocument()
  })

  it('Enter en "Código de barras" pasa el foco a "Stock mínimo"', () => {
    renderModal({ product: productForEdit() })
    barcodeInput().focus()
    fireEvent.keyDown(barcodeInput(), { key: 'Enter' })
    expect(minStockInput()).toHaveFocus()
  })

  it('al abrir con un producto diferente, el formulario se reinicializa', () => {
    const second = { ...productForEdit(), id: 99, name: 'Otro Producto' }
    const { rerender } = renderModal({ product: productForEdit() })
    rerender(<ProductFormModal open={true} product={second} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect((nameInput() as HTMLInputElement).value).toBe('Otro Producto')
  })
})
