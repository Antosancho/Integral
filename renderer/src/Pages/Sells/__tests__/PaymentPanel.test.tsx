import { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PaymentPanel from '../PaymentPanel'
import type { PaymentPanelHandle } from '../PaymentPanel'
import { initialPayments, type PaymentMethod, type PaymentsDraft } from '../payments'

type Overrides = Partial<{
  subtotal: number
  total: number
  discountPct: number
  payments: PaymentsDraft
  canApprove: boolean
  disabledReason: string | null
  saving: boolean
  onDiscountChange: (pct: number) => void
  onPaymentChange: (method: PaymentMethod, value: string) => void
  onPaymentBlur: (method: PaymentMethod) => void
  onFillRemaining: (method: PaymentMethod) => void
  onApprove: () => void
}>

const renderPanel = (o: Overrides = {}, ref?: React.Ref<PaymentPanelHandle>) => {
  const handlers = {
    onDiscountChange: o.onDiscountChange ?? vi.fn(),
    onPaymentChange: o.onPaymentChange ?? vi.fn(),
    onPaymentBlur: o.onPaymentBlur ?? vi.fn(),
    onFillRemaining: o.onFillRemaining ?? vi.fn(),
    onApprove: o.onApprove ?? vi.fn()
  }
  const utils = render(
    <PaymentPanel
      ref={ref}
      subtotal={o.subtotal ?? 0}
      total={o.total ?? 0}
      discountPct={o.discountPct ?? 0}
      payments={o.payments ?? initialPayments}
      canApprove={o.canApprove ?? true}
      disabledReason={o.disabledReason ?? null}
      saving={o.saving ?? false}
      {...handlers}
    />
  )
  return { ...utils, ...handlers }
}

const discount = () => screen.getByLabelText('Descuento') as HTMLInputElement
const approve = () => screen.getByRole('button', { name: 'APROBAR VENTA' })

describe('PaymentPanel — render', () => {
  it('muestra Subtotal, Descuento, TOTAL, el vuelto y APROBAR VENTA', () => {
    renderPanel({ subtotal: 1000, total: 900 })
    expect(screen.getByRole('region', { name: 'Pago' })).toBeInTheDocument()
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('$ 1.000,00')).toBeInTheDocument()
    expect(screen.getByText('TOTAL')).toBeInTheDocument()
    expect(screen.getByText('$ 900,00', { selector: '.ig-pay-total .v' })).toBeInTheDocument()
    expect(document.querySelector('.ig-change')).toBeInTheDocument()
    expect(approve()).toBeInTheDocument()
  })

  it('muestra los 5 medios de pago como botón-etiqueta + input', () => {
    renderPanel()
    ;['EFECTIVO', 'DÉBITO', 'CRÉDITO', 'TRANSFERENCIA', 'OTROS'].forEach((label) => {
      expect(screen.getByRole('button', { name: `Autocompletar ${label}` })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: label })).toBeInTheDocument()
    })
  })

  it('el input de descuento muestra el valor y la ayuda', () => {
    renderPanel({ discountPct: 10 })
    expect(discount().value).toBe('10')
    expect(screen.getByText('positivo = descuento · negativo = recargo')).toBeInTheDocument()
  })

  it('con descuento negativo el rótulo pasa a "Recargo" y el input se marca', () => {
    renderPanel({ discountPct: -10 })
    expect(screen.getByText('Recargo', { selector: 'label' })).toBeInTheDocument()
    expect(discount()).toHaveClass('is-recargo')
    expect(discount().value).toBe('-10')
  })

  it('el descuento no tiene spinners (input de texto con inputMode decimal)', () => {
    renderPanel()
    expect(discount()).toHaveAttribute('type', 'text')
    expect(discount()).toHaveAttribute('inputmode', 'decimal')
  })

  it('un medio con monto queda is-filled', () => {
    renderPanel({ payments: { ...initialPayments, CASH: '1.000,00' } })
    expect(screen.getByRole('textbox', { name: 'EFECTIVO' }).closest('.ig-pay-method')).toHaveClass('is-filled')
    expect(screen.getByRole('textbox', { name: 'DÉBITO' }).closest('.ig-pay-method')).not.toHaveClass('is-filled')
  })
})

describe('PaymentPanel — APROBAR VENTA', () => {
  it('canApprove=false lo deshabilita y se muestra el motivo', () => {
    renderPanel({ canApprove: false, disabledReason: 'Falta cubrir $ 500,00' })
    expect(approve()).toBeDisabled()
    expect(screen.getByText('Falta cubrir $ 500,00')).toBeInTheDocument()
  })

  it('canApprove=true lo habilita y no hay motivo', () => {
    renderPanel({ canApprove: true })
    expect(approve()).toBeEnabled()
    expect(document.querySelector('.ig-hint')).toBeNull()
  })

  it('el click llama onApprove; deshabilitado no lo llama', () => {
    const first = renderPanel({ canApprove: true })
    fireEvent.click(approve())
    expect(first.onApprove).toHaveBeenCalledTimes(1)
    first.unmount()

    const second = renderPanel({ canApprove: false, disabledReason: 'Agregá al menos un producto' })
    fireEvent.click(approve())
    expect(second.onApprove).not.toHaveBeenCalled()
  })

  it('guardando: dice "Guardando…", queda deshabilitado y oculta el motivo', () => {
    renderPanel({ saving: true, canApprove: true, disabledReason: 'Falta cubrir $ 1,00' })
    const busy = screen.getByRole('button', { name: 'Guardando…' })
    expect(busy).toBeDisabled()
    expect(screen.queryByText('Falta cubrir $ 1,00')).toBeNull()
  })

  it('el atajo F12 se muestra pero no es parte del nombre accesible', () => {
    renderPanel()
    expect(screen.getByText('F12')).toHaveAttribute('aria-hidden', 'true')
    expect(approve()).toBeInTheDocument()
  })

  it('no hay ningún hint sobre líneas General', () => {
    renderPanel({ canApprove: true })
    expect(screen.queryByText(/General/)).toBeNull()
  })
})

