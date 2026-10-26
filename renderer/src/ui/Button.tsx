import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Kbd } from './Kbd'

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Jerarquía visual. Un solo `primary` por vista. Default `secondary`. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'edit' | 'danger'
  /** Tamaño. Default `md`. */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Ícono lucide a la izquierda del texto. */
  icon?: LucideIcon
  /** Botón cuadrado solo con ícono. Exige `aria-label`. */
  iconOnly?: boolean
  /** Atajo de teclado que se muestra como `Kbd` a la derecha (no forma parte del nombre accesible). */
  shortcut?: string
  children?: React.ReactNode
}

/** Tamaño en píxeles del ícono según el tamaño del botón. */
function iconSize(size: NonNullable<ButtonProps['size']>): number {
  if (size === 'sm') return 16
  if (size === 'xl') return 22
  return 18
}

/**
 * Botón del design system. `type="button"` por defecto para que nunca envíe un formulario sin querer.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, iconOnly, shortcut, className, type = 'button', children, ...rest },
  ref,
) {
  const classes = [
    'ig-btn',
    `ig-btn-${variant}`,
    size !== 'md' ? `ig-btn-${size}` : '',
    iconOnly ? 'ig-btn-icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {Icon && <Icon size={iconSize(size)} strokeWidth={2} aria-hidden="true" className="ig-icon" />}
      {children}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </button>
  )
})
