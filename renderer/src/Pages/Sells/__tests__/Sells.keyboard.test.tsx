import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import Sells from '../Sells'
import { makeProduct } from '../../../test/fixtures'
import { renderWithProviders } from '../../../test/renderWithProviders'

/* eslint-disable @typescript-eslint/no-explicit-any */

const CODE = '7790070000005'
const coca = makeProduct({ id: 7, name: 'Coca 2L', barcode: BigInt(CODE), salePrice: '1000', stock: 5 })

let createSale: ReturnType<typeof vi.fn>
let listProducts: ReturnType<typeof vi.fn>

beforeEach(() => {
  createSale = vi.fn().mockResolvedValue({})
  listProducts = vi.fn().mockResolvedValue([coca])
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as any).api = {
    createSale,
    listProducts,
    getProductByBarcode: vi.fn(async (code: string) => (code === CODE ? coca : null)),
    listLotsByProductIds: vi.fn().mockResolvedValue([])
  }
})

afterEach(() => {
  delete (window as any).api
})

const barcodeInput = () => screen.getByLabelText('Código de barras') as HTMLInputElement
const cashInput = () => screen.getByRole('textbox', { name: 'EFECTIVO' }) as HTMLInputElement
const key = (k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { key: k, ...init })

async function renderWithCoca() {
  renderWithProviders(<Sells viewSwitcher={null} />)
  fireEvent.change(barcodeInput(), { target: { value: CODE } })
  fireEvent.keyDown(barcodeInput(), { key: 'Enter' })
  await screen.findByLabelText('Cantidad de Coca 2L')
}

describe('Sells — atajos de teclado', () => {
  it('F12 aprueba la venta cuando está habilitada', async () => {
    await renderWithCoca()
    fireEvent.change(cashInput(), { target: { value: '1000' } })
    key('F12')
    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
  })

  it('F12 no hace nada si APROBAR está deshabilitado', async () => {
    await renderWithCoca()
    key('F12')
    await act(async () => {})
    expect(createSale).not.toHaveBeenCalled()
  })

  it('F12 con el carrito vacío no hace nada', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    key('F12')
    await act(async () => {})
    expect(createSale).not.toHaveBeenCalled()
  })

  it('Alt+1 completa EFECTIVO con lo que falta y deja el input enfocado', async () => {
    await renderWithCoca()
    key('1', { altKey: true })
    expect(cashInput().value).toBe('1.000,00')
    await waitFor(() => expect(cashInput()).toHaveFocus())
  })

  it('Alt+4 completa TRANSFERENCIA (el orden sigue el del panel)', async () => {
    await renderWithCoca()
    key('4', { altKey: true })
    expect((screen.getByRole('textbox', { name: 'TRANSFERENCIA' }) as HTMLInputElement).value).toBe('1.000,00')
  })

  it('Alt+1 sin líneas en el carrito no hace nada', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    key('1', { altKey: true })
    expect(screen.queryByRole('region', { name: 'Pago' })).toBeNull()
  })

  it('F2 abre "Buscar producto", F10 lo cierra y abre "Ítem general", y F10 de nuevo cierra', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    key('F2')
    expect(screen.getByRole('dialog', { name: 'Buscar producto' })).toBeInTheDocument()

    key('F10')
    expect(screen.queryByRole('dialog', { name: 'Buscar producto' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Ítem general' })).toBeInTheDocument()

    key('F10')
    expect(screen.queryByRole('dialog', { name: 'Ítem general' })).toBeNull()
  })

  it('F2 con el buscador abierto lo cierra y el foco vuelve al input de código', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    key('F2')
    key('F2')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(barcodeInput()).toHaveFocus())
  })

  it('Esc dentro del buscador lo cierra y el foco vuelve al input de código', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    key('F2')
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Buscar producto' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(barcodeInput()).toHaveFocus())
  })

  it('elegir un producto en F2 lo agrega al carrito', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    key('F2')
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar producto' }), { target: { value: 'coca' } })
    const row = await screen.findByText((_, el) => el?.tagName === 'TD' && el.classList.contains('name') && el.textContent === 'Coca 2L')
    fireEvent.click(row)
    expect(await screen.findByLabelText('Cantidad de Coca 2L')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('F2: en la búsqueda por solo dígitos el Enter NO agrega (hay que hacer click en la fila)', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    key('F2')
    const box = screen.getByRole('textbox', { name: 'Buscar producto' })
    fireEvent.change(box, { target: { value: CODE } })
    await screen.findByText((_, el) => el?.tagName === 'TD' && el.classList.contains('name') && el.textContent === 'Coca 2L')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.queryByLabelText('Cantidad de Coca 2L')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Buscar producto' })).toBeInTheDocument()
  })

  it('con el buscador abierto F12 no aprueba (hay un modal encima)', async () => {
    await renderWithCoca()
    fireEvent.change(cashInput(), { target: { value: '1000' } })
    key('F2')
    key('F12')
    await act(async () => {})
    expect(createSale).not.toHaveBeenCalled()
  })

  it('Esc con el foco en un botón devuelve el foco al input de código', async () => {
    await renderWithCoca()
    const tag = screen.getByRole('button', { name: 'Autocompletar EFECTIVO' })
    tag.focus()
    fireEvent.keyDown(tag, { key: 'Escape' })
    expect(barcodeInput()).toHaveFocus()
  })

  it('un dígito con el foco fuera de un campo (un escaneo) lo mueve al input de código', async () => {
    await renderWithCoca()
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(barcodeInput()).not.toHaveFocus()
    fireEvent.keyDown(document.body, { key: '7' })
    expect(barcodeInput()).toHaveFocus()
  })

  it('un dígito con el foco en otro campo editable NO le roba el foco', async () => {
    await renderWithCoca()
    cashInput().focus()
    fireEvent.keyDown(cashInput(), { key: '5' })
    expect(cashInput()).toHaveFocus()
  })

  it('↓ desde el input de código enfoca la primera fila del carrito', async () => {
    await renderWithCoca()
    fireEvent.keyDown(barcodeInput(), { key: 'ArrowDown' })
    expect(screen.getByLabelText('Cantidad de Coca 2L').closest('tr')).toHaveFocus()
  })

  it('Supr sobre la fila quita la línea y vuelve al input de código', async () => {
    await renderWithCoca()
    fireEvent.keyDown(barcodeInput(), { key: 'ArrowDown' })
    const row = screen.getByLabelText('Cantidad de Coca 2L').closest('tr') as HTMLElement
    fireEvent.keyDown(row, { key: 'Delete' })
    expect(await screen.findByText('Escaneá un producto para empezar')).toBeInTheDocument()
    await waitFor(() => expect(barcodeInput()).toHaveFocus())
  })

  it('el botón "Buscar" y "Ítem general" de la cabecera abren sus popups', async () => {
    renderWithProviders(<Sells viewSwitcher={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(screen.getByRole('dialog', { name: 'Buscar producto' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ítem general' }))
    expect(screen.getByRole('dialog', { name: 'Ítem general' })).toBeInTheDocument()
  })
})
