import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductFromApi } from '../../../electron-api'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { makeProduct } from '../../../test/fixtures'
import StockProducts from '../StockProducts'

/* eslint-disable @typescript-eslint/no-explicit-any */
const api = () => (window as any).api

const leche = makeProduct({
  id: 1,
  name: 'Leche La Serenísima',
  barcode: 7790080000123n,
  salePrice: '1000',
  stock: 24,
  minStock: 10,
  categoryId: 1,
  category: { id: 1, name: 'Lácteos' },
  supplier: { id: 1, name: 'Distribuidora Sur', phone: null, notes: null },
})
const yerba = makeProduct({
  id: 2,
  name: 'Yerba Playadito',
  barcode: 7791234500017n,
  salePrice: '4890',
  stock: 6,
  minStock: 8,
  categoryId: 2,
  category: { id: 2, name: 'Almacén' },
  supplier: { id: 2, name: 'Mayorista Rosario', phone: null, notes: null },
})
const coca = makeProduct({
  id: 3,
  name: 'Coca-Cola 2,25 L',
  barcode: 7790895000430n,
  salePrice: '3200',
  stock: -3,
  minStock: 12,
  categoryId: 3,
  category: { id: 3, name: 'Bebidas' },
  supplier: { id: 3, name: 'Coca-Cola FEMSA', phone: null, notes: null },
})
const PRODUCTS = [leche, yerba, coca]

const navigate = vi.fn()

function installApi(products: ProductFromApi[] = PRODUCTS) {
  ;(window as unknown as { api: unknown }).api = {
    listProducts: vi.fn().mockResolvedValue(products),
    listLotsByProductIds: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'Lácteos' }]),
    listSuppliers: vi.fn().mockResolvedValue([{ id: 1, name: 'Distribuidora Sur', phone: null, notes: null }]),
    getProductByBarcode: vi.fn().mockResolvedValue(null),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    createStockMovement: vi.fn(),
  }
}

async function renderLoaded(products?: ProductFromApi[]) {
  if (products) installApi(products)
  const utils = renderWithProviders(<StockProducts viewSwitcher={null} navigate={navigate} />)
  await waitFor(() => expect(api().listProducts).toHaveBeenCalled())
  return utils
}

const nameCell = (name: string) => screen.findByText(name, { selector: 'td.name' })
const row = (name: string) => screen.getByText(name, { selector: 'td.name' }).closest('tr')!
const grid = () => screen.getByRole('grid', { name: 'Productos' })
const searchBox = () => screen.getByRole('textbox', { name: 'Buscar productos' }) as HTMLInputElement

beforeEach(() => {
  navigate.mockReset()
  installApi()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StockProducts — carga y estados', () => {
  it('muestra el skeleton solo después de 300 ms de carga', async () => {
    vi.useFakeTimers()
    api().listProducts.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<StockProducts viewSwitcher={null} navigate={navigate} />)
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(screen.queryByText('Cargando productos…')).toBeNull()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByText('Cargando productos…')).toBeInTheDocument()
  })

  it('lista los productos con precio formateado y Categoría / Proveedor', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    expect(within(row('Leche La Serenísima')).getByText('$ 1.000,00')).toBeInTheDocument()
    expect(within(row('Leche La Serenísima')).getByText('Lácteos')).toBeInTheDocument()
    expect(within(row('Leche La Serenísima')).getByText('Distribuidora Sur')).toBeInTheDocument()
    expect(within(row('Leche La Serenísima')).getByText('7790080000123')).toBeInTheDocument()
  })

  it('pide hasta 5000 productos (el filtrado es en el cliente)', async () => {
    await renderLoaded()
    expect(api().listProducts).toHaveBeenCalledWith({ take: 5000 })
  })

  it('error de carga: "No pudimos leer los productos" y Reintentar vuelve a pedir', async () => {
    api().listProducts.mockRejectedValueOnce(new Error('sin base'))
    renderWithProviders(<StockProducts viewSwitcher={null} navigate={navigate} />)
    expect(await screen.findByText('No pudimos leer los productos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await nameCell('Leche La Serenísima')
    expect(api().listProducts).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('No pudimos leer los productos')).toBeNull()
  })

  it('base vacía: "Todavía no hay productos" con el botón para crear', async () => {
    await renderLoaded([])
    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument()
    const card = screen.getByText('Todavía no hay productos').closest('.ig-card') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'Nuevo producto' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
  })
})

