import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'
import { ShortcutBar } from './ShortcutBar'
import type { ShortcutItem } from './ShortcutBar'
import { popModal, pushModal } from './modalStack'

/** Elementos que pueden recibir foco con Tab (para el focus trap). */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

type ModalProps = {
  open: boolean
  title: string
  subtitle?: React.ReactNode
  /** Ancho del diálogo. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Clase extra para el diálogo (`.ig-modal`), ej. un ancho propio de una pantalla. */
  className?: string
  onClose: () => void
  /** Qué hacer con Escape. Default: `onClose`. */
  onEscape?: () => void
  /** Si el click sobre el velo cierra el modal. Default `false` (los formularios no se cierran por accidente). */
  closeOnOverlay?: boolean
  /** Va entre el título y la X (ej. `ShortcutBar` "F2 cierra" o `StepIndicator`). */
  headerExtra?: React.ReactNode
  hideCloseButton?: boolean
  /** Pie, a la izquierda. */
  shortcuts?: ShortcutItem[]
  /** Pie, a la derecha (botones). */
  footer?: React.ReactNode
  /** Elemento que recibe el foco al abrir. Default: primer campo del cuerpo. */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}

/**
 * Diálogo modal accesible del design system.
 *
 * - Se renderiza en un portal sobre `document.body`.
 * - Al abrir: registra el modal en `modalStack`, enfoca el primer campo y recuerda el elemento
 *   que tenía el foco; al cerrar, se lo devuelve.
 * - Focus trap con Tab / Shift+Tab.
 * - Escape llama a `onEscape ?? onClose` con `stopPropagation`: los eventos de React atraviesan
 *   portales, y sin eso un modal anidado también cerraría al de afuera.
 */
export function Modal({
  open,
  title,
  subtitle,
  size = 'md',
  className,
  onClose,
  onEscape,
  closeOnOverlay = false,
  headerExtra,
  hideCloseButton,
  shortcuts,
  footer,
  initialFocusRef,
  children,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    pushModal()
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    // El foco se mueve en el siguiente tick: el contenido ya está montado y los hijos pueden
    // haber registrado su `initialFocusRef`.
    const timer = setTimeout(() => {
      const dialog = dialogRef.current
      if (!dialog) return
      const firstInBody = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).find((el) =>
        el.closest('.ig-modal-body'),
      )
      const target = initialFocusRef?.current ?? firstInBody ?? dialog
      target.focus()
    }, 0)

    return () => {
      clearTimeout(timer)
      popModal()
      const el = returnFocus.current
      if (el && document.contains(el)) el.focus()
    }
    // Solo depende de `open`: cambiar `initialFocusRef` o `onClose` no debe reiniciar el ciclo de foco.
  }, [open])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault()
      e.stopPropagation()
      ;(onEscape ?? onClose)()
      return
    }
    if (e.key === 'Tab') {
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const sizeClass = size === 'sm' ? 'ig-modal-sm' : size === 'lg' ? 'ig-modal-lg' : ''

  return createPortal(
    <div
      className="ig-overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={['ig-modal', sizeClass, className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="ig-modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
            {headerExtra}
          </div>
          {!hideCloseButton && (
            <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Cerrar" onClick={onClose} />
          )}
        </div>
        <div className="ig-modal-body">{children}</div>
        {(shortcuts || footer) && (
          <div className="ig-modal-foot">
            {shortcuts && <ShortcutBar items={shortcuts} />}
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
