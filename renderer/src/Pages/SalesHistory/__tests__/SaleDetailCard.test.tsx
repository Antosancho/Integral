import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import SaleDetailCard from '../SaleDetailCard'
import type { SaleFromApi } from '../../../electron-api'
import { makeProduct } from '../../../test/fixtures'

function makeSale(overrides: Partial<SaleFromApi> = {}): SaleFromApi {
  return {
    id: 1,
    date: new Date(2024, 2, 15, 14, 5),
    total: '1000',
    discountPct: '0',
    items: [],
    payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1000' }],
    ...overrides
  }
}

const item = (id: number, name: string | null, quantity: number, unitPrice: string): SaleFromApi['items'][number] => ({
  id,
  saleId: 1,
  productId: name ? id : null,
  quantity,
  unitPrice,
  product: name ? makeProduct({ id, name }) : null
})

describe('SaleDetailCard', () => {
  it('muestra el número de venta, la fecha, la hora y la insignia "Pagada"', () => {
    render(<SaleDetailCard sale={makeSale({ id: 42 })} />)
    expect(screen.getByRole('heading', { name: 'Venta #42' })).toBeInTheDocument()
    expect(screen.getByText('15/03/2024 · 14:05')).toBeInTheDocument()
    expect(screen.getByText('Pagada')).toHaveClass('ig-badge-success')
  })

  it('lista los ítems con nombre, cantidad, precio unitario y total de la línea', () => {
    render(<SaleDetailCard sale={makeSale({ items: [item(1, 'Aceite', 3, '500')] })} />)
    const row = screen.getByText('Aceite').closest('tr') as HTMLElement
    expect(within(row).getByText('3')).toBeInTheDocument()
    expect(within(row).getByText('$ 500,00')).toBeInTheDocument()
    expect(within(row).getByText('$ 1.500,00')).toBeInTheDocument()
  })

  it('un ítem sin producto se muestra como "General"', () => {
    render(<SaleDetailCard sale={makeSale({ items: [item(1, null, 1, '850.5')] })} />)
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('el subtotal es la suma de las líneas', () => {
    const sale = makeSale({ items: [item(1, 'A', 2, '100'), item(2, 'B', 1, '300')] })
    render(<SaleDetailCard sale={sale} />)
    const row = screen.getByText('Subtotal').closest('.ig-pay-row') as HTMLElement
    expect(within(row).getByText('$ 500,00')).toBeInTheDocument()
  })

  it('con descuento muestra el porcentaje y el monto descontado con el menos tipográfico', () => {
    const sale = makeSale({ discountPct: '10', total: '900', items: [item(1, 'A', 1, '1000')] })
    render(<SaleDetailCard sale={sale} />)
    const row = screen.getByText('Descuento 10 %').closest('.ig-pay-row') as HTMLElement
    expect(row.textContent?.replace(/\u00a0/g, ' ')).toContain('−$ 100,00')
  })

  it('con recargo muestra el porcentaje y el monto sumado', () => {
    const sale = makeSale({ discountPct: '-10', total: '1100', items: [item(1, 'A', 1, '1000')] })
    render(<SaleDetailCard sale={sale} />)
    const row = screen.getByText('Recargo 10 %').closest('.ig-pay-row') as HTMLElement
    expect(row.textContent?.replace(/\u00a0/g, ' ')).toContain('+$ 100,00')
  })

  it('sin descuento no muestra la fila de descuento', () => {
    render(<SaleDetailCard sale={makeSale()} />)
    expect(screen.queryByText(/Descuento/)).toBeNull()
    expect(screen.queryByText(/Recargo/)).toBeNull()
  })

  it('muestra el total y los pagos con el nombre del medio y su monto', () => {
    const sale = makeSale({
      total: '1000',
      payments: [
        { id: 1, saleId: 1, method: 'CASH', amount: '400' },
        { id: 2, saleId: 1, method: 'TRANSFER', amount: '600' }
      ]
    })
    render(<SaleDetailCard sale={sale} />)
    expect(screen.getByText('Pagos')).toBeInTheDocument()
    expect(within(screen.getByText('Efectivo').closest('.ig-pay-row') as HTMLElement).getByText('$ 400,00')).toBeInTheDocument()
    expect(within(screen.getByText('Transferencia').closest('.ig-pay-row') as HTMLElement).getByText('$ 600,00')).toBeInTheDocument()
    expect(screen.queryByText('Vuelto')).toBeNull()
  })

  it('si pagaron de más muestra el vuelto', () => {
    const sale = makeSale({ total: '1000', payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1500' }] })
    render(<SaleDetailCard sale={sale} />)
    const row = screen.getByText('Vuelto').closest('.ig-pay-row') as HTMLElement
    expect(within(row).getByText('$ 500,00')).toBeInTheDocument()
  })
})