describe('StockProducts — alertas de stock', () => {
  it('stock negativo: celda is-negative y alerta danger; su botón abre Cargar stock en el paso 2', async () => {
    await renderLoaded()
    await nameCell('Coca-Cola 2,25 L')
    expect(within(row('Coca-Cola 2,25 L')).getByText('−3').closest('td')).toHaveClass('is-negative')

    const alert = screen.getByText('Hay 1 producto con stock negativo').closest('.ig-alert') as HTMLElement
    expect(alert).toHaveClass('ig-alert-danger')
    expect(within(alert).getByText('«Coca-Cola 2,25 L» tiene −3 unidades. Revisá las ventas o cargá stock.')).toBeInTheDocument()

    fireEvent.click(within(alert).getByRole('button', { name: 'Cargar stock' }))
    expect(screen.getByRole('dialog', { name: 'Cargar stock' })).toBeInTheDocument()
    expect(screen.getByText('Cantidad a agregar (negativo = merma)')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/Coca-Cola 2,25 L · stock actual -3/)).toBeInTheDocument()
  })

  it('varios negativos: título en plural y texto genérico', async () => {
    await renderLoaded([coca, makeProduct({ id: 9, name: 'Otro', stock: -1, minStock: 0 })])
    expect(await screen.findByText('Hay 2 productos con stock negativo')).toBeInTheDocument()
    expect(screen.getByText('Revisá las ventas o cargá stock.')).toBeInTheDocument()
  })

  it('stock bajo: celda is-low y alerta warning; "Filtrar" activa "Solo stock bajo"', async () => {
    await renderLoaded()
    await nameCell('Yerba Playadito')
    expect(within(row('Yerba Playadito')).getByText('6').closest('td')).toHaveClass('is-low')

    const alert = screen.getByText('1 producto por debajo del stock mínimo').closest('.ig-alert') as HTMLElement
    expect(alert).toHaveClass('ig-alert-warning')
    fireEvent.click(within(alert).getByRole('button', { name: 'Filtrar' }))

    expect(screen.getByRole('button', { name: 'Solo stock bajo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Leche La Serenísima', { selector: 'td.name' })).toBeNull()
    expect(screen.getByText('Yerba Playadito', { selector: 'td.name' })).toBeInTheDocument()
    // Con el filtro activo ya no se ofrece la alerta de stock bajo.
    expect(screen.queryByText('1 producto por debajo del stock mínimo')).toBeNull()
  })
})

describe('StockProducts — buscador, filtros y orden', () => {
  it('el buscador inline filtra sin tildes y actualiza el contador', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.change(searchBox(), { target: { value: 'serenisima' } })
    expect(screen.getByText('Leche La Serenísima', { selector: 'td.name' })).toBeInTheDocument()
    expect(screen.queryByText('Yerba Playadito', { selector: 'td.name' })).toBeNull()
    expect(screen.getAllByText('1 producto').length).toBeGreaterThan(0)
  })

  it('sin coincidencias: "No encontramos «xyz»"', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.change(searchBox(), { target: { value: 'xyz' } })
    expect(screen.getByText('No encontramos «xyz»')).toBeInTheDocument()
  })

  it('Enter con un código exacto selecciona la fila', async () => {
    await renderLoaded()
    await nameCell('Yerba Playadito')
    fireEvent.change(searchBox(), { target: { value: '7791234500017' } })
    fireEvent.keyDown(searchBox(), { key: 'Enter' })
    expect(row('Yerba Playadito')).toHaveAttribute('aria-selected', 'true')
  })

  it('Enter con un código inexistente avisa con un toast', async () => {
    await renderLoaded()
    await nameCell('Yerba Playadito')
    fireEvent.change(searchBox(), { target: { value: '999' } })
    fireEvent.keyDown(searchBox(), { key: 'Enter' })
    expect(await screen.findByText('Producto no encontrado')).toBeInTheDocument()
    expect(screen.getByText('Código 999')).toBeInTheDocument()
  })

  it('el filtro de categoría deja solo los productos de esa categoría', async () => {
    await renderLoaded()
    await nameCell('Yerba Playadito')
    fireEvent.click(screen.getByRole('button', { name: 'Categoría: Todas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Almacén' }))
    expect(screen.getByRole('button', { name: 'Categoría: Almacén' })).toBeInTheDocument()
    expect(screen.getByText('Yerba Playadito', { selector: 'td.name' })).toBeInTheDocument()
    expect(screen.queryByText('Leche La Serenísima', { selector: 'td.name' })).toBeNull()
  })

  it('ordena por Precio: primer click ascendente, segundo descendente', async () => {
    await renderLoaded()
    await nameCell('Yerba Playadito')
    const th = () => screen.getByRole('button', { name: /^Precio/ }).closest('th')!
    expect(th()).toHaveAttribute('aria-sort', 'none')

    fireEvent.click(screen.getByRole('button', { name: /^Precio/ }))
    expect(th()).toHaveAttribute('aria-sort', 'ascending')
    const namesAsc = Array.from(document.querySelectorAll('td.name')).map((n) => n.textContent)
    expect(namesAsc).toEqual(['Leche La Serenísima', 'Coca-Cola 2,25 L', 'Yerba Playadito'])

    fireEvent.click(screen.getByRole('button', { name: /^Precio/ }))
    expect(th()).toHaveAttribute('aria-sort', 'descending')
    const namesDesc = Array.from(document.querySelectorAll('td.name')).map((n) => n.textContent)
    expect(namesDesc).toEqual(['Yerba Playadito', 'Coca-Cola 2,25 L', 'Leche La Serenísima'])
  })
})

