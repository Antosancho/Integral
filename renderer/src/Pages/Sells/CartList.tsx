import { useState } from 'react'
import { formatMoney } from '../../utils/format'
import { lineTotal } from './cartReducer'
import type { CartLine } from './types'

type Props = {
  lines: CartLine[]
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, unitPrice: string) => void
  onRemove: (lineId: string) => void
  discountPct: number
  onDiscountChange: (pct: number) => void
}

export default function CartList({ lines, onQuantityChange, onUnitPriceChange, onRemove, discountPct, onDiscountChange }: Props) {
  const [drafts, setDrafts] = useState<Record<string, { quantity?: string; unitPrice?: string }>>({})

  const setDraft = (lineId: string, field: 'quantity' | 'unitPrice', value: string) => {
    setDrafts(prev => ({ ...prev, [lineId]: { ...prev[lineId], [field]: value } }))
  }

  const clearDraft = (lineId: string, field: 'quantity' | 'unitPrice') => {
    setDrafts(prev => {
      const line = prev[lineId]
      if (!line) return prev
      const { [field]: _unused, ...rest } = line
      const next = { ...prev, [lineId]: rest }
      if (Object.keys(rest).length === 0) delete next[lineId]
      return next
    })
  }

  const commitQuantity = (lineId: string, currentQuantity: number) => {
    const draft = drafts[lineId]?.quantity
    if (draft === undefined) return
    if (draft === '') { clearDraft(lineId, 'quantity'); return }
    const n = Number(draft)
    if (!Number.isFinite(n) || n < 1) { clearDraft(lineId, 'quantity'); return }
    const normalized = Math.floor(n)
    clearDraft(lineId, 'quantity')
    if (normalized !== currentQuantity) onQuantityChange(lineId, normalized)
  }

  const commitUnitPrice = (lineId: string, currentUnitPrice: string) => {
    const draft = drafts[lineId]?.unitPrice
    if (draft === undefined) return
    if (draft === '') { clearDraft(lineId, 'unitPrice'); return }
    const n = Number(draft)
    if (!Number.isFinite(n) || n < 0) { clearDraft(lineId, 'unitPrice'); return }
    clearDraft(lineId, 'unitPrice')
    if (draft !== currentUnitPrice) onUnitPriceChange(lineId, draft)
  }

  const subtotal = lines.reduce((acc, line) => acc + lineTotal(line), 0)
  const discountFactor = 1 - discountPct / 100
  const total = Math.max(0, subtotal * discountFactor)

  if (lines.length === 0) {
    return <p className="cart-list__empty">Agregá productos con el lector o F2</p>
  }

  return (
    <div className="cart-list">
      <div className="cart-list__header">Nombre</div>
      <div className="cart-list__header">Cantidad</div>
      <div className="cart-list__header">Precio unitario</div>
      <div className="cart-list__header">Total</div>
      <div className="cart-list__header"></div>

      {lines.map(line => {
        const name = line.kind === 'product' ? line.product.name : 'General'
        const overStock =
          line.kind === 'product' && line.quantity > line.product.stock

        return (
          <div
            key={line.lineId}
            className="cart-list__row"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key !== 'Delete') return
              if (document.activeElement instanceof HTMLInputElement) return
              e.preventDefault()
              onRemove(line.lineId)
            }}
          >
            <div className="cart-list__cell">
              {name}
              {overStock && (
                <span className="cart-row__warn"> ⚠ Sin stock suficiente</span>
              )}
            </div>
            <div className="cart-list__cell">
              <input
                type="number"
                min="1"
                step="1"
                value={drafts[line.lineId]?.quantity ?? String(line.quantity)}
                onChange={e => setDraft(line.lineId, 'quantity', e.target.value)}
                onBlur={() => commitQuantity(line.lineId, line.quantity)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitQuantity(line.lineId, line.quantity)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    clearDraft(line.lineId, 'quantity')
                  }
                }}
              />
            </div>
            <div className="cart-list__cell">
              <input
                type="number"
                min="0"
                step="0.01"
                value={drafts[line.lineId]?.unitPrice ?? line.unitPrice}
                onChange={e => setDraft(line.lineId, 'unitPrice', e.target.value)}
                onBlur={() => commitUnitPrice(line.lineId, line.unitPrice)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitUnitPrice(line.lineId, line.unitPrice)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    clearDraft(line.lineId, 'unitPrice')
                  }
                }}
              />
            </div>
            <div className="cart-list__cell">
              {formatMoney(lineTotal(line))}
            </div>
            <div className="cart-list__cell">
              <button
                type="button"
                aria-label="Eliminar"
                onClick={() => onRemove(line.lineId)}
              >
                ✕
              </button>
            </div>
          </div>
        )
      })}

      <div className="cart-list__footer">
        <div className="cart-list__footer-row">
          <span className="cart-list__footer-label">Subtotal</span>
          <span className="cart-list__footer-value">{formatMoney(subtotal)}</span>
        </div>
        <div className="cart-list__footer-row">
          <span className="cart-list__footer-label">Descuento</span>
          <input
            className="cart-list__discount-input"
            type="number"
            step="0.01"
            aria-label="Descuento"
            value={discountPct}
            onChange={e => {
              const n = e.target.valueAsNumber
              if (Number.isFinite(n)) onDiscountChange(n)
            }}
          />
          <span className="cart-list__footer-pct">%</span>
        </div>
        <div className="cart-list__footer-row">
          <span className="cart-list__footer-label cart-list__footer-label--total">Total</span>
          <span className="cart-list__footer-value cart-list__footer-value--total">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  )
}