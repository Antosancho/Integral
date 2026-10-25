import { ArrowDown, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AlertTone = 'danger' | 'warning' | 'info' | 'success'

const ICONS: Record<AlertTone, LucideIcon> = {
  danger: TriangleAlert,
  warning: ArrowDown,
  info: Info,
  success: CircleCheck,
}

/**
 * Alerta inline, no bloqueante: informa pero nunca impide seguir operando.
 * `action` es un slot opcional para un botón (ej. "Filtrar").
 */
export function InlineAlert({
  tone,
  title,
  children,
  action,
}: {
  tone: AlertTone
  title?: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  const Icon = ICONS[tone]
  return (
    <div className={`ig-alert ig-alert-${tone}`} role="status">
      <Icon size={18} strokeWidth={2} aria-hidden="true" className="ig-icon" />
      <div className="ig-alert-body">
        {title && <strong>{title}</strong>}
        {children && <span>{children}</span>}
      </div>
      {action}
    </div>
  )
}
