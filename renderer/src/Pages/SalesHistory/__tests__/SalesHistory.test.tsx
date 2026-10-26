import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import SalesHistory from '../SalesHistory'
import type { SaleFromApi } from '../../../electron-api'
import { makeProduct } from '../../../test/fixtures'

/* eslint-disable @typescript-eslint/no-explicit-any */

const yerba = makeProduct({ id: 1, name: 'Yerba Playadito', barcode: 7791234500017n })
const leche = makeProduct({ id: 2, name: 'Leche Serenísima', barcode: 7790080000123n })

function makeSale(overrides: Partial<SaleFromApi> & { id: number }): SaleFromApi {
  return {
    date: new Date(2024, 2, 15, 14, 0),
    total: '1000',
    discountPct: '0',
    items: [{ id: overrides.id, saleId: overrides.id, productId: 1, quantity: 2, unitPrice: '500', product: yerba }],
    payments: [{ id: overrides.id, saleId: overrides.id, method: 'CASH', amount: '1000' }],
    ...overrides
  }
}

let listSales: ReturnType<typeof vi.fn>
let getSaleById: ReturnType<typeof vi.fn>

beforeEach(() => {
  listSales = vi.fn().mockResolvedValue([])
  getSaleById = vi.fn().mockResolvedValue(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as any).api = { listSales, getSaleById }
})

const renderHistory = (initialSaleId: number | null = null) =>
  render(<SalesHistory viewSwitcher={null} initialSaleId={initialSaleId} />)

