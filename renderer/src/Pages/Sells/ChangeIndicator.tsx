import { CircleAlert, Equal, HandCoins } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatMoney } from '../../utils/format'
import { changeState } from './payments'
import type { ChangeState } from './payments'

const VIEW: Record<ChangeState['kind'], { cls: string; label: string; icon: LucideIcon }> = {
  due: { cls: 'is-due', label: 'Falta cubrir', icon: CircleAlert },
  exact: { cls: 'is-exact', label: 'Pago exacto', icon: Equal },
  return: { cls: 'is-return', label: 'Vuelto', icon: HandCoins },
}

/**
 * Estado del cobro: "Falta cubrir" / "Pago exacto" / "Vuelto". Los tres se distinguen por palabra
 * e ícono, no solo por color.
 *
 * El bloque visible no es una región `aria-live` (cambiaría con cada tecla); aparte hay un texto solo
 * para lectores de pantalla con la etiqueta, que se anuncia únicamente al cambiar de categoría.
 */
export default function ChangeIndicator({ paid, total }: { paid: number; total: number }) {
  const state = changeState(paid, total)
  const { cls, label, icon: Icon } = VIEW[state.kind]
  return (
    <>
      <div className={`ig-change ${cls}`}>
        <span className="k">
          <Icon size={18} strokeWidth={2} aria-hidden="true" className="ig-icon" />
          {label}
        </span>
        <span className="v num">{formatMoney(state.amount)}</span>
      </div>
      <span className="ig-sr" aria-live="polite">
        {label}
      </span>
    </>
  )
}
