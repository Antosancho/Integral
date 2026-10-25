import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'
import type { StockMovementFromApi } from '../../electron-api'
import { Button } from '../../ui/Button'
import { formatDate, formatDayMonth } from '../../utils/format'
import { classifyExpiry } from '../../utils/expiry'

// ---------------------------------------------------------------------------
// Componente interno: fila del popup para un lote
// ---------------------------------------------------------------------------

interface RowProps {
  m: StockMovementFromApi
  /** 'expired' → "Venció el…"; 'expiring_today' → "Vence hoy…". */
  status: 'expired' | 'expiring_today'
  onAlreadyRemoved: (id: number) => void
  onRemindLater: (id: number) => void
}

function Row({ m, status, onAlreadyRemoved, onRemindLater }: RowProps) {
  const detail =
    status === 'expired' && m.expiryDate
      ? `Venció el ${formatDate(m.expiryDate)} · lote cargado el ${formatDayMonth(m.date)} · ${m.quantity} u.`
      : `Vence hoy · ${m.quantity} u.`

  return (
    <div className="ig-expiry-row">
      <div className="what">
        <strong>{m.product.name}</strong>
        <span>{detail}</span>
      </div>
      <Button size="sm" variant="secondary" onClick={() => onRemindLater(m.id)}>
        Recordame luego
      </Button>
      <Button size="sm" variant="primary" icon={Check} onClick={() => onAlreadyRemoved(m.id)}>
        Ya lo saqué
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal: widget autónomo montado en el Header
// ---------------------------------------------------------------------------

/**
 * Muestra en el header una alerta consolidada de lotes vencidos / que vencen hoy.
 * - Al montar, carga los datos con window.api.listExpiringStockMovements.
 * - "Ya lo saqué" persiste el descarte (expiryDismissedAt) — no reaparece al recargar.
 * - "Recordame luego" descarta solo en sesión (estado local) — vuelve al recargar.
 * - Si no hay lotes visibles, el componente retorna null (no renderiza nada).
 *
 * Es blanco con borde rojo en ambos temas (tokens `expiry-*`). Esc cierra el popup.
 */
export default function ExpiryAlertWidget() {
  const [items, setItems] = useState<StockMovementFromApi[]>([])
  const [sessionDismissed, setSessionDismissed] = useState<Set<number>>(new Set())
  const [popupOpen, setPopupOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Cargar lotes al montar el componente
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await window.api.listExpiringStockMovements()
        if (!cancelled) setItems(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar vencimientos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Cerrar popup al hacer click fuera del wrapper
  useEffect(() => {
    if (!popupOpen) return

    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPopupOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [popupOpen])

  // Lotes visibles: excluye los descartados en sesión
  const visible = useMemo(
    () => items.filter((m) => !sessionDismissed.has(m.id)),
    [items, sessionDismissed]
  )

  // Clasificación por estado de vencimiento
  const expired = useMemo(
    () => visible.filter((m) => classifyExpiry(m.expiryDate) === 'expired'),
    [visible]
  )
  const today = useMemo(
    () => visible.filter((m) => classifyExpiry(m.expiryDate) === 'expiring_today'),
    [visible]
  )

  // Segmentos del botón: solo los que tienen count > 0
  const segments = useMemo(() => {
    const out: string[] = []
    if (expired.length > 0) out.push(`${expired.length} vencido${expired.length === 1 ? '' : 's'}`)
    if (today.length > 0) out.push(`${today.length} vence${today.length === 1 ? '' : 'n'} hoy`)
    return out
  }, [expired.length, today.length])

  // Descarte permanente: persiste expiryDismissedAt en DB
  async function handleAlreadyRemoved(id: number) {
    try {
      await window.api.dismissStockMovementExpiry(id)
      setItems((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descartar')
    }
  }

  // Descarte de sesión: solo estado local, vuelve a aparecer al recargar
  function handleRemindLater(id: number) {
    setSessionDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function closePopup() {
    setPopupOpen(false)
    triggerRef.current?.focus()
  }

  // No renderizar si hay error de carga, si está cargando o si no hay items visibles
  if (loading || error || visible.length === 0) return null

  return (
    <div className="ig-anchor" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ig-expiry"
        aria-haspopup="dialog"
        aria-expanded={popupOpen}
        onClick={() => setPopupOpen((v) => !v)}
      >
        <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
        {segments.map((text, i) => (
          <Fragment key={text}>
            {i > 0 && (
              <>
                {' '}
                <span className="sep">·</span>{' '}
              </>
            )}
            {text}
          </Fragment>
        ))}
      </button>

      {popupOpen && (
        <div
          className="ig-expiry-pop"
          role="dialog"
          aria-label="Lotes a revisar"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              closePopup()
            }
          }}
        >
          <div className="ig-modal-head">
            <div>
              <h2>Lotes a revisar</h2>
              <p>Sacalos de la góndola o recordalos más tarde.</p>
            </div>
            <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Cerrar" onClick={closePopup} />
          </div>

          {expired.length > 0 && (
            <section>
              <div className="ig-expiry-group">Vencidos · {expired.length}</div>
              {expired.map((m) => (
                <Row
                  key={m.id}
                  m={m}
                  status="expired"
                  onAlreadyRemoved={handleAlreadyRemoved}
                  onRemindLater={handleRemindLater}
                />
              ))}
            </section>
          )}

          {today.length > 0 && (
            <section>
              <div className="ig-expiry-group">Vencen hoy · {today.length}</div>
              {today.map((m) => (
                <Row
                  key={m.id}
                  m={m}
                  status="expiring_today"
                  onAlreadyRemoved={handleAlreadyRemoved}
                  onRemindLater={handleRemindLater}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
