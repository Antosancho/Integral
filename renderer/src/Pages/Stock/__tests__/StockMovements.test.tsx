import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StockMovementFromApi } from '../../../electron-api'
import { makeProduct } from '../../../test/fixtures'
import { lastSevenDays } from '../movements'
import StockMovements from '../StockMovements'

const listStockMovements = vi.fn()
const navigate = vi.fn()

const leche = makeProduct({ id: 5, name: 'Leche', barcode: 7790001n })
const yerba = makeProduct({ id: 6, name: 'Yerba', barcode: 7790002n })

function movement(o: Partial<StockMovementFromApi>): StockMovementFromApi {
  return {
    id: 1,
    productId: 5,
    type: 'IN',
    quantity: 1,
    date: new Date(2026, 9, 24, 18, 42),
    notes: null,
    appliedDelta: null,
    saleId: null,
    expiryDate: null,
    expiryDismissedAt: null,
    product: leche,
    ...o,
  }
}

const MOVEMENTS: StockMovementFromApi[] = [
  movement({ id: 1, type: 'SALE', quantity: 4, appliedDelta: -4, saleId: 1282, product: leche }),
  movement({ id: 2, type: 'IN', quantity: 24, appliedDelta: 24, expiryDate: new Date(2026, 10, 8), notes: 'Pedido semanal', product: leche }),
  movement({ id: 3, type: 'IN', quantity: -2, appliedDelta: -2, product: yerba, productId: 6 }),
  movement({ id: 4, type: 'IN', quantity: 12, appliedDelta: 0, product: yerba, productId: 6 }),
]

function renderView(product: { id: number; name: string } | null = null) {
  return render(<StockMovements viewSwitcher={null} navigate={navigate} product={product} />)
}

beforeEach(() => {
  listStockMovements.mockReset().mockResolvedValue(MOVEMENTS)
  navigate.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as unknown as { api: unknown }).api = { listStockMovements }
})

const rows = () => Array.from(document.querySelectorAll('tbody tr'))
const rowOf = (text: string) => rows().find((r) => r.textContent?.includes(text)) as HTMLElement

describe('StockMovements', () => {
  it('llama a listStockMovements con el rango de los últimos 7 días', async () => {
    renderView()
    await waitFor(() => expect(listStockMovements).toHaveBeenCalled())
    const { from, to } = lastSevenDays()
    expect(listStockMovements).toHaveBeenCalledWith({ fromDate: from, toDate: to, take: 500 })
  })

  it('con un producto por navegación filtra por productId y muestra su nombre', async () => {
    renderView({ id: 5, name: 'Leche' })
    await waitFor(() => expect(listStockMovements).toHaveBeenCalled())
    expect(listStockMovements).toHaveBeenCalledWith(expect.objectContaining({ productId: 5 }))
    expect((screen.getByLabelText('Producto') as HTMLInputElement).value).toBe('Leche')
  })

  it('los badges usan el tono de cada tipo', async () => {
    renderView()
    await screen.findByText('Venta')
    expect(screen.getByText('Venta')).toHaveClass('ig-badge-neutral')
    expect(screen.getByText('Reposición')).toHaveClass('ig-badge-success')
    expect(screen.getByText('Merma')).toHaveClass('ig-badge-warning')
    expect(screen.getByText('Alta inicial')).toHaveClass('ig-badge-info')
  })

  it('muestra las cantidades con signo: −4, +24, −2', async () => {
    renderView()
    await screen.findByText('Venta')
    expect(within(rowOf('Venta')).getByText('−4')).toBeInTheDocument()
    expect(within(rowOf('Reposición')).getByText('+24')).toBeInTheDocument()
    expect(within(rowOf('Merma')).getByText('−2')).toBeInTheDocument()
  })

  it('un ajuste sin delta conocido muestra "ajuste a N"', async () => {
    listStockMovements.mockResolvedValue([movement({ id: 9, type: 'ADJUSTMENT', quantity: 15, appliedDelta: null })])
    renderView()
    expect(await screen.findByText('ajuste a 15')).toBeInTheDocument()
  })

  it('click en "Venta #1282" navega al Historial con esa venta', async () => {
    renderView()
    fireEvent.click(await screen.findByRole('button', { name: 'Venta #1282' }))
    expect(navigate).toHaveBeenCalledWith({ section: 'sells', salesView: 'history', historySaleId: 1282 })
  })

  it('el segmentado "Mermas" deja solo las mermas', async () => {
    renderView()
    await screen.findByText('Venta')
    fireEvent.click(screen.getByRole('tab', { name: 'Mermas' }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('Merma')
  })

  it('"Reposiciones" incluye también las altas iniciales', async () => {
    renderView()
    await screen.findByText('Venta')
    fireEvent.click(screen.getByRole('tab', { name: 'Reposiciones' }))
    expect(rows()).toHaveLength(2)
  })

  it('tipear en Producto filtra en el cliente y descarta el productId', async () => {
    renderView({ id: 5, name: 'Leche' })
    await screen.findByText('Venta')
    listStockMovements.mockClear()
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'yer' } })
    await waitFor(() => expect(listStockMovements).toHaveBeenCalled())
    expect(listStockMovements.mock.calls[0][0]).not.toHaveProperty('productId')
    await waitFor(() => expect(rows().every((r) => r.textContent?.includes('Yerba'))).toBe(true))
  })

  it('también filtra por parte del código de barras', async () => {
    renderView()
    await screen.findByText('Venta')
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '7790002' } })
    await waitFor(() => expect(rows().every((r) => r.textContent?.includes('Yerba'))).toBe(true))
  })

  it('el detalle muestra las notas y "Lote vence 08/11/2026"', async () => {
    renderView()
    await screen.findByText('Reposición')
    const detail = rowOf('Reposición').querySelector('td:last-child')!
    expect(detail).toHaveTextContent('Pedido semanal · Lote vence 08/11/2026')
  })

  it('un movimiento sin detalle muestra "—"', async () => {
    renderView()
    await screen.findByText('Merma')
    expect(rowOf('Merma').querySelector('td:last-child')).toHaveTextContent('—')
  })

  it('cambiar el período recarga con las nuevas fechas', async () => {
    renderView()
    await waitFor(() => expect(listStockMovements).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '01102026' } })
    await waitFor(() => expect(listStockMovements).toHaveBeenCalledTimes(2))
    expect(listStockMovements.mock.calls[1][0].fromDate).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0))
  })

  it('un período con desde > hasta no recarga y avisa', async () => {
    renderView()
    await waitFor(() => expect(listStockMovements).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '01012099' } })
    expect(screen.getByText('Tiene que ser posterior a la inicial.')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 350))
    expect(listStockMovements).toHaveBeenCalledTimes(1)
  })

  it('una fecha completa pero inexistente muestra el error', async () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '31022026' } })
    expect(screen.getByText('Revisá la fecha (DD/MM/AAAA).')).toBeInTheDocument()
  })

  it('sin movimientos: "Todavía no hay movimientos"', async () => {
    listStockMovements.mockResolvedValue([])
    renderView()
    expect(await screen.findByText('Todavía no hay movimientos')).toBeInTheDocument()
    expect(screen.getByText('Cambiá el período o el producto para ver otros movimientos.')).toBeInTheDocument()
  })

  it('error: "No pudimos leer los movimientos" y Reintentar vuelve a pedir', async () => {
    listStockMovements.mockRejectedValueOnce(new Error('boom'))
    renderView()
    expect(await screen.findByText('No pudimos leer los movimientos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Venta')).toBeInTheDocument()
    expect(listStockMovements).toHaveBeenCalledTimes(2)
  })
})