describe('PaymentPanel — vuelto', () => {
  it('sin pagos muestra "Falta cubrir" con el total', () => {
    renderPanel({ total: 1000 })
    expect(document.querySelector('.ig-change')).toHaveClass('is-due')
  })

  it('pagos == total → "Pago exacto"', () => {
    renderPanel({ total: 1000, payments: { ...initialPayments, CASH: '1000' } })
    expect(document.querySelector('.ig-change')).toHaveClass('is-exact')
  })

  it('pagos > total → "Vuelto" con la diferencia', () => {
    renderPanel({ total: 1000, payments: { ...initialPayments, CASH: '1.200,00' } })
    expect(document.querySelector('.ig-change')).toHaveClass('is-return')
    expect(screen.getAllByText('$ 200,00').length).toBeGreaterThan(0)
  })
})

describe('PaymentPanel — interacciones', () => {
  it('escribir en un input de pago llama onPaymentChange con método y valor', () => {
    const { onPaymentChange } = renderPanel()
    fireEvent.change(screen.getByRole('textbox', { name: 'EFECTIVO' }), { target: { value: '500' } })
    expect(onPaymentChange).toHaveBeenCalledWith('CASH', '500')
  })

  it('el blur de un input de pago llama onPaymentBlur', () => {
    const { onPaymentBlur } = renderPanel()
    const input = screen.getByRole('textbox', { name: 'DÉBITO' })
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(onPaymentBlur).toHaveBeenCalledWith('DEBIT')
  })

  it('click en la etiqueta llama onFillRemaining y luego enfoca y selecciona su input', async () => {
    const { onFillRemaining } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Autocompletar TRANSFERENCIA' }))
    expect(onFillRemaining).toHaveBeenCalledWith('TRANSFER')
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'TRANSFERENCIA' })).toHaveFocus())
  })

  it('focusMethod() por ref enfoca el input del medio', () => {
    const ref = createRef<PaymentPanelHandle>()
    renderPanel({}, ref)
    ref.current!.focusMethod('CREDIT')
    expect(screen.getByRole('textbox', { name: 'CRÉDITO' })).toHaveFocus()
  })
})

describe('PaymentPanel — descuento', () => {
  it('blur con número válido llama onDiscountChange', () => {
    const { onDiscountChange } = renderPanel()
    fireEvent.change(discount(), { target: { value: '15' } })
    fireEvent.blur(discount())
    expect(onDiscountChange).toHaveBeenCalledWith(15)
  })

  it('acepta coma decimal ("7,5") y signo negativo', () => {
    const { onDiscountChange } = renderPanel()
    fireEvent.change(discount(), { target: { value: '7,5' } })
    fireEvent.blur(discount())
    expect(onDiscountChange).toHaveBeenLastCalledWith(7.5)
    fireEvent.change(discount(), { target: { value: '-10' } })
    fireEvent.blur(discount())
    expect(onDiscountChange).toHaveBeenLastCalledWith(-10)
  })

  it('Enter confirma', () => {
    const { onDiscountChange } = renderPanel()
    fireEvent.change(discount(), { target: { value: '20' } })
    fireEvent.keyDown(discount(), { key: 'Enter' })
    expect(onDiscountChange).toHaveBeenCalledWith(20)
  })

  it('fuera de rango no llama onDiscountChange y revierte el borrador', () => {
    const { onDiscountChange } = renderPanel({ discountPct: 5 })
    fireEvent.change(discount(), { target: { value: '500' } })
    fireEvent.blur(discount())
    expect(onDiscountChange).not.toHaveBeenCalled()
    expect(discount().value).toBe('5')
  })

  it('texto ilegible revierte al último valor válido', () => {
    const { onDiscountChange } = renderPanel({ discountPct: 5 })
    fireEvent.change(discount(), { target: { value: 'abc' } })
    fireEvent.blur(discount())
    expect(onDiscountChange).not.toHaveBeenCalled()
    expect(discount().value).toBe('5')
  })

  it('Escape restaura el valor previo', () => {
    renderPanel({ discountPct: 5 })
    fireEvent.change(discount(), { target: { value: '12' } })
    fireEvent.keyDown(discount(), { key: 'Escape' })
    expect(discount().value).toBe('5')
  })

  it('un campo vacío mientras se edita no se pisa, y al salir cuenta como 0', () => {
    const { onDiscountChange } = renderPanel({ discountPct: 5 })
    fireEvent.change(discount(), { target: { value: '' } })
    expect(discount().value).toBe('')
    fireEvent.blur(discount())
    expect(onDiscountChange).toHaveBeenCalledWith(0)
  })
})
