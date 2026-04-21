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
                value={line.quantity}
                onChange={e => onQuantityChange(line.lineId, Number(e.target.value))}
              />
            </div>
            <div className="cart-list__cell">
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unitPrice}
                onChange={e => onUnitPriceChange(line.lineId, e.target.value)}
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
    </div>
  )
}