import { useRef, useState } from 'react'
import { formatAmountInput } from '../../utils/format'
import { parseDecimal, parseInteger } from '../../utils/parse'

type Props = {
  /** `int`: cantidad (entero >= 1). `money`: precio (>= 0, formato es-AR). */
  kind: 'int' | 'money'
  /** Valor confirmado. Los precios llegan en formato máquina ("1450.5"). */
  value: string | number
  ariaLabel: string
  /** Precio distinto al de lista: se muestra en el color de "info". */
  modified?: boolean
  /** Solo se llama con un valor válido y distinto del actual. */
  onCommit: (n: number) => void
  /** ↑/↓ dentro de la celda: confirma y pide mover el foco a la misma celda de otra fila. */
  onNavigate?: (dir: -1 | 1) => void
  /** Enter/Esc: devolver el foco a la fila. */
  onExit?: () => void
  inputRef?: (el: HTMLInputElement | null) => void
}

/**
 * Celda editable del carrito (cantidad o precio unitario).
 *
 * Mientras se tipea se usa un borrador de texto que NO llega al carrito. Se confirma al salir (blur),
 * con Enter o con ↑/↓. Si el borrador es vacío, inválido o fuera de rango se descarta en silencio y
 * la celda vuelve al valor anterior: una fila nunca se elimina por un valor intermedio de edición.
 * Esc descarta el borrador.
 */
export default function EditableCell({ kind, value, ariaLabel, modified, onCommit, onNavigate, onExit, inputRef }: Props) {
  const [draft, setDraftState] = useState<string | null>(null)
  // El borrador también vive en un ref: los handlers de blur/teclado deben ver el valor más reciente
  // aunque el estado todavía no se haya re-renderizado (ej. Esc seguido del blur al mover el foco).
  const draftRef = useRef<string | null>(null)

  const setDraft = (v: string | null) => {
    draftRef.current = v
    setDraftState(v)
  }

  const display = kind === 'money' ? formatAmountInput(value) : String(value)

  /** Confirma el borrador si es válido y distinto del valor actual; en cualquier caso lo cierra. */
  function commit() {
    const raw = draftRef.current
    setDraft(null)
    if (raw === null) return

    const n = kind === 'int' ? parseInteger(raw) : parseDecimal(raw)
    if (n === null) return
    if (kind === 'int' ? n < 1 : n < 0) return
    if (Math.abs(n - Number(value)) < 1e-9) return
    onCommit(n)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      onExit?.()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setDraft(null)
      onExit?.()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      commit()
      onNavigate?.(e.key === 'ArrowUp' ? -1 : 1)
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={kind === 'int' ? 'numeric' : 'decimal'}
      aria-label={ariaLabel}
      className={['ig-cell-edit', draft !== null && 'is-editing', modified && 'is-modified'].filter(Boolean).join(' ')}
      value={draft ?? display}
      onFocus={(e) => {
        setDraft(display)
        e.currentTarget.select()
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  )
}
