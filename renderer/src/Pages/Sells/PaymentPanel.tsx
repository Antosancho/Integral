import { formatMoney } from '../../utils/format'
import {
  PAYMENT_METHODS,
  PAYMENT_LABELS,
  changeAmount,
  autoFillFor,
  paymentsCoverTotal,
  formatPaymentAmount,
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
  onAutoFill: (method: PaymentMethod) => void
  hasItems: boolean
  hasGeneralLines: boolean
  onConfirm: () => void
}

export default function PaymentPanel({
  subtotal,
  total,
  discountPct,
  onDiscountChange,
  payments,
  onPaymentChange,
  onAutoFill,
  hasItems,
  hasGeneralLines,
  onConfirm
}: Props) {
  const change = changeAmount(payments, total)
  const covers = paymentsCoverTotal(payments, total)
  const canConfirm = hasItems && covers && !hasGeneralLines

  return (
    <div className="payment-panel">
      <div className="payment-panel__totals">
        <div className="payment-panel__box">
          <span className="payment-panel__box-label">SUBTOTAL</span>
          <span className="payment-panel__box-value">{formatMoney(subtotal)}</span>
        </div>
        <div className="payment-panel__box">
          <span className="payment-panel__box-label">DESCUENTO</span>
          <input
            className="payment-panel__discount-input"
            type="number"
            step="0.01"
            aria-label="Descuento"
            value={discountPct}
            onChange={e => {
              const n = e.target.valueAsNumber
              if (Number.isFinite(n)) onDiscountChange(n)
            }}
          />
          <span className="payment-panel__box-suffix">%</span>
        </div>
      </div>

      <div className="payment-panel__methods">
        {PAYMENT_METHODS.map(method => (
          <div key={method} className="payment-panel__method">
            <button
              type="button"
              className="payment-panel__method-label"
              aria-label={`Autocompletar ${PAYMENT_LABELS[method]}`}
              onClick={() => onAutoFill(method)}
            >
              {PAYMENT_LABELS[method]}
            </button>
            <input
              className="payment-panel__method-input"
              type="text"
              inputMode="decimal"
              aria-label={PAYMENT_LABELS[method]}
              value={payments[method]}
              onChange={e => onPaymentChange(method, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="payment-panel__total-area">
        <div className="payment-panel__box payment-panel__box--total">
          <span className="payment-panel__box-label">TOTAL</span>
          <span className="payment-panel__box-value">{formatMoney(total)}</span>
        </div>
        <div className="payment-panel__box payment-panel__box--change">
          <span className="payment-panel__box-label">VUELTO</span>
          <span className="payment-panel__box-value">{formatMoney(change)}</span>
        </div>
        <button
          type="button"
          className="payment-panel__approve"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          APROBAR VENTA
        </button>
        {hasItems && hasGeneralLines && (
          <p className="payment-panel__hint">Las líneas General aún no se pueden guardar</p>
        )}
      </div>
    </div>
  )
}
