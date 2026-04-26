import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaymentPanel from '../PaymentPanel'
import { initialPayments, type PaymentsDraft } from '../payments'

type Overrides = Partial<{
  subtotal: number
  total: number
  discountPct: number
  payments: PaymentsDraft
  hasItems: boolean
  // hasGeneralLines removed: general lines are supported
  onDiscountChange: (pct: number) => void
  onPaymentChange: (method: any, value: string) => void
  onAutoFill: (method: any) => void
  onConfirm: () => void
}>

const renderPanel = (o: Overrides = {}) => {
  const onDiscountChange = o.onDiscountChange ?? vi.fn()
  const onPaymentChange = o.onPaymentChange ?? vi.fn()
  const onAutoFill = o.onAutoFill ?? vi.fn()
  const onConfirm = o.onConfirm ?? vi.fn()
  const utils = render(
    <PaymentPanel
      subtotal={o.subtotal ?? 0}
      total={o.total ?? 0}
      discountPct={o.discountPct ?? 0}
      payments={o.payments ?? initialPayments}
      hasItems={o.hasItems ?? true}
      
      onDiscountChange={onDiscountChange}
      onPaymentChange={onPaymentChange}
      onAutoFill={onAutoFill}
      onConfirm={onConfirm}
    />
  )
  return { ...utils, onDiscountChange, onPaymentChange, onAutoFill, onConfirm }
}

describe('PaymentPanel — render', () => {
  it('muestra SUBTOTAL, DESCUENTO, TOTAL, VUELTO y APROBAR VENTA', () => {
    renderPanel({ subtotal: 1000, total: 900 })
    expect(screen.getByText('SUBTOTAL')).toBeInTheDocument()
    expect(screen.getByText('DESCUENTO')).toBeInTheDocument()
    expect(screen.getByText('TOTAL')).toBeInTheDocument()
    expect(screen.getByText('VUELTO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).toBeInTheDocument()
  })

  it('muestra los 5 medios de pago como botones de label + inputs', () => {
    renderPanel()
    ;['EFECTIVO', 'DÉBITO', 'CRÉDITO', 'TRANSFERENCIA', 'OTROS'].forEach(label => {
      expect(screen.getByRole('button', { name: new RegExp(`Autocompletar ${label}`) })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: label })).toBeInTheDocument()
    })
  })

  it('muestra el discountPct en el input de descuento', () => {
    renderPanel({ discountPct: 15 })
    const input = screen.getByRole('spinbutton', { name: /descuento/i }) as HTMLInputElement
    expect(input.value).toBe('15')
  })
})

describe('PaymentPanel — botón APROBAR VENTA habilitado/deshabilitado', () => {
  it('deshabilitado si carrito vacío (hasItems=false) aunque pagos cuadren', () => {
    const payments = { ...initialPayments, CASH: '1000' }
    renderPanel({ hasItems: false, payments, total: 1000 })
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).toBeDisabled()
  })

  it('deshabilitado si pagos no cubren total', () => {
    const payments = { ...initialPayments, CASH: '500' }
    renderPanel({ hasItems: true, payments, total: 1000 })
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).toBeDisabled()
  })

  it('no deshabilitado por líneas "general" en el carrito (ahora soportadas)', () => {
    const payments = { ...initialPayments, CASH: '1000' }
    renderPanel({ hasItems: true, payments, total: 1000 })
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).not.toBeDisabled()
  })

  it('habilitado si hasItems && pagos cuadran && no hay general', () => {
    const payments = { ...initialPayments, CASH: '1000' }
    renderPanel({ hasItems: true, payments, total: 1000 })
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).not.toBeDisabled()
  })

  it('habilitado dentro del epsilon (0.01)', () => {
    const payments = { ...initialPayments, CASH: '999.995' }
    renderPanel({ hasItems: true, payments, total: 1000 })
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).not.toBeDisabled()
  })

  it('habilitado si pagos exceden el total (cliente paga de más → vuelto positivo)', () => {
    const payments = { ...initialPayments, CASH: '1200' }
    renderPanel({ hasItems: true, payments, total: 1000 })
    expect(screen.getByRole('button', { name: 'APROBAR VENTA' })).not.toBeDisabled()
  })

  it('el hint sobre líneas General no aparece nunca', () => {
    const payments = { ...initialPayments, CASH: '1000' }
    renderPanel({ hasItems: true, payments, total: 1000 })
    expect(screen.queryByText(/líneas General aún no se pueden guardar/i)).toBeNull()
  })
})

describe('PaymentPanel — vuelto', () => {
  it('vuelto negativo si pagos < total (muestra déficit)', () => {
    const payments = { ...initialPayments, CASH: '500' }
    renderPanel({ payments, total: 1000 })
    const vueltoBox = screen.getByText('VUELTO').parentElement!
    expect(vueltoBox.textContent).toMatch(/-/)
  })

  it('vuelto = 0 si pagos == total', () => {
    const payments = { ...initialPayments, CASH: '1000' }
    renderPanel({ payments, total: 1000 })
    const vueltoBox = screen.getByText('VUELTO').parentElement!
    expect(vueltoBox.textContent).toMatch(/\$\s*0/)
  })

  it('vuelto positivo si pagos > total', () => {
    const payments = { ...initialPayments, CASH: '1200' }
    renderPanel({ payments, total: 1000 })
    const vueltoBox = screen.getByText('VUELTO').parentElement!
    expect(vueltoBox.textContent).toMatch(/200/)
  })
})

describe('PaymentPanel — interacciones', () => {
  it('escribir en un input de pago llama onPaymentChange con el método y valor', () => {
    const onPaymentChange = vi.fn()
    renderPanel({ onPaymentChange })
    const input = screen.getByRole('textbox', { name: 'EFECTIVO' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '500' } })
    expect(onPaymentChange).toHaveBeenCalledWith('CASH', '500')
  })

  it('click en label de medio de pago llama onAutoFill con el método', async () => {
    const user = userEvent.setup()
    const onAutoFill = vi.fn()
    renderPanel({ onAutoFill })
    await user.click(screen.getByRole('button', { name: /Autocompletar TRANSFERENCIA/ }))
    expect(onAutoFill).toHaveBeenCalledWith('TRANSFER')
  })

  it('click en APROBAR VENTA habilitado llama onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const payments = { ...initialPayments, CASH: '1000' }
    renderPanel({ payments, total: 1000, onConfirm })
    await user.click(screen.getByRole('button', { name: 'APROBAR VENTA' }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('click en APROBAR VENTA deshabilitado NO llama onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    renderPanel({ total: 1000, payments: initialPayments, onConfirm })
    await user.click(screen.getByRole('button', { name: 'APROBAR VENTA' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cambio de descuento a número válido llama onDiscountChange', () => {
    const onDiscountChange = vi.fn()
    renderPanel({ onDiscountChange })
    const input = screen.getByRole('spinbutton', { name: /descuento/i })
    fireEvent.change(input, { target: { value: '20' } })
    expect(onDiscountChange).toHaveBeenCalledWith(20)
  })

  it('cambio de descuento a NaN NO llama onDiscountChange', () => {
    const onDiscountChange = vi.fn()
    renderPanel({ onDiscountChange })
    const input = screen.getByRole('spinbutton', { name: /descuento/i })
    fireEvent.change(input, { target: { value: 'xx' } })
    expect(onDiscountChange).not.toHaveBeenCalled()
  })
})
