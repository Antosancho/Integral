import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatPct } from '../../utils/format'

type Props = {
  label: string
  icon: LucideIcon
  /** Valor ya formateado ($, cantidad…). */
  value: string
  /** Variación % contra el período anterior; null = no se puede calcular (el anterior fue 0). */
  deltaPct: number | null
  /** Con qué se compara: "vs. septiembre". */
  comparedTo: string
  /** Sin ventas en el período: muestra "—" y oculta la comparación. */
  empty?: boolean
}

/**
 * Tarjeta KPI de Estadísticas: valor grande y variación contra el período anterior.
 * La variación se distingue por ícono y signo, no solo por color (sube / baja / sin cambio).
 */
export default function StatCard({ label, icon: Icon, value, deltaPct, comparedTo, empty }: Props) {
  let delta: React.ReactNode = null
  if (!empty) {
    if (deltaPct === null) {
      delta = <span className="ig-help">Sin datos para comparar</span>
    } else {
      const kind = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat'
      const DeltaIcon = kind === 'up' ? TrendingUp : kind === 'down' ? TrendingDown : Minus
      delta = (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span className={`ig-delta ${kind}`}>
            <DeltaIcon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
            {formatPct(deltaPct)}
          </span>
          <span>{comparedTo}</span>
        </div>
      )
    }
  }

  return (
    <div className="ig-card ig-kpi">
      <span className="k">
        <Icon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
        {label}
      </span>
      <span className="v num">{empty ? '—' : value}</span>
      {delta}
    </div>
  )
}