describe('StockProducts — teclado y acciones de fila', () => {
  it('con el foco en la tabla, ↓ selecciona la primera fila y Enter abre Editar producto', async () => {
    await renderLoaded()
    await nameCell('Coca-Cola 2,25 L')
    grid().focus()
    fireEvent.keyDown(grid(), { key: 'ArrowDown' })
    // Orden por nombre: Coca-Cola va primera.
    expect(row('Coca-Cola 2,25 L')).toHaveAttribute('aria-selected', 'true')
    expect(grid()).toHaveAttribute('aria-activedescendant', 'stock-row-3')
    fireEvent.keyDown(grid(), { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Editar producto' })).toBeInTheDocument()
  })

  it('doble click en una fila abre Editar producto', async () => {
    await renderLoaded()
    await nameCell('Yerba Playadito')
    fireEvent.doubleClick(row('Yerba Playadito'))
    expect(screen.getByRole('dialog', { name: 'Editar producto' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Yerba Playadito')).toBeInTheDocument()
  })

  it('el botón Editar abre el producto de su fila', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Leche La Serenísima' }))
    expect(screen.getByDisplayValue('Leche La Serenísima')).toBeInTheDocument()
  })

  it('menú ⋮ → "Ver movimientos" navega a Movimientos con el producto', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Leche La Serenísima' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver movimientos' }))
    expect(navigate).toHaveBeenCalledWith({
      stockView: 'movements',
      movementsProduct: { id: 1, name: 'Leche La Serenísima' },
    })
  })

  it('menú ⋮ → "Cargar stock de este producto" abre el modal en el paso 2', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Leche La Serenísima' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cargar stock de este producto' }))
    expect(screen.getByDisplayValue('Leche La Serenísima · stock actual 24')).toBeInTheDocument()
  })

  it('Ctrl+N abre "Nuevo producto" y Ctrl+L abre "Cargar stock"', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('Ctrl+L abre Cargar stock en el paso de búsqueda', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Cargar stock' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Buscar producto' })).toBeInTheDocument()
  })

  it('Ctrl+F enfoca el buscador de la tabla', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    expect(searchBox()).toHaveFocus()
  })

  it('un dígito suelto (escaneo) lleva el foco al buscador y limpia el texto anterior', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.change(searchBox(), { target: { value: 'algo' } })
    fireEvent.keyDown(document.body, { key: '7' })
    expect(searchBox()).toHaveFocus()
    expect(searchBox().value).toBe('')
  })

  it('con un modal abierto los atajos de la vista no se disparan', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    expect(screen.queryByRole('dialog', { name: 'Cargar stock' })).toBeNull()
  })

  it('"Nuevo producto" desde la cabecera abre el alta', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.click(screen.getAllByRole('button', { name: 'Nuevo producto' })[0])
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
  })
})

describe('StockProducts — alta y recarga', () => {
  it('guardar un alta recarga la tabla y selecciona la fila nueva', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    const nuevo = makeProduct({ id: 50, name: 'Fideos Nuevos', barcode: null, stock: 5, minStock: 1 })
    api().createProduct.mockResolvedValue(nuevo)
    api().listProducts.mockResolvedValue([...PRODUCTS, nuevo])

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: 'Fideos Nuevos' } })
    fireEvent.change(screen.getByLabelText(/^Precio de compra/), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/^Precio de venta/), { target: { value: '200' } })
    const form = within(screen.getByRole('dialog', { name: 'Nuevo producto' }))
    fireEvent.click(form.getByRole('button', { name: /^Categoría/ }))
    fireEvent.click(await screen.findByRole('option', { name: 'Lácteos' }))
    fireEvent.click(form.getByRole('button', { name: /^Proveedor/ }))
    fireEvent.click(await screen.findByRole('option', { name: 'Distribuidora Sur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))

    expect(await nameCell('Fideos Nuevos')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nuevo producto' })).toBeNull())
    expect(row('Fideos Nuevos')).toHaveAttribute('aria-selected', 'true')
    expect(api().listProducts).toHaveBeenCalledTimes(2)
  })

  it('"Crear producto" desde Cargar stock abre el alta con el texto buscado', async () => {
    await renderLoaded()
    await nameCell('Leche La Serenísima')
    fireEvent.keyDown(window, { key: 'l', ctrlKey: true })
    // listProducts devuelve todos, así que se busca algo y se fuerza "sin resultados".
    api().listProducts.mockResolvedValue([])
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar producto' }), { target: { value: '779123' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Crear producto' }))
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect((screen.getByLabelText(/^Código de barras/) as HTMLInputElement).value).toBe('779123')
  })
})
