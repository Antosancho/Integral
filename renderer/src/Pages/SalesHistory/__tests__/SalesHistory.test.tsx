import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SalesHistory from '../SalesHistory'
import type { SaleFromApi } from '../../../electron-api'

function makeSale(overrides: Partial<SaleFromApi> = {}): SaleFromApi {
  return {
    id: 1,
    date: new Date('2024-03-15T14:00:00'),
    total: '1000',
    discountPct: '0',
    items: [],
    payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1000' }],
    ...overrides
  }
}

let listSales: ReturnType<typeof vi.fn>

beforeEach(() => {
  listSales = vi.fn().mockResolvedValue([])
  ;(window as any).api = { listSales }
})

describe('SalesHistory', () => {
  it('al montar, llama window.api.listSales y muestra las ventas', async () => {
    listSales.mockResolvedValue([makeSale({ id: 1 }), makeSale({ id: 2 })])
    render(<SalesHistory />)
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
    expect(listSales).toHaveBeenCalledTimes(1)
  })

  it('muestra mensaje de vacío si no hay ventas', async () => {
    listSales.mockResolvedValue([])
    render(<SalesHistory />)
    await waitFor(() => {
      expect(screen.getByText(/No se encontraron ventas/i)).toBeInTheDocument()
    })
  })

  it('click en "Buscar" vuelve a llamar listSales con los filtros aplicados', async () => {
    const user = userEvent.setup()
    listSales.mockResolvedValue([])
    render(<SalesHistory />)
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(1))

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'CASH')

    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(listSales).toHaveBeenCalledTimes(2))

    const lastCall = listSales.mock.calls[1][0]
    expect(lastCall).toMatchObject({ method: 'CASH' })
  })

  it('click en una fila abre el modal de detalle', async () => {
    listSales.mockResolvedValue([makeSale({ id: 5 })])
    render(<SalesHistory />)
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    fireEvent.click(screen.getByText('5').closest('tr')!)
    await waitFor(() => expect(screen.getByText('Venta #5')).toBeInTheDocument())
  })

  it('cerrar el modal limpia la selección', async () => {
    listSales.mockResolvedValue([makeSale({ id: 5 })])
    render(<SalesHistory />)
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument())
    fireEvent.click(screen.getByText('5').closest('tr')!)
    await waitFor(() => expect(screen.getByText('Venta #5')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByText('Venta #5')).not.toBeInTheDocument())
  })

  it('muestra total formateado en ARS en la lista', async () => {
    listSales.mockResolvedValue([makeSale({ total: '15000' })])
    render(<SalesHistory />)
    await waitFor(() => {
      expect(screen.getByText(/15\.000/)).toBeInTheDocument()
    })
  })
})
