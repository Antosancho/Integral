import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Sells from '../Sells'
import type { ProductFromApi, SaleFromApi, CreateSalePayload } from '../../../electron-api'

const product: ProductFromApi = {
  id: 7,
  name: 'Coca 2L',
  barcode: BigInt(7790070000005),
  purchasePrice: '500',
  salePrice: '1000',
  stock: 5,
  minStock: 0,
  createdAt: new Date() as unknown as string,
  categoryId: 1,
  supplierId: 1,
  category: { id: 1, name: 'Cat' },
  supplier: { id: 1, name: 'Prov', phone: null, notes: null }
}

const fakeSale: SaleFromApi = {
  id: 1,
  date: new Date(),
  total: '1000',
  items: [],
  payments: []
}

let createSale: ReturnType<typeof vi.fn>
let getProductByBarcode: ReturnType<typeof vi.fn>

beforeEach(() => {
  createSale = vi.fn().mockResolvedValue(fakeSale)
  getProductByBarcode = vi.fn().mockResolvedValue(product)
  ;(window as any).api = {
    createSale,
    getProductByBarcode,
    listProducts: vi.fn().mockResolvedValue([])
  }
})

afterEach(() => {
  delete (window as any).api
})

async function addOneProduct() {
  const barcodeInput = screen.getByPlaceholderText(/código de barras/i) as HTMLInputElement
  fireEvent.change(barcodeInput, { target: { value: '7790070000005' } })
  fireEvent.keyDown(barcodeInput, { key: 'Enter' })
  await waitFor(() => expect(screen.getByText('Coca 2L')).toBeInTheDocument())
}

describe('Sells — flujo de confirmación de venta', () => {
  it('botón APROBAR VENTA está deshabilitado al inicio (carrito vacío)', () => {
    render(<Sells />)
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).toBeDisabled()
  })

  it('con producto pero sin pagos, el botón sigue deshabilitado', async () => {
    render(<Sells />)
    await addOneProduct()
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).toBeDisabled()
  })

  it('click en label EFECTIVO autocompleta el input con el total', async () => {
    const user = userEvent.setup()
    render(<Sells />)
    await addOneProduct()
    await user.click(screen.getByRole('button', { name: /Autocompletar EFECTIVO/ }))
    const cashInput = screen.getByRole('textbox', { name: 'EFECTIVO' }) as HTMLInputElement
    expect(cashInput.value).toBe('1000')
  })

  it('al cubrir el total con efectivo, el botón se habilita y al hacer click llama window.api.createSale', async () => {
    const user = userEvent.setup()
    render(<Sells />)
    await addOneProduct()
    const cashInput = screen.getByRole('textbox', { name: 'EFECTIVO' }) as HTMLInputElement
    fireEvent.change(cashInput, { target: { value: '1000' } })
    const approve = screen.getByRole('button', { name: 'APROBAR VENTA' })
    await waitFor(() => expect(approve).not.toBeDisabled())
    await user.click(approve)
    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
    const arg = createSale.mock.calls[0][0] as CreateSalePayload
    expect(arg.items).toEqual([{ productId: 7, quantity: 1, unitPrice: '1000' }])
    expect(arg.payments).toEqual([{ method: 'CASH', amount: 1000 }])
    expect(Number(arg.total)).toBe(1000)
  })

  it('después de confirmar, carrito se vacía, descuento vuelve a 0 e inputs de pago se limpian', async () => {
    const user = userEvent.setup()
    render(<Sells />)
    await addOneProduct()
    const cashInput = screen.getByRole('textbox', { name: 'EFECTIVO' }) as HTMLInputElement
    fireEvent.change(cashInput, { target: { value: '1000' } })
    await user.click(screen.getByRole('button', { name: 'APROBAR VENTA' }))
    await waitFor(() => expect(createSale).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Coca 2L')).not.toBeInTheDocument())
    expect((screen.getByRole('textbox', { name: 'EFECTIVO' }) as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).toBeDisabled()
  })

  it('pago combinado: parte EFECTIVO + parte TRANSFER llama createSale con dos payments', async () => {
    const user = userEvent.setup()
    render(<Sells />)
    await addOneProduct()
    fireEvent.change(screen.getByRole('textbox', { name: 'EFECTIVO' }), { target: { value: '600' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'TRANSFERENCIA' }), { target: { value: '400' } })
    await user.click(screen.getByRole('button', { name: 'APROBAR VENTA' }))
    await waitFor(() => expect(createSale).toHaveBeenCalled())
    const arg = createSale.mock.calls[0][0] as CreateSalePayload
    expect(arg.payments).toEqual([
      { method: 'CASH', amount: 600 },
      { method: 'TRANSFER', amount: 400 }
    ])
  })

  it('autoFill respeta lo ya cargado: total=1000, CASH=300 → click TRANSFER → input TRANSFER=700', async () => {
    const user = userEvent.setup()
    render(<Sells />)
    await addOneProduct()
    fireEvent.change(screen.getByRole('textbox', { name: 'EFECTIVO' }), { target: { value: '300' } })
    await user.click(screen.getByRole('button', { name: /Autocompletar TRANSFERENCIA/ }))
    const transferInput = screen.getByRole('textbox', { name: 'TRANSFERENCIA' }) as HTMLInputElement
    expect(transferInput.value).toBe('700')
  })

  it('si createSale tira error, el carrito NO se resetea (la venta no se confirmó)', async () => {
    createSale.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(<Sells />)
    await addOneProduct()
    fireEvent.change(screen.getByRole('textbox', { name: 'EFECTIVO' }), { target: { value: '1000' } })
    await user.click(screen.getByRole('button', { name: 'APROBAR VENTA' }))
    await waitFor(() => expect(createSale).toHaveBeenCalled())
    expect(screen.getByText('Coca 2L')).toBeInTheDocument()
  })

  it('pago con exceso habilita APROBAR y muestra vuelto positivo', async () => {
    const user = userEvent.setup()
    render(<Sells />)
    await addOneProduct()
    // total = 1000, el cliente paga 1500 en efectivo
    fireEvent.change(screen.getByRole('textbox', { name: 'EFECTIVO' }), { target: { value: '1500' } })
    const approve = screen.getByRole('button', { name: 'APROBAR VENTA' })
    await waitFor(() => expect(approve).not.toBeDisabled())
    // El vuelto es positivo (500 de cambio)
    const vueltoBox = screen.getByText('VUELTO').parentElement!
    expect(vueltoBox.textContent).toMatch(/500/)
    // Confirmar la venta
    await user.click(approve)
    await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
    const arg = createSale.mock.calls[0][0] as CreateSalePayload
    // Se enviaron los 1500 ingresados (no solo el total)
    expect(arg.payments).toEqual([{ method: 'CASH', amount: 1500 }])
  })
})
