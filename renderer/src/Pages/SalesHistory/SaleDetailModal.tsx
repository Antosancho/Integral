import { useEffect, useRef } from 'react'
import type { SaleFromApi } from '../../electron-api'
import { PAYMENT_LABELS, type PaymentMethod } from '../Sells/payments'
import { formatMoney } from '../../utils/format'
import './SaleDetailModal.css'

interface SaleDetailModalProps {
  sale: SaleFromApi | null
  onClose: () => void
}

export default function SaleDetailModal({ sale, onClose }: SaleDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sale !== null) modalRef.current?.focus()
  }, [sale])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (sale !== null) {
      document.addEventListener('keydown', handler)
      return () => document.removeEventListener('keydown', handler)
    }
  }, [sale, onClose])

  if (sale === null) return null

  const subtotal = sale.items.reduce(
    (acc, item) => acc + item.quantity * Number(item.unitPrice),
    0
  )
  const pct = Number(sale.discountPct)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Venta #${sale.id}`}
        tabIndex={-1}
        ref={modalRef}
        onClick={e => e.stopPropagation()}
      >
        <button className="modal__close" type="button" onClick={onClose} aria-label="Cerrar">✕</button>
        <h2 className="modal__title">Venta #{sale.id}</h2>
        <p className="modal__date">
          {new Intl.DateTimeFormat('es-AR', {
            dateStyle: 'full',
            timeStyle: 'short',
            timeZone: 'America/Argentina/Buenos_Aires'
          }).format(new Date(sale.date))}
        </p>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio unitario</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map(item => (
              <tr key={item.id}>
                <td>{item.product.name}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(Number(item.unitPrice))}</td>
                <td>{formatMoney(item.quantity * Number(item.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="modal__totals">
          <div className="modal__totals-row">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {pct > 0 && (
            <div className="modal__totals-row">
              <span>Descuento: {pct}%</span>
              <span>-{formatMoney(subtotal * pct / 100)}</span>
            </div>
          )}
          {pct < 0 && (
            <div className="modal__totals-row">
              <span>Recargo: {Math.abs(pct)}%</span>
              <span>+{formatMoney(subtotal * Math.abs(pct) / 100)}</span>
            </div>
          )}
          <div className="modal__totals-row modal__totals-row--total">
            <span>Total</span>
            <span>{formatMoney(Number(sale.total))}</span>
          </div>
          {sale.payments.map(payment => (
            <div key={payment.id} className="modal__totals-row">
              <span>{PAYMENT_LABELS[payment.method as PaymentMethod] ?? payment.method}</span>
              <span>{formatMoney(Number(payment.amount))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
