import { useEffect, useMemo, useRef, useState } from 'react'
import type { StockMovementFromApi } from '../../electron-api'
import { classifyExpiry, formatExpiryInput } from '../../utils/expiry'
import './ExpiryAlertWidget.css'

// ---------------------------------------------------------------------------
// Componente interno: fila del popup para un lote
// ---------------------------------------------------------------------------

interface RowProps {
  m: StockMovementFromApi
  onAlreadyRemoved: (id: number) => void
  onRemindLater: (id: number) => void
}

function Row({ m, onAlreadyRemoved, onRemindLater }: RowProps) {
  return (
    <div className="expiry-alert__row">
      <div className="expiry-alert__row-info">
        <span className="expiry-alert__row-name">{m.product.name}</span>
        <span className="expiry-alert__row-meta">
          Cantidad: {m.quantity} · Vence: {formatExpiryInput(m.expiryDate)}
        </span>
      </div>
      <div className="expiry-alert__row-actions">
        <button
          className="expiry-alert__btn-remove"
          onClick={() => onAlreadyRemoved(m.id)}
        >
          Ya lo saqué
        </button>
        <button
          className="expiry-alert__btn-remind"
          onClick={() => onRemindLater(m.id)}
        >
          Recordame luego
        </button>
      </div>
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
 */
export default function ExpiryAlertWidget() {
  const [items, setItems] = useState<StockMovementFromApi[]>([])
  const [sessionDismissed, setSessionDismissed] = useState<Set<number>>(new Set())
  const [popupOpen, setPopupOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wrapperRef = useRef<HTMLDivElement>(null)

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

  // Texto del botón: solo incluye segmentos con count > 0
  const label = useMemo(() => {
    const segments: string[] = []
    if (expired.length > 0) segments.push(`${expired.length} vencido${expired.length === 1 ? '' : 's'}`)
    if (today.length > 0) segments.push(`${today.length} vence${today.length === 1 ? '' : 'n'} hoy`)
    return `⚠ ${segments.join(' · ')}`
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

  // No renderizar si hay error de carga, si está cargando o si no hay items visibles
  if (loading || error || visible.length === 0) return null

  return (
    <div className="expiry-alert" ref={wrapperRef}>
      <button
        className="expiry-alert__trigger"
        onClick={() => setPopupOpen((v) => !v)}
        aria-label="Ver lotes vencidos"
      >
        {label}
      </button>

      {popupOpen && (
        <div className="expiry-alert__popup">
          {expired.length > 0 && (
            <section>
              <h4 className="expiry-alert__section-title expiry-alert__section-title--expired">
                Vencidos
              </h4>
              {expired.map((m) => (
                <Row
                  key={m.id}
                  m={m}
                  onAlreadyRemoved={handleAlreadyRemoved}
                  onRemindLater={handleRemindLater}
                />
              ))}
            </section>
          )}

          {today.length > 0 && (
            <section>
              <h4 className="expiry-alert__section-title expiry-alert__section-title--today">
                Vencen hoy
              </h4>
              {today.map((m) => (
                <Row
                  key={m.id}
                  m={m}
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
