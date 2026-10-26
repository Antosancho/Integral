import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from './Button'

export type MenuItem = {
  id: string
  label: string
  icon?: LucideIcon
  /** Muestra una tilde (para menús de selección, ej. filtro de categoría). */
  checked?: boolean
  onSelect: () => void
}

type MenuButtonProps = {
  /** Nombre accesible del botón (obligatorio si `iconOnly`). */
  label: string
  items: MenuItem[]
  iconOnly?: boolean
  icon?: LucideIcon
  variant?: 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  /** Hacia qué lado se abre el menú respecto del botón. Default `left`. */
  align?: 'left' | 'right'
  /** Texto visible del botón cuando no es `iconOnly`. Default: `label`. */
  buttonText?: React.ReactNode
}

/**
 * Botón que abre un menú desplegable (menú ⋮ de las filas, filtro de categoría).
 *
 * Teclado: abre con click/Enter/Espacio/↓ y enfoca el primer ítem; ↑/↓/Home/End mueven entre
 * ítems; Enter ejecuta; Esc cierra y devuelve el foco al botón; Tab cierra. Click afuera cierra.
 */
export function MenuButton({
  label,
  items,
  iconOnly,
  icon,
  variant = 'secondary',
  size = 'md',
  align = 'left',
  buttonText,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Al abrir, el foco va al primer ítem.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  // Click afuera cierra.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  const select = (item: MenuItem) => {
    // El foco vuelve al botón antes de ejecutar la acción: si abre un modal, éste lo recuerda
    // como disparador y se lo devuelve al cerrarse.
    close(true)
    item.onSelect()
  }

  const focusItem = (index: number) => {
    const n = items.length
    itemRefs.current[((index % n) + n) % n]?.focus()
  }

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusItem(current + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusItem(current < 0 ? items.length - 1 : current - 1)
        break
      case 'Home':
        e.preventDefault()
        focusItem(0)
        break
      case 'End':
        e.preventDefault()
        focusItem(items.length - 1)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <div ref={wrapperRef} className={`ig-anchor ${align === 'right' ? 'ig-anchor-right' : ''}`.trim()}>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        icon={icon}
        iconOnly={iconOnly}
        aria-label={iconOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        {iconOnly ? undefined : (buttonText ?? label)}
      </Button>
      {open && (
        <ul className="ig-menu" role="menu" aria-label={label} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => {
            const ItemIcon = item.icon
            return (
              <li key={item.id} role="none">
                <button
                  ref={(el) => {
                    itemRefs.current[i] = el
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation()
                    select(item)
                  }}
                >
                  {ItemIcon && <ItemIcon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />}
                  {item.label}
                  {item.checked && (
                    <Check size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" style={{ marginLeft: 'auto' }} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
