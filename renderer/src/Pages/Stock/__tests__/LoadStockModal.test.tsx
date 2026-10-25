import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import { makeProduct } from '../../../test/fixtures'
import LoadStockModal from '../LoadStockModal'

const listProducts = vi.fn()
const getProductByBarcode = vi.fn()
const createStockMovement = vi.fn()

const leche = (o: Partial<ProductFromApi> = {}) => makeProduct({ id: 5, name: 'Leche', stock: 24, barcode: 7790001n, ...o })

beforeEach(() => {
  listProducts.mockReset().mockResolvedValue([])
  getProductByBarcode.mockReset().mockResolvedValue(null)
  createStockMovement.mockReset().mockResolvedValue({})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as unknown as { api: unknown }).api = { listProducts, getProductByBarcode, createStockMovement }
})

type Props = Partial<React.ComponentProps<typeof LoadStockModal>>

function renderModal(props: Props = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onSuccess = props.onSuccess ?? vi.fn()
  const utils = render(
    <LoadStockModal
      open={props.open ?? true}
      onClose={onClose}
      onSuccess={onSuccess}
      initialProduct={props.initialProduct}
      onRequestCreate={props.onRequestCreate}
    />,
  )
  return { ...utils, onClose, onSuccess }
}

const searchBox = () => screen.getByRole('textbox', { name: 'Buscar producto' })
const quantityInput = () => screen.getByLabelText(/Cantidad a agregar/) as HTMLInputElement
const expiryInput = () => screen.getByLabelText(/Vencimiento del lote/) as HTMLInputElement
const dialog = () => screen.getByRole('dialog', { name: 'Cargar stock' })
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

/**
 * Celda de nombre por texto completo. No se usa `getByRole('cell', { name })` porque happy-dom
 * trata <b> como bloque y el nombre accesible queda partido ("Lec he").
 */
const nameCell = (text: string) =>
  screen.findByText((_, el) => el?.tagName === 'TD' && el.textContent === text)

/** Busca "leche" y elige el resultado con click → paso 2. */
async function goToConfirmStep() {
  listProducts.mockResolvedValue([leche()])
  renderModal()
  type(searchBox(), 'leche')
  fireEvent.click(await nameCell('Leche'))
  await screen.findByLabelText(/Cantidad a agregar/)
}

