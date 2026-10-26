import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Check, Info } from 'lucide-react'
import { Button } from '../../ui/Button'
import { formatMoney } from '../../utils/format'
import { parseDecimal } from '../../utils/parse'
import ChangeIndicator from './ChangeIndicator'
import {
  PAYMENT_ICONS,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  parsePaymentAmount,
  sumPayments,
  type PaymentMethod,
  type PaymentsDraft
} from './payments'

type Props = {
  subtotal: number
  total: number
  discountPct: number
  onDiscountChange: (pct: number) => void
  payments: PaymentsDraft
  onPaymentChange: (method: PaymentMethod, value: string) => void
  /** Al salir del input de un medio: el padre reformatea el texto ("20000" → "20.000,00"). */
  onPaymentBlur: (method: PaymentMethod) => void
  /** Click en la etiqueta del medio: completar con lo que falta. */
  onFillRemaining: (method: PaymentMethod) => void
  canApprove: boolean
  /** Por qué APROBAR está deshabilitado (siempre se muestra el motivo). */
  disabledReason: string | null
  onApprove: () => void
  saving: boolean
}

export type PaymentPanelHandle = { focusMethod: (method: PaymentMethod) => void }

/** Rango permitido del descuento/recargo (positivo = descuento, negativo = recargo). */
const DISCOUNT_MIN = -200
const DISCOUNT_MAX = 200

/** Descuento como texto editable (coma decimal es-AR). */
const discountToText = (pct: number): string => String(pct).replace('.', ',')

/**
 * Panel de pago, fijo abajo en Ventas: subtotal, descuento/recargo, medios de pago, TOTAL, vuelto y APROBAR VENTA.
 *
 * - El descuento usa un borrador de texto: se confirma en blur/Enter, Esc lo restaura y un valor
 *   fuera de [−200, 200] o ilegible vuelve al último válido (un campo vacío cuenta como 0).
 * - Click en la etiqueta de un medio completa lo que falta y deja el input seleccionado.
 */
const PaymentPanel = forwardRef<PaymentPanelHandle, Props>(function PaymentPanel(
  {
    subtotal,
    total,
    discountPct,
    onDiscountChange,
    payments,
    onPaymentChange,
    onPaymentBlur,
    onFillRemaining,
    canApprove,
    disabledReason,
    onApprove,
    saving
  },
  ref
) {
  const [discountDraft, setDiscountDraft] = useState<string>(discountToText(discountPct))
  const inputRefs = useRef<Partial<Record<PaymentMethod, HTMLInputElement | null>>>({})

  useEffect(() => {
    setDiscountDraft(discountToText(discountPct))
  }, [discountPct])

  const focusMethod = (method: PaymentMethod) => {
    const input = inputRefs.current[method]
    input?.focus()
    input?.select()
  }

  useImperativeHandle(ref, () => ({ focusMethod }))

  function commitDiscount() {
    const n = discountDraft.trim() === '' ? 0 : parseDecimal(discountDraft)
    if (n !== null && n >= DISCOUNT_MIN && n <= DISCOUNT_MAX) {
      onDiscountChange(n)
      setDiscountDraft(discountToText(n))
    } else {
      setDiscountDraft(discountToText(discountPct))
    }
  }

  function handleFill(method: PaymentMethod) {
    onFillRemaining(method)
    // El input se completa en el re-render siguiente; recién ahí se enfoca y selecciona.
    setTimeout(() => focusMethod(method), 0)
  }

  const isSurcharge = discountPct < 0

  return (
    <section className="ig-pay" aria-label="Pago">
      <div className="ig-pay-left">
        <div className="ig-pay-line">
          <div className="ig-pay-row">
            <span>Subtotal</span>
            <span className="v num">{formatMoney(subtotal)}</span>
          </div>
          <div className="ig-pay-row">
            <label htmlFor="discount-input">{isSurcharge ? 'Recargo' : 'Descuento'}</label>
            <div className="ig-input-wrap">
              <input
                id="discount-input"
                type="text"
                className={`ig-input${isSurcharge ? ' is-recargo' : ''}`}
                aria-label="Descuento"
                inputMode="decimal"
                style={{ paddingRight: 28 }}
                value={discountDraft}
                onChange={(e) => setDiscountDraft(e.target.value)}
                onBlur={commitDiscount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDiscount()
                  else if (e.key === 'Escape') setDiscountDraft(discountToText(discountPct))
                }}
              />
              <span className="ig-suffix">%</span>
            </div>
            <span className="ig-help">positivo = descuento · negativo = recargo</span>
          </div>
        </div>

        <div>
          <div className="ig-overline" style={{ marginBottom: 8 }}>
            Medios de pago
          </div>
          <div className="ig-pay-methods">
            {PAYMENT_METHODS.map((method) => {
              const Icon = PAYMENT_ICONS[method]
              const filled = parsePaymentAmount(payments[method]) > 0
              return (
                <div key={method} className={`ig-pay-method${filled ? ' is-filled' : ''}`}>
                  <button
                    type="button"
                    className="ig-pay-tag"
                    aria-label={`Autocompletar ${PAYMENT_LABELS[method]}`}
                    title="Completar con lo que falta"
                    onClick={() => handleFill(method)}
                  >
                    <Icon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                    {PAYMENT_LABELS[method]}
                  </button>
                  <input
                    ref={(el) => {
                      inputRefs.current[method] = el
                    }}
                    type="text"
                    className="ig-input"
                    aria-label={PAYMENT_LABELS[method]}
                    placeholder="0,00"
                    inputMode="decimal"
                    value={payments[method]}
                    onChange={(e) => onPaymentChange(method, e.target.value)}
                    onBlur={() => onPaymentBlur(method)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="ig-pay-sum">
        <div className="ig-pay-total">
          <span className="k">TOTAL</span>
          <span className="v num">{formatMoney(total)}</span>
        </div>
        <ChangeIndicator paid={sumPayments(payments)} total={total} />
        <Button variant="primary" size="xl" icon={Check} shortcut="F12" disabled={!canApprove || saving} onClick={onApprove}>
          {saving ? 'Guardando…' : 'APROBAR VENTA'}
        </Button>
        {disabledReason && !saving && (
          <div className="ig-hint" style={{ justifyContent: 'center' }}>
            <Info size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
            {disabledReason}
          </div>
        )}
      </div>
    </section>
  )
})

export default PaymentPanel
