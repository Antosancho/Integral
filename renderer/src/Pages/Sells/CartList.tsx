import { useState } from 'react'
import { formatMoney } from '../../utils/format'
import { lineTotal } from './cartReducer'
import type { CartLine } from './types'

type Props = {
  lines: CartLine[]
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, unitPrice: string) => void
  onRemove: (lineId: string) => void
}

export default function CartList({ lines, onQuantityChange, onUnitPriceChange, onRemove }: Props) {
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

  return (
    <div className="cart-list">
      {lines.length === 0 ? (
        <p className="cart-list__empty">Agregá productos con el lector o F2</p>
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
