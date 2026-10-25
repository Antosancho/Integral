import { CalendarX, Clock } from 'lucide-react'
import type { StockMovementFromApi } from '../../electron-api'
import { Badge } from '../../ui/Badge'
import { classifyExpiry } from '../../utils/expiry'
import { formatDate } from '../../utils/format'

type Props = {
  /** Lotes ya ordenados por sortLots/groupLotsByProduct antes de llegar al componente. */
  lots: StockMovementFromApi[]
  emptyText?: string
}

/**
 * Lista compacta para mostrar los lotes vivos de un producto sin hacer fetch propio.
 * Cada lote es un badge "N u. · DD/MM/AAAA": rojo si ya venció, azul si vence hoy, gris si no.
 */
export default function LotsList({ lots, emptyText = '—' }: Props) {
  if (lots.length === 0) {
    return <span className="ig-muted">{emptyText}</span>
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {lots.map((lot) => {
        const status = classifyExpiry(lot.expiryDate)
        const tone = status === 'expired' ? 'danger' : status === 'expiring_today' ? 'info' : 'neutral'
        const icon = status === 'expired' ? CalendarX : status === 'expiring_today' ? Clock : undefined
        return (
          <Badge key={lot.id} tone={tone} icon={icon}>
            {lot.quantity} u. · {lot.expiryDate ? formatDate(lot.expiryDate) : 'sin vencimiento'}
          </Badge>
        )
      })}
    </div>
  )
}
