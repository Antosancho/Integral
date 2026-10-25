import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type ToastTone = 'danger' | 'warning' | 'success' | 'info'
export type ToastOptions = { tone: ToastTone; title: string; detail?: string }

type ToastItem = ToastOptions & {
  id: number
  /** Identidad de contenido (tono|título|detalle): dos toasts con la misma key se fusionan. */
  key: string
  /** Cantidad de veces que se pidió este mismo toast mientras seguía visible. */
  count: number
  /** Se incrementa en cada repetición para reiniciar el timer de cierre. */
  version: number
}

/** Cantidad máxima de toasts visibles a la vez; los más viejos se descartan. */
const MAX_TOASTS = 3
/** Duración de un toast sin detalle (ms). */
const DURATION_MS = 4000
/** Duración de un toast con detalle (ms): hay más para leer. */
const DURATION_WITH_DETAIL_MS = 6000

const ICONS: Record<ToastTone, LucideIcon> = {
  danger: CircleAlert,
  warning: TriangleAlert,
  success: CircleCheck,
  info: Info,
}

type ToastContextValue = { show: (opts: ToastOptions) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Un toast individual. Maneja su propio timer de cierre:
 *  - arranca al montarse y se reinicia cuando cambia `version` (el mismo toast se repitió);
 *  - el hover lo pausa (al salir arranca de nuevo completo).
 * Nunca toma el foco: es informativo (`role="status"`).
 */
function ToastView({ toast, onExpire }: { toast: ToastItem; onExpire: (id: number) => void }) {
  const [paused, setPaused] = useState(false)
  const Icon = ICONS[toast.tone]
  const duration = toast.detail ? DURATION_WITH_DETAIL_MS : DURATION_MS

  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => onExpire(toast.id), duration)
    return () => clearTimeout(t)
  }, [toast.id, toast.version, duration, paused, onExpire])

  return (
    <div
      className={`ig-toast ${toast.tone}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="tone">
        <Icon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
      </span>
      <div>
        {toast.title}
        {toast.detail && <small>{toast.detail}</small>}
      </div>
      {toast.count > 1 && <span className="count">×{toast.count}</span>}
    </div>
  )
}

/**
 * Provee `useToast()` y renderiza la pila de toasts (arriba a la derecha).
 * Reglas: máx. 3, el más nuevo arriba, repetidos se fusionan con contador `×n`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback((opts: ToastOptions) => {
    const key = `${opts.tone}|${opts.title}|${opts.detail ?? ''}`
    setToasts((prev) => {
      const existing = prev.find((t) => t.key === key)
      if (existing) {
        // Se sube arriba, suma al contador y reinicia el timer (nueva `version`).
        const bumped = { ...existing, count: existing.count + 1, version: existing.version + 1 }
        return [bumped, ...prev.filter((t) => t.key !== key)]
      }
      const created: ToastItem = { ...opts, id: nextId.current++, key, count: 1, version: 0 }
      return [created, ...prev].slice(0, MAX_TOASTS)
    })
  }, [])

  const expire = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ig-toast-stack">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onExpire={expire} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Acceso a los toasts. Lanza si se usa fuera de `ToastProvider`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast fuera de ToastProvider')
  return ctx
}
