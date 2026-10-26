import { Check } from 'lucide-react'
import type { SaleFromApi } from '../../electron-api'
import { Badge } from '../../ui/Badge'
import { formatDate, formatMoney, formatTime } from '../../utils/format'
import { PAYMENT_ICONS, PAYMENT_TITLE_LABELS, PAYMENT_EPSILON } from '../Sells/payments'
import type { PaymentMethod } from '../Sells/payments'

/**
 * Detalle de una venta (tarjeta del lado derecho del Historial): ítems, subtotal, descuento o recargo,
 * total, pagos y vuelto. Reemplaza al viejo modal de detalle.
 */
export default function SaleDetailCard({ sale }: { sale: SaleFromApi }) {
  const date = new Date(sale.date)
  const subtotal = sale.items.reduce((acc, item) => acc + item.quantity * Number(item.unitPrice), 0)
  const pct = Number(sale.discountPct)
  const total = Number(sale.total)
  const paid = sale.payments.reduce((acc, p) => acc + Number(p.amount), 0)
  const change = paid - total

  return (
    <div className="ig-card">
      <div className="ig-card-head">
        <div>
          <h3>Venta #{sale.id}</h3>
          <div className="ig-help">
            {formatDate(date)} · {formatTime(date)}
          </div>
        </div>
        <Badge tone="success" icon={Check}>
          Pagada
        </Badge>
      </div>

      <table className="ig-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th className="r">Cant.</th>
            <th className="r">Precio</th>
            <th className="r">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id}>
              {/* Sin producto asociado = ítem "General" (monto libre). */}
              <td className="name">{item.product?.name ?? 'General'}</td>
              <td className="r">{item.quantity}</td>
              <td className="r">{formatMoney(Number(item.unitPrice))}</td>
              <td className="r">{formatMoney(item.quantity * Number(item.unitPrice))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ig-card-body" style={{ display: 'grid', gap: 8 }}>
        <div className="ig-pay-row">
          <span>Subtotal</span>
          <span className="v num">{formatMoney(subtotal)}</span>
        </div>
        {pct > 0 && (
          <div className="ig-pay-row">
            <span>Descuento {pct} %</span>
            <span className="v num">{formatMoney(-(subtotal * pct) / 100)}</span>
          </div>
        )}
        {pct < 0 && (
          <div className="ig-pay-row">
            <span>Recargo {Math.abs(pct)} %</span>
            <span className="v num">+{formatMoney((subtotal * Math.abs(pct)) / 100)}</span>
          </div>
        )}
        <div className="ig-pay-row" style={{ color: 'var(--ink)' }}>
          <span>
            <b>Total</b>
          </span>
          <span className="amount-lg num">{formatMoney(total)}</span>
        </div>

        <div className="ig-overline" style={{ marginTop: 8 }}>
          Pagos
        </div>
        {sale.payments.map((payment) => {
          const method = payment.method as PaymentMethod
          const Icon = PAYMENT_ICONS[method]
          return (
            <div key={payment.id} className="ig-pay-row">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />}
                {PAYMENT_TITLE_LABELS[method] ?? payment.method}
              </span>
              <span className="v num">{formatMoney(Number(payment.amount))}</span>
            </div>
          )
        })}
        {change > PAYMENT_EPSILON && (
          <div className="ig-pay-row" style={{ color: 'var(--success)' }}>
            <span>Vuelto</span>
            <span className="v num" style={{ color: 'var(--success)' }}>
              {formatMoney(change)}
            </span>
          </div>
        )}
      </div>

      {/* Futuro: Reimprimir ticket · Anular venta (admin) */}
    </div>
  )
}