const grid = () => screen.getByRole('grid', { name: 'Ventas' })
const detailTitle = () => screen.getByRole('heading', { level: 3, name: /^Venta #/ })

describe('SalesHistory', () => {
  it('al montar llama listSales con el rango de hoy (00:00 a 23:59:59.999)', async () => {
    renderHistory()
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(1))
    const now = new Date()
    expect(listSales).toHaveBeenCalledWith({
      fromDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      toDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    })
  })

  it('lista las ventas y la primera aparece en el detalle', async () => {
    listSales.mockResolvedValue([makeSale({ id: 11 }), makeSale({ id: 12 })])
    renderHistory()
    expect(await screen.findByText('#11')).toBeInTheDocument()
    expect(screen.getByText('#12')).toBeInTheDocument()
    expect(detailTitle()).toHaveTextContent('Venta #11')
  })

  it('la tabla muestra fecha y hora, cantidad de ítems, medios de pago y total', async () => {
    listSales.mockResolvedValue([
      makeSale({
        id: 3,
        total: '1500',
        payments: [
          { id: 1, saleId: 3, method: 'CASH', amount: '1000' },
          { id: 2, saleId: 3, method: 'TRANSFER', amount: '500' }
        ]
      })
    ])
    renderHistory()
    const row = (await screen.findByText('#3')).closest('tr') as HTMLElement
    expect(within(row).getByText('15/03 14:00')).toBeInTheDocument()
    expect(within(row).getByText('2')).toBeInTheDocument()
    expect(within(row).getByText('Efectivo + Transferencia')).toBeInTheDocument()
    expect(within(row).getByText('$ 1.500,00')).toBeInTheDocument()
  })

  it('↓ en la tabla cambia el detalle a la siguiente venta', async () => {
    listSales.mockResolvedValue([makeSale({ id: 11 }), makeSale({ id: 12 })])
    renderHistory()
    await screen.findByText('#11')
    grid().focus()
    fireEvent.keyDown(grid(), { key: 'ArrowDown' })
    expect(detailTitle()).toHaveTextContent('Venta #12')
    expect(screen.getByText('#12').closest('tr')).toHaveClass('is-selected')
  })

  it('click en una fila selecciona esa venta', async () => {
    listSales.mockResolvedValue([makeSale({ id: 11 }), makeSale({ id: 12 })])
    renderHistory()
    fireEvent.click((await screen.findByText('#12')).closest('tr') as HTMLElement)
    expect(detailTitle()).toHaveTextContent('Venta #12')
  })

  it('el medio "Combinado" deja solo las ventas con más de un pago y no se manda a la API', async () => {
    listSales.mockResolvedValue([
      makeSale({ id: 11 }),
      makeSale({
        id: 12,
        payments: [
          { id: 1, saleId: 12, method: 'CASH', amount: '500' },
          { id: 2, saleId: 12, method: 'DEBIT', amount: '500' }
        ]
      })
    ])
    renderHistory()
    await screen.findByText('#11')
    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'MIXED' } })
    await waitFor(() => expect(screen.queryByText('#11')).toBeNull())
    expect(screen.getByText('#12')).toBeInTheDocument()
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(2))
    expect(listSales.mock.calls[1][0]).not.toHaveProperty('method')
  })

  it('un medio simple se envía a la API', async () => {
    renderHistory()
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'CASH' } })
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(2))
    expect(listSales.mock.calls[1][0]).toMatchObject({ method: 'CASH' })
  })

  it('el filtro por producto ("yerba") actúa en el cliente, sin volver a la API', async () => {
    listSales.mockResolvedValue([
      makeSale({ id: 11 }),
      makeSale({ id: 12, items: [{ id: 5, saleId: 12, productId: 2, quantity: 1, unitPrice: '1000', product: leche }] })
    ])
    renderHistory()
    await screen.findByText('#11')
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'yerba' } })
    expect(screen.queryByText('#12')).toBeNull()
    expect(screen.getByText('#11')).toBeInTheDocument()
    expect(listSales).toHaveBeenCalledTimes(1)
  })

  it('"Limpiar filtros" aparece solo con filtros activos y restaura los de hoy', async () => {
    renderHistory()
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'algo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect((screen.getByLabelText('Producto') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull()
  })

  it('"Más filtros" muestra los campos de hora y monto', async () => {
    renderHistory()
    expect(screen.queryByLabelText('Desde hora')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }))
    expect(screen.getByLabelText('Desde hora')).toBeInTheDocument()
    expect(screen.getByLabelText('Hasta hora')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto mín.')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto máx.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Más filtros' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('los montos mín. y máx. viajan a la API como números es-AR', async () => {
    renderHistory()
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Más filtros' }))
    fireEvent.change(screen.getByLabelText('Monto mín.'), { target: { value: '1.000,50' } })
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(2))
    expect(listSales.mock.calls[1][0]).toMatchObject({ minTotal: 1000.5 })
  })

  it('sin ventas: "No hay ventas en este período" y "Ver últimos 7 días" vuelve a consultar con ese rango', async () => {
    renderHistory()
    expect(await screen.findByText('No hay ventas en este período')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver últimos 7 días' }))
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(2))
    const now = new Date()
    expect(listSales.mock.calls[1][0]).toEqual({
      fromDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0),
      toDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    })
  })

  it('initialSaleId llama getSaleById, fija el período de esa venta y la deja seleccionada', async () => {
    const sale5 = makeSale({ id: 5, date: new Date(2024, 2, 15, 10, 0) })
    getSaleById.mockResolvedValue(sale5)
    listSales.mockResolvedValue([makeSale({ id: 4 }), sale5])
    renderHistory(5)
    await waitFor(() => expect(getSaleById).toHaveBeenCalledWith(5))
    await waitFor(() => expect(detailTitle()).toHaveTextContent('Venta #5'))
    expect(listSales).toHaveBeenCalledTimes(1)
    expect(listSales.mock.calls[0][0].fromDate).toEqual(new Date(2024, 2, 15, 0, 0, 0, 0))
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('15/03/2024')
  })

  it('si la venta inicial no existe, igual carga la lista de hoy', async () => {
    getSaleById.mockResolvedValue(null)
    renderHistory(99)
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(1))
  })

  it('el resumen muestra la cantidad de ventas y la suma de totales', async () => {
    listSales.mockResolvedValue([makeSale({ id: 1, total: '1000' }), makeSale({ id: 2, total: '2500' })])
    renderHistory()
    expect(await screen.findByText(/^2 ventas ·/)).toBeInTheDocument()
    expect(screen.getAllByText('$ 3.500,00').length).toBeGreaterThan(0)
  })

  it('una sola venta usa el singular', async () => {
    listSales.mockResolvedValue([makeSale({ id: 1 })])
    renderHistory()
    expect(await screen.findByText(/^1 venta ·/)).toBeInTheDocument()
  })

  it('error de carga: "No pudimos leer las ventas" y Reintentar vuelve a pedir', async () => {
    listSales.mockRejectedValueOnce(new Error('boom'))
    renderHistory()
    expect(await screen.findByText('No pudimos leer las ventas')).toBeInTheDocument()
    listSales.mockResolvedValue([makeSale({ id: 8 })])
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('#8')).toBeInTheDocument()
  })

  it('mientras se tipea una fecha incompleta no consulta la API', async () => {
    renderHistory()
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '241' } })
    await new Promise((r) => setTimeout(r, 350))
    expect(listSales).toHaveBeenCalledTimes(1)
  })
})
