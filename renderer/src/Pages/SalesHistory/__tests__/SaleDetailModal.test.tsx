import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SaleDetailModal from '../SaleDetailModal'
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

describe('SaleDetailModal', () => {
  it('no renderiza nada si sale es null', () => {
    render(<SaleDetailModal sale={null} onClose={vi.fn()} />)
    expect(screen.queryByText(/Venta #/)).not.toBeInTheDocument()
  })

  it('muestra el ID de la venta', () => {
    render(<SaleDetailModal sale={makeSale({ id: 42 })} onClose={vi.fn()} />)
    expect(screen.getByText('Venta #42')).toBeInTheDocument()
  })

  it('lista los ítems con nombre, cantidad, precio unitario y subtotal', () => {
    const sale = makeSale({
      items: [{
        id: 1,
        saleId: 1,
        productId: 1,
        quantity: 3,
        unitPrice: '500',
        product: {
          id: 1,
          name: 'Aceite',
          barcode: null,
          purchasePrice: '400',
          salePrice: '500',
          stock: 10,
          minStock: 0,
          createdAt: new Date(),
          categoryId: 1,
          supplierId: 1
        }
      }]
    })
    render(<SaleDetailModal sale={sale} onClose={vi.fn()} />)
    expect(screen.getByText('Aceite')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getAllByText(/500/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1\.500/).length).toBeGreaterThan(0)
  })

  it('muestra subtotal calculado como suma de líneas', () => {
    const sale = makeSale({
      total: '1600',
      items: [
        {
          id: 1, saleId: 1, productId: 1, quantity: 2, unitPrice: '500',
          product: { id: 1, name: 'A', barcode: null, purchasePrice: '0', salePrice: '500', stock: 0, minStock: 0, createdAt: new Date(), categoryId: 1, supplierId: 1 }
        },
        {
          id: 2, saleId: 1, productId: 2, quantity: 3, unitPrice: '200',
          product: { id: 2, name: 'B', barcode: null, purchasePrice: '0', salePrice: '200', stock: 0, minStock: 0, createdAt: new Date(), categoryId: 1, supplierId: 1 }
        }
      ]
    })
    render(<SaleDetailModal sale={sale} onClose={vi.fn()} />)
    expect(screen.getAllByText(/1\.600/).length).toBeGreaterThan(0)
  })

  it('muestra descuento cuando discountPct > 0', () => {
    render(<SaleDetailModal sale={makeSale({ discountPct: '10' })} onClose={vi.fn()} />)
    expect(screen.getByText(/Descuento/)).toBeInTheDocument()
    expect(screen.getByText(/10%/)).toBeInTheDocument()
  })

  it('no muestra descuento cuando discountPct es 0', () => {
    render(<SaleDetailModal sale={makeSale({ discountPct: '0' })} onClose={vi.fn()} />)
    expect(screen.queryByText(/Descuento/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Recargo/)).not.toBeInTheDocument()
  })

  it('muestra los pagos con método en español y monto', () => {
    const sale = makeSale({
      payments: [
        { id: 1, saleId: 1, method: 'CASH', amount: '500' },
        { id: 2, saleId: 1, method: 'TRANSFER', amount: '500' }
      ]
    })
    render(<SaleDetailModal sale={sale} onClose={vi.fn()} />)
    expect(screen.getByText('EFECTIVO')).toBeInTheDocument()
    expect(screen.getByText('TRANSFERENCIA')).toBeInTheDocument()
  })

  it('Escape llama a onClose', () => {
    const onClose = vi.fn()
    render(<SaleDetailModal sale={makeSale()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click en overlay llama onClose', () => {
    const onClose = vi.fn()
    render(<SaleDetailModal sale={makeSale()} onClose={onClose} />)
    fireEvent.click(document.querySelector('.modal-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click dentro del modal NO llama onClose', () => {
    const onClose = vi.fn()
    render(<SaleDetailModal sale={makeSale()} onClose={onClose} />)
    fireEvent.click(document.querySelector('.modal')!)
    expect(onClose).not.toHaveBeenCalled()
  })
})