describe('LoadStockModal — estructura', () => {
  it('open=false no renderiza nada', () => {
    render(<LoadStockModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('open=true muestra el título y el buscador del paso 1 con foco', async () => {
    renderModal()
    expect(dialog()).toBeInTheDocument()
    expect(searchBox()).toHaveAttribute('placeholder', 'Buscá por nombre o escaneá el código')
    await waitFor(() => expect(searchBox()).toHaveFocus())
  })

  it('el indicador de pasos marca el paso 1 como actual', () => {
    renderModal()
    expect(screen.getByText('Buscar producto', { selector: '.step' }).closest('.step')).toHaveClass('is-current')
  })
})

describe('LoadStockModal — Paso 1: buscar', () => {
  it('busca con debounce y lista resultados con la coincidencia en negrita', async () => {
    listProducts.mockResolvedValue([leche()])
    renderModal()
    type(searchBox(), 'lec')
    await waitFor(() => expect(listProducts).toHaveBeenCalledWith({ nameContains: 'lec', take: 50 }))
    const cell = await nameCell('Leche')
    expect(cell.querySelector('b')).toHaveTextContent('Lec')
    expect(screen.getByText('7790001')).toBeInTheDocument()
  })

  it('escaneo: código + Enter con getProductByBarcode salta al paso 2', async () => {
    getProductByBarcode.mockResolvedValue(leche())
    renderModal()
    type(searchBox(), '7790001')
    fireEvent.keyDown(searchBox(), { key: 'Enter' })
    expect(await screen.findByDisplayValue('Leche · stock actual 24')).toBeInTheDocument()
    expect(getProductByBarcode).toHaveBeenCalledWith('7790001')
  })

  it('↓ + Enter elige el resultado resaltado', async () => {
    listProducts.mockResolvedValue([leche({ id: 1, name: 'Leche entera' }), leche({ id: 2, name: 'Leche descremada' })])
    renderModal()
    type(searchBox(), 'leche')
    await nameCell('Leche descremada')
    fireEvent.keyDown(searchBox(), { key: 'ArrowDown' })
    fireEvent.keyDown(searchBox(), { key: 'Enter' })
    expect(await screen.findByDisplayValue('Leche descremada · stock actual 24')).toBeInTheDocument()
  })

  it('sin resultados: "No encontramos «xyz»" y "Crear producto" llama onRequestCreate("xyz")', async () => {
    const onRequestCreate = vi.fn()
    renderModal({ onRequestCreate })
    type(searchBox(), 'xyz')
    expect(await screen.findByText('No encontramos «xyz»')).toBeInTheDocument()
    expect(screen.getByText('¿Es un producto nuevo?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }))
    expect(onRequestCreate).toHaveBeenCalledWith('xyz')
  })

  it('sin onRequestCreate no se ofrece "Crear producto"', async () => {
    renderModal()
    type(searchBox(), 'xyz')
    await screen.findByText('No encontramos «xyz»')
    expect(screen.queryByRole('button', { name: 'Crear producto' })).toBeNull()
  })

  it('el stock de la tabla muestra los tonos negativo y bajo', async () => {
    listProducts.mockResolvedValue([
      leche({ id: 1, name: 'Negativo', stock: -3, minStock: 5 }),
      leche({ id: 2, name: 'Bajo', stock: 2, minStock: 5 }),
    ])
    renderModal()
    type(searchBox(), 'a')
    await nameCell('Negativo')
    expect(document.querySelector('td.is-negative')).toHaveTextContent('−3')
    expect(document.querySelector('td.is-low')).toHaveTextContent('2')
  })

  it('Esc en el paso 1 llama onClose', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('un error de búsqueda se informa', async () => {
    listProducts.mockRejectedValue(new Error('sin base'))
    renderModal()
    type(searchBox(), 'leche')
    expect(await screen.findByText('No pudimos buscar. Probá de nuevo.')).toBeInTheDocument()
  })
})

describe('LoadStockModal — Paso 2: cantidad', () => {
  it('initialProduct abre directo en el paso 2 con "Leche · stock actual 24"', async () => {
    renderModal({ initialProduct: leche() })
    expect(screen.getByDisplayValue('Leche · stock actual 24')).toBeInTheDocument()
    expect(screen.getByLabelText(/Cantidad a agregar \(negativo = merma\)/)).toBeInTheDocument()
    await waitFor(() => expect(quantityInput()).toHaveFocus())
  })

  it('en el paso 2 el primer paso del indicador está hecho', () => {
    renderModal({ initialProduct: leche() })
    expect(screen.getByText('Buscar producto', { selector: '.step' }).closest('.step')).toHaveClass('is-done')
    expect(screen.getByText('Cantidad', { selector: '.step' }).closest('.step')).toHaveClass('is-current')
  })

  it.each([
    ['24', 'Reposición: el stock queda en 48'],
    ['-2', 'Merma: el stock queda en 22'],
    ['−2', 'Merma: el stock queda en 22'],
    ['-30', 'El stock quedará en −6'],
  ])('vista previa para %s → "%s"', (value, text) => {
    renderModal({ initialProduct: leche() })
    type(quantityInput(), value)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it.each(['0', '2,5', 'abc', ''])('cantidad %j muestra el error y no llama a la API', (value) => {
    renderModal({ initialProduct: leche() })
    type(quantityInput(), value)
    fireEvent.click(screen.getByRole('button', { name: 'Cargar stock' }))
    expect(screen.getByText('Ingresá una cantidad distinta de 0, sin decimales.')).toBeInTheDocument()
    expect(createStockMovement).not.toHaveBeenCalled()
  })

  it('Enter en Cantidad envía { productId, type: "IN", quantity }', async () => {
    const { onSuccess } = renderModal({ initialProduct: leche() })
    type(quantityInput(), '24')
    fireEvent.keyDown(quantityInput(), { key: 'Enter' })
    await waitFor(() => expect(createStockMovement).toHaveBeenCalledTimes(1))
    expect(createStockMovement).toHaveBeenCalledWith({ productId: 5, type: 'IN', quantity: 24 })
    expect(onSuccess).toHaveBeenCalledWith(5)
  })

  it('con fecha "30062027" envía expiryDate = new Date(2027, 5, 30)', async () => {
    renderModal({ initialProduct: leche() })
    type(quantityInput(), '5')
    type(expiryInput(), '30062027')
    expect(expiryInput().value).toBe('30/06/2027')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar stock' }))
    await waitFor(() => expect(createStockMovement).toHaveBeenCalled())
    expect(createStockMovement.mock.calls[0][0].expiryDate).toEqual(new Date(2027, 5, 30))
  })

  it('las notas se envían recortadas y se omiten si están vacías', async () => {
    renderModal({ initialProduct: leche() })
    type(quantityInput(), '5')
    type(screen.getByLabelText('Notas'), '  pedido urgente ')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar stock' }))
    await waitFor(() => expect(createStockMovement).toHaveBeenCalled())
    expect(createStockMovement).toHaveBeenCalledWith({ productId: 5, type: 'IN', quantity: 5, notes: 'pedido urgente' })
  })

  it('una cantidad negativa (merma) viaja con quantity negativo y type IN', async () => {
    renderModal({ initialProduct: leche() })
    type(quantityInput(), '-5')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar stock' }))
    await waitFor(() => expect(createStockMovement).toHaveBeenCalledWith({ productId: 5, type: 'IN', quantity: -5 }))
  })

  it('una fecha inválida muestra el error y no llama a la API', () => {
    renderModal({ initialProduct: leche() })
    type(quantityInput(), '5')
    type(expiryInput(), '31022026')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar stock' }))
    expect(screen.getByText('Revisá la fecha (DD/MM/AAAA).')).toBeInTheDocument()
    expect(createStockMovement).not.toHaveBeenCalled()
  })

  it('un error del backend muestra el aviso, no cierra y permite reintentar', async () => {
    createStockMovement.mockRejectedValue(new Error('boom'))
    const { onSuccess } = renderModal({ initialProduct: leche() })
    type(quantityInput(), '5')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar stock' }))
    expect(await screen.findByText('No se pudo cargar el stock. Probá de nuevo.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cargar stock' })).not.toBeDisabled()
  })

  it('mientras envía el botón dice "Cargando…" y está deshabilitado', async () => {
    createStockMovement.mockReturnValue(new Promise(() => {}))
    renderModal({ initialProduct: leche() })
    type(quantityInput(), '5')
    fireEvent.click(screen.getByRole('button', { name: 'Cargar stock' }))
    expect(await screen.findByRole('button', { name: 'Cargando…' })).toBeDisabled()
  })

  it('Esc en el paso 2 vuelve al paso 1 sin cerrar', async () => {
    const { onClose } = renderModal({ initialProduct: leche() })
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(searchBox()).toBeInTheDocument()
    await waitFor(() => expect(searchBox()).toHaveFocus())
  })

  it('"Volver" regresa al paso 1', () => {
    renderModal({ initialProduct: leche() })
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(searchBox()).toBeInTheDocument()
  })

  it('el flujo completo desde la búsqueda funciona', async () => {
    await goToConfirmStep()
    expect(screen.getByDisplayValue('Leche · stock actual 24')).toBeInTheDocument()
  })
})
