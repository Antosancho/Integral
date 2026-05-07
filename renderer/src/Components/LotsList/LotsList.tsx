import type { StockMovementFromApi } from '../../electron-api'
import { classifyExpiry, formatExpiryInput } from '../../utils/expiry'
import './LotsList.css'

type Props = {
  /** Lotes ya ordenados por sortLots/groupLotsByProduct antes de llegar al componente. */
  lots: StockMovementFromApi[]
  emptyText?: string
}

function getItemClassName(lot: StockMovementFromApi): string {
  const status = classifyExpiry(lot.expiryDate)
  const classes = ['lots-list__item']

  if (status === 'expired') classes.push('lots-list__item--expired')
  if (status === 'expiring_today') classes.push('lots-list__item--today')

  return classes.join(' ')
}

/**
 * Lista compacta para mostrar los lotes vivos de un producto sin hacer fetch propio.
 */
export default function LotsList({ lots, emptyText = '—' }: Props) {
  if (lots.length === 0) {
    return <span className="lots-list__empty">{emptyText}</span>
  }

  return (
    <ul className="lots-list">
      {lots.map((lot) => (
        <li key={lot.id} className={getItemClassName(lot)}>
          <span className="lots-list__quantity">{lot.quantity} u.</span>
          <span className="lots-list__date">
            {' - '}
            {lot.expiryDate ? formatExpiryInput(lot.expiryDate) : 'sin vencimiento'}
          </span>
        </li>
      ))}
    </ul>
  )
}
