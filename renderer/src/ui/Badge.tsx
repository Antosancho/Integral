import type { LucideIcon } from 'lucide-react'

export type BadgeTone = 'neutral' | 'danger' | 'warning' | 'success' | 'info'

/**
 * Etiqueta de estado. El color nunca va solo: acompañar con texto (y, si aplica, ícono).
 */
export function Badge({
  tone,
  icon: Icon,
  children,
  title,
}: {
  tone: BadgeTone
  icon?: LucideIcon
  children: React.ReactNode
  title?: string
}) {
  return (
    <span className={`ig-badge ig-badge-${tone}`} title={title}>
      {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" className="ig-icon" />}
      {children}
    </span>
  )
}
