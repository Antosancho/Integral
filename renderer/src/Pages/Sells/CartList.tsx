import { formatMoney } from '../../utils/format'
import { lineTotal } from './cartReducer'
import type { CartLine } from './types'

type Props = {
  lines: CartLine[]
  onQuantityChange: (productId: number, quantity: number) => void
  onUnitPriceChange: (productId: number, unitPrice: string) => void
  onRemove: (productId: number) => void
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

      {lines.map(line => (
        <div
          key={line.productId}
          className="cart-list__row"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key !== 'Delete') return
            if (document.activeElement instanceof HTMLInputElement) return
            e.preventDefault()
            onRemove(line.productId)
          }}
        >
          <div className="cart-list__cell">
            {line.product.name}
            {line.quantity > line.product.stock && (
              <span className="cart-row__warn"> ⚠ Sin stock suficiente</span>
            )}
          </div>
          <div className="cart-list__cell">
            <input
              type="number"
              min="1"
              step="1"
              value={line.quantity}
              onChange={e => onQuantityChange(line.productId, Number(e.target.value))}
            />
          </div>
          <div className="cart-list__cell">
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice}
              onChange={e => onUnitPriceChange(line.productId, e.target.value)}
            />
          </div>
          <div className="cart-list__cell">
            {formatMoney(lineTotal(line))}
          </div>
          <div className="cart-list__cell">
            <button
              type="button"
              aria-label="Eliminar"
              onClick={() => onRemove(line.productId)}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
