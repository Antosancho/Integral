import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CajaSummary from '../CajaSummary'
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

describe('CajaSummary', () => {
  it('does not render anything when sales array is empty', () => {
    render(<CajaSummary sales={[]} />)
    expect(screen.queryByText('Resumen de caja')).not.toBeInTheDocument()
  })

  it('displays the total formatted correctly', () => {
    const saleWithTotal = makeSale({ total: '15000' })
    render(<CajaSummary sales={[saleWithTotal]} />)
    // formatMoney produces ARS format: "$ 15.000,00"
    expect(screen.getByText(/15\.000/)).toBeInTheDocument()
  })

  it('displays the correct label for each payment method', () => {
    // CASH
    const cashSale = makeSale({ payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '500' }] })
    render(<CajaSummary sales={[cashSale]} />)
    expect(screen.getByText('EFECTIVO')).toBeInTheDocument()

    // TRANSFER
    const transferSale = makeSale({ payments: [{ id: 1, saleId: 1, method: 'TRANSFER', amount: '300' }] })
    render(<CajaSummary sales={[transferSale]} />)
    expect(screen.getByText('TRANSFERENCIA')).toBeInTheDocument()
  })

  it('does not display payment methods with zero amount', () => {
    const cashOnlySale = makeSale({ payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1000' }] })
    render(<CajaSummary sales={[cashOnlySale]} />)
    expect(screen.queryByText('DÉBITO')).not.toBeInTheDocument()
    expect(screen.queryByText('CRÉDITO')).not.toBeInTheDocument()
    expect(screen.queryByText('TRANSFERENCIA')).not.toBeInTheDocument()
    expect(screen.queryByText('OTROS')).not.toBeInTheDocument()
  })

  it('displays the title "Resumen de caja" when there are sales', () => {
    render(<CajaSummary sales={[makeSale()]} />)
    expect(screen.getByText('Resumen de caja')).toBeInTheDocument()
  })

  it('displays multiple payment methods correctly', () => {
    const multiMethodSale = makeSale({
      payments: [
        { id: 1, saleId: 1, method: 'CASH', amount: '400' },
        { id: 2, saleId: 1, method: 'DEBIT', amount: '600' }
      ]
    })
    render(<CajaSummary sales={[multiMethodSale]} />)
    expect(screen.getByText('EFECTIVO')).toBeInTheDocument()
    expect(screen.getByText('DÉBITO')).toBeInTheDocument()
    // formatMoney produces ARS format: "$ 400,00" and "$ 600,00"
    expect(screen.getByText(/400/)).toBeInTheDocument()
    expect(screen.getByText(/600/)).toBeInTheDocument()
  })
})