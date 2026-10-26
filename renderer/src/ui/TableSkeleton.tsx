/**
 * Skeleton de una tabla mientras carga. Combinar con `useDelayedFlag` para mostrarlo
 * solo si la carga tarda más de ~300 ms.
 */
export function TableSkeleton({ rows = 8, cols = 4, label = 'Cargando…' }: { rows?: number; cols?: number; label?: string }) {
  return (
    <div className="ig-card" style={{ padding: 20, display: 'grid', gap: 18 }} aria-busy="true">
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          data-testid="skeleton-row"
          style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}
        >
          {Array.from({ length: cols }, (_, c) => (
            <i key={c} className="ig-skel" />
          ))}
        </div>
      ))}
      <div className="ig-help" style={{ textAlign: 'center' }}>
        {label}
      </div>
    </div>
  )
}
