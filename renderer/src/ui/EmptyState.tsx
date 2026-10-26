import type { LucideIcon } from 'lucide-react'

/**
 * Estado vacío o de error de una vista de datos: ícono, título, descripción y una acción opcional.
 * `tone="danger"` se usa para errores de carga.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  tone?: 'neutral' | 'danger'
}) {
  return (
    <div className="ig-empty">
      <div className="ico" style={tone === 'danger' ? { background: 'var(--danger-soft)', color: 'var(--danger)' } : undefined}>
        <Icon size={22} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-lg" />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
