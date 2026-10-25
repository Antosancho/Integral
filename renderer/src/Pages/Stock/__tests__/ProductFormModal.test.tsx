import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import { makeProduct } from '../../../test/fixtures'
import userEvent from '@testing-library/user-event'
import ProductFormModal from '../ProductFormModal'
import { PRICING_STORAGE_KEY } from '../../../utils/pricing'

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
  localStorage.clear()
  // Base de los tests: cálculo APAGADO (el default real, activado, lo prueba T1 limpiando el storage).
  localStorage.setItem('integral.pricing', JSON.stringify({ enabled: false, marginPct: 30, roundingStep: 0 }))
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
const autoCheckbox = () => screen.getByRole('checkbox', { name: 'Calcular con margen' }) as HTMLInputElement
const marginInput = () => screen.getByLabelText('Margen (%)') as HTMLInputElement
const roundingSelect = () => screen.getByLabelText('Redondeo') as HTMLSelectElement
const setStep = (value: string) => fireEvent.change(roundingSelect(), { target: { value } })
const savePrefs = (p: object) => localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(p))
const storedPrefs = () => JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY) ?? 'null')
/** localStorage falso cuyos métodos lanzan (se pueden pisar algunos con `overrides`). Lo usa T17. */
function brokenStorage(overrides: Partial<Storage> = {}): Storage {
  const fail = () => {
    throw new Error('sin storage')
  }
  return { length: 0, clear: fail, key: fail, getItem: fail, removeItem: fail, setItem: fail, ...overrides } as Storage
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Layout sin scroll
// ─────────────────────────────────────────────────────────────────────────────
describe('ProductFormModal — layout sin scroll', () => {
  it('L1 el modal usa pf-modal y la grilla de 4 columnas', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toHaveClass('ig-modal', 'pf-modal')
    expect(document.querySelector('.pf-grid')).not.toBeNull()
    expect(document.querySelector('.ig-form-grid')).toBeNull()
  })

  it('L2 Nombre y Código de barras ocupan 2 columnas', () => {
    renderModal()
    expect(nameInput().closest('.ig-field')).toHaveClass('span-2')
    expect(barcodeInput().closest('.ig-field')).toHaveClass('span-2')
  })

  it('L3 el vencimiento va bajo las columnas de stock', () => {
    renderModal()
    type(stockInput(), '12')
    expect(screen.getByLabelText(/Vencimiento del lote/i).closest('.ig-field')).toHaveClass('pf-expiry')
  })

  it('L4 el error de guardado aparece en el pie, al lado de los botones', async () => {
    renderModal()
    api().createProduct.mockRejectedValue(new Error('disco lleno'))
    await fillMinimumValidForm()
    fireEvent.click(saveButton())
    const msg = await screen.findByText('No se pudo guardar el producto. Probá de nuevo.')
    expect(msg.closest('.ig-modal-foot')).not.toBeNull()
    expect(msg.closest('.ig-modal-body')).toBeNull()
  })

  it('L5 el popover de Proveedor flota (position: fixed) y queda dentro del diálogo (focus trap)', async () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /^Proveedor/ }))
    const pop = await screen.findByRole('dialog', { name: 'Elegir proveedor' })
    expect(pop.style.position).toBe('fixed')
    expect(pop).toHaveClass('is-floating')
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' }).contains(pop)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Precio con margen
// ─────────────────────────────────────────────────────────────────────────────
describe('ProductFormModal — precio con margen', () => {
  it('T1 sin preferencias guardadas: cálculo activado, margen 30 y redondeo $ 100', () => {
    localStorage.clear()
    renderModal()
    type(purchaseInput(), '1234')
    expect(autoCheckbox().checked).toBe(true)
    expect(marginInput().value).toBe('30')
    expect(marginInput()).toBeEnabled()
    expect(roundingSelect().value).toBe('100')
    expect(roundingSelect()).toBeEnabled()
    expect(saleInput().readOnly).toBe(false)
    expect(saleInput().value).toBe('1.600,00')
  })

  it('T2 tildar completa el precio de venta con el costo actual', () => {
    renderModal()
    type(purchaseInput(), '1000')
    fireEvent.click(autoCheckbox())
    expect(saleInput().value).toBe('1.300,00')
    expect(saleInput().readOnly).toBe(false)
    expect(marginInput()).toBeEnabled()
    expect(roundingSelect()).toBeEnabled()
  })

  it('T3 con el cálculo activo el precio sigue al costo y redondea al más cercano (la mitad sube)', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    type(marginInput(), '0')
    setStep('100')
    const expected: [string, string][] = [
      ['1570', '1.600,00'],
      ['1530', '1.500,00'],
      ['1550', '1.600,00'],
      ['1549,99', '1.500,00'],
    ]
    for (const [cost, sale] of expected) {
      type(purchaseInput(), cost)
      expect(saleInput().value).toBe(sale)
    }
  })

  it('T4 cambiar el redondeo recalcula', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    type(purchaseInput(), '1234')
    expect(saleInput().value).toBe('1.604,20')
    const steps: [string, string][] = [
      ['10', '1.600,00'],
      ['50', '1.600,00'],
      ['100', '1.600,00'],
      ['500', '1.500,00'],
      ['1000', '2.000,00'],
      ['0', '1.604,20'],
    ]
    for (const [step, sale] of steps) {
      setStep(step)
      expect(saleInput().value).toBe(sale)
    }
  })

  it('T5 cambiar el margen recalcula y acepta coma decimal', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    type(purchaseInput(), '1000')
    type(marginInput(), '45')
    expect(saleInput().value).toBe('1.450,00')
    type(marginInput(), '32,5')
    expect(saleInput().value).toBe('1.325,00')
  })

  it('T6 un margen inválido no recalcula y al salir vuelve al último válido', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    type(purchaseInput(), '1000')
    for (const bad of ['abc', '2000', '-5']) {
      type(marginInput(), bad)
      expect(saleInput().value).toBe('1.300,00')
      fireEvent.blur(marginInput())
      expect(marginInput().value).toBe('30')
      expect(saleInput().value).toBe('1.300,00')
    }
  })

  it('T7 Enter en el margen normaliza el texto y no guarda', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    type(marginInput(), '30,50')
    fireEvent.keyDown(marginInput(), { key: 'Enter' })
    expect(marginInput().value).toBe('30,5')
    expect(api().createProduct).not.toHaveBeenCalled()
  })

  it('T8 sin costo, el precio queda vacío y lo explica', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    expect(saleInput().value).toBe('')
    expect(screen.getByText('Completá el precio de compra para calcularlo.')).toBeInTheDocument()
  })

  it('T9 tipear el precio de venta apaga el cálculo solo para este producto', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    type(purchaseInput(), '1000')
    type(saleInput(), '1.500')
    expect(saleInput().value).toBe('1.500')
    expect(autoCheckbox().checked).toBe(false)
    expect(marginInput()).toBeDisabled()
    expect(roundingSelect()).toBeDisabled()
    expect(storedPrefs().enabled).toBe(true)
    type(purchaseInput(), '2000')
    expect(saleInput().value).toBe('1.500')
  })

  it('T10 destildar deja el último precio y se puede editar', () => {
    renderModal()
    type(purchaseInput(), '1000')
    fireEvent.click(autoCheckbox())
    fireEvent.click(autoCheckbox())
    expect(saleInput().value).toBe('1.300,00')
    type(saleInput(), '1.500')
    expect(saleInput().value).toBe('1.500')
    type(purchaseInput(), '2000')
    expect(saleInput().value).toBe('1.500')
    expect(storedPrefs().enabled).toBe(false)
  })

  it('T11 la ayuda muestra el margen real después de redondear', () => {
    renderModal()
    fireEvent.click(autoCheckbox())
    setStep('100')
    type(purchaseInput(), '1234')
    expect(saleInput().value).toBe('1.600,00')
    expect(screen.getByText('Margen: 29,7 % · ganancia $ 366,00 por unidad')).toBeInTheDocument()
  })

  it('T12 Ctrl+Enter guarda con el precio calculado', async () => {
    savePrefs({ enabled: true, marginPct: 30, roundingStep: 100 })
    api().createProduct.mockResolvedValue(createdProduct())
    renderModal()
    expect(autoCheckbox().checked).toBe(true)
    type(nameInput(), 'Producto Test')
    type(purchaseInput(), '1234')
    await pickCategory()
    await pickSupplier()
    fireEvent.keyDown(nameInput(), { key: 'Enter', ctrlKey: true })
    await waitFor(() =>
      expect(api().createProduct).toHaveBeenCalledWith(expect.objectContaining({ purchasePrice: '1234', salePrice: '1600' })),
    )
  })

  it('T13 las preferencias se guardan al cambiarlas y se recuerdan al reabrir', () => {
    const { rerender } = renderModal()
    fireEvent.click(autoCheckbox())
    type(marginInput(), '40')
    setStep('100')
    expect(storedPrefs()).toEqual({ enabled: true, marginPct: 40, roundingStep: 100 })
    rerender(<ProductFormModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    rerender(<ProductFormModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(autoCheckbox().checked).toBe(true)
    expect(marginInput().value).toBe('40')
    expect(roundingSelect().value).toBe('100')
  })

  it('T14 en edición arranca apagado aunque la preferencia esté prendida, y no pisa el precio', () => {
    savePrefs({ enabled: true, marginPct: 30, roundingStep: 100 })
    renderModal({ product: productForEdit() })
    expect(autoCheckbox().checked).toBe(false)
    expect(saleInput().value).toBe('1.000,00')
    expect(marginInput()).toBeDisabled()
    expect(roundingSelect().value).toBe('100')
  })

  it('T15 en edición, tildar recalcula con el costo del producto pero no cambia cómo arranca el alta', () => {
    savePrefs({ enabled: false, marginPct: 30, roundingStep: 0 })
    renderModal({ product: productForEdit() })
    fireEvent.click(autoCheckbox())
    expect(saleInput().value).toBe('130,00')
    expect(storedPrefs().enabled).toBe(false)
  })

  it('T16 en edición, el margen y el redondeo elegidos sí se recuerdan', () => {
    renderModal({ product: productForEdit() })
    fireEvent.click(autoCheckbox())
    type(marginInput(), '50')
    setStep('10')
    expect(saleInput().value).toBe('150,00')
    expect(storedPrefs()).toEqual({ enabled: false, marginPct: 50, roundingStep: 10 })
  })

  it('T17 si localStorage falla, usa los valores por defecto y el cálculo funciona', () => {
    try {
      vi.stubGlobal('localStorage', brokenStorage())
      renderModal()
      expect(autoCheckbox().checked).toBe(true)
      expect(marginInput().value).toBe('30')
      expect(roundingSelect().value).toBe('100')
      type(purchaseInput(), '1234')
      expect(saleInput().value).toBe('1.600,00')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('T18 teclado: Tab recorre la fila de precios y Espacio tilda', async () => {
    const user = userEvent.setup()
    renderModal()
    await waitFor(() => expect(nameInput()).toHaveFocus())
    purchaseInput().focus()
    await user.tab()
    expect(autoCheckbox()).toHaveFocus()
    await user.tab()
    expect(saleInput()).toHaveFocus()
    autoCheckbox().focus()
    await user.keyboard(' ')
    expect(autoCheckbox().checked).toBe(true)
    purchaseInput().focus()
    await user.tab()
    expect(autoCheckbox()).toHaveFocus()
    await user.tab()
    expect(marginInput()).toHaveFocus()
    await user.tab()
    expect(roundingSelect()).toHaveFocus()
    await user.tab()
    expect(saleInput()).toHaveFocus()
  })

  it('T19 el orden del DOM es el orden visual y de Tab', () => {
    renderModal()
    const order = [
      nameInput(),
      screen.getByRole('button', { name: /^Categoría/ }),
      screen.getByRole('button', { name: /^Proveedor/ }),
      purchaseInput(),
      autoCheckbox(),
      marginInput(),
      roundingSelect(),
      saleInput(),
      barcodeInput(),
      stockInput(),
      minStockInput(),
    ]
    for (let i = 0; i < order.length - 1; i++) {
      expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })
})
