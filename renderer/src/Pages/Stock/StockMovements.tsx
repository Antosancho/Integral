import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, History, RotateCcw, Search } from 'lucide-react'
import type { StockMovementFromApi } from '../../electron-api'
import type { Navigate } from '../../navigation'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { DateField } from '../../ui/DateField'
import { EmptyState } from '../../ui/EmptyState'
import { Field } from '../../ui/Field'
import { Segmented } from '../../ui/Segmented'
import { TableSkeleton } from '../../ui/TableSkeleton'
import { useDelayedFlag } from '../../ui/useDelayedFlag'
import { formatDate, formatDayMonthTime, formatSignedInt } from '../../utils/format'
import { parseDateAR } from '../../utils/parse'
import { includesFolded } from '../../utils/text'
import { classifyMovement, lastSevenDays, matchesTypeFilter } from './movements'
import type { MovementTypeFilter } from './movements'

type Props = {
  /** Segmentado Productos | Movimientos que arma `StockPage`. */
  viewSwitcher: React.ReactNode
  navigate: Navigate
  /** Producto con el que se abre la vista (desde ⋮ o desde Estadísticas); filtra por `productId` en la API. */
  product: { id: number; name: string } | null
}

const TYPE_OPTIONS: { value: MovementTypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'sale', label: 'Ventas' },
  { value: 'restock', label: 'Reposiciones' },
  { value: 'shrink', label: 'Mermas' },
  { value: 'adjustment', label: 'Ajustes' },
]

/** Cantidad máxima de movimientos que se piden a la API. */
const TAKE = 500

/** Texto de la fecha de una caja de filtros: error solo si ya está completa ("DD/MM/AAAA") y no existe. */
function dateTextError(text: string): string | null {
  return text.length === 10 && parseDateAR(text) === null ? 'Revisá la fecha (DD/MM/AAAA).' : null
}

/**
 * Stock › Movimientos: historial de movimientos de stock filtrable por producto, tipo y período
 * (por defecto, los últimos 7 días). No muestra "stock resultante": la API no lo informa.
 */
export default function StockMovements({ viewSwitcher, navigate, product }: Props) {
  const initialRange = useMemo(() => lastSevenDays(), [])

  const [productText, setProductText] = useState(product?.name ?? '')
  /** Mientras no se tipea, el producto viene de la navegación y se filtra en la API; al tipear se descarta. */
  const [productId, setProductId] = useState<number | null>(product?.id ?? null)
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>('all')
  const [fromText, setFromText] = useState(formatDate(initialRange.from))
  const [toText, setToText] = useState(formatDate(initialRange.to))

  const [movements, setMovements] = useState<StockMovementFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Período válido: ambas fechas existen y desde <= hasta. Si no, no se recarga.
  const fromDay = parseDateAR(fromText)
  const toDay = parseDateAR(toText)
  const rangeValid = fromDay !== null && toDay !== null && fromDay.getTime() <= toDay.getTime()
  const fromKey = fromDay?.getTime() ?? null
  const toKey = toDay?.getTime() ?? null

  useEffect(() => {
    if (fromKey === null || toKey === null || fromKey > toKey) return
    const from = new Date(fromKey)
    const toDayDate = new Date(toKey)
    const to = new Date(toDayDate.getFullYear(), toDayDate.getMonth(), toDayDate.getDate(), 23, 59, 59, 999)

    let cancelled = false
    setLoading(true)
    setError(false)
    const timer = setTimeout(async () => {
      try {
        const data = await window.api.listStockMovements({
          fromDate: from,
          toDate: to,
          ...(productId !== null ? { productId } : {}),
          take: TAKE,
        })
        if (!cancelled) setMovements(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fromKey, toKey, productId, reloadKey])

  const visible = useMemo(
    () =>
      movements.filter((m) => {
        if (!matchesTypeFilter(classifyMovement(m), typeFilter)) return false
        // Con el producto fijado por navegación la API ya filtró; si se tipea, se filtra acá.
        if (productId === null) {
          const q = productText.trim()
          if (q !== '') {
            const byName = includesFolded(m.product.name, q)
            const byBarcode = m.product.barcode !== null && m.product.barcode.toString().includes(q)
            if (!byName && !byBarcode) return false
          }
        }
        return true
      }),
    [movements, typeFilter, productId, productText],
  )

  const showSkeleton = useDelayedFlag(loading)
  const toError = dateTextError(toText) ?? (fromDay && toDay && !rangeValid ? 'Tiene que ser posterior a la inicial.' : null)

  return (
    <main className="ig-page">
      <div className="ig-page-head">
        <h1>Stock</h1>
        {viewSwitcher}
      </div>

      <div className="ig-filters">
        <Field label="Producto" htmlFor="mv-product">
          <div className="ig-input-wrap" style={{ width: 260 }}>
            <Search className="ig-icon" size={18} aria-hidden="true" />
            <input
              id="mv-product"
              className="ig-input"
              placeholder="Nombre o código"
              value={productText}
              onChange={(e) => {
                setProductText(e.target.value)
                setProductId(null)
              }}
            />
          </div>
        </Field>

        <div className="ig-field">
          <span className="ig-label">Tipo</span>
          <Segmented<MovementTypeFilter> ariaLabel="Tipo de movimiento" options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
        </div>

        <DateField id="mv-from" label="Desde" value={fromText} onChange={setFromText} error={dateTextError(fromText)} />
        <DateField id="mv-to" label="Hasta" value={toText} onChange={setToText} error={toError} />
      </div>

      {showSkeleton && movements.length === 0 && <TableSkeleton rows={8} cols={5} label="Cargando movimientos…" />}

      {error && (
        <div className="ig-card">
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="No pudimos leer los movimientos"
            description="Revisá que la base de datos esté disponible y probá de nuevo."
            action={
              <Button icon={RotateCcw} onClick={() => setReloadKey((k) => k + 1)}>
                Reintentar
              </Button>
            }
          />
        </div>
      )}

      {!error && !loading && visible.length === 0 && (
        <div className="ig-card">
          <EmptyState
            icon={History}
            title="Todavía no hay movimientos"
            description="Cambiá el período o el producto para ver otros movimientos."
          />
        </div>
      )}

      {!error && visible.length > 0 && (
        <div className="ig-table-wrap" style={{ flex: 1, overflow: 'auto' }}>
          <table className="ig-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Producto</th>
                <th className="r">Cantidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => {
                const info = classifyMovement(m)
                const quantityColor =
                  info.kind === 'shrink'
                    ? 'var(--warning)'
                    : info.delta !== null && info.delta > 0
                      ? 'var(--success)'
                      : 'var(--ink)'
                const details: React.ReactNode[] = []
                if (m.saleId !== null && info.kind === 'sale') {
                  details.push(
                    <button
                      key="sale"
                      type="button"
                      className="ig-link"
                      onClick={() => navigate({ section: 'sells', salesView: 'history', historySaleId: m.saleId })}
                    >
                      Venta #{m.saleId}
                    </button>,
                  )
                } else if (m.notes) {
                  details.push(<span key="notes">{m.notes}</span>)
                }
                if (m.expiryDate) details.push(<span key="expiry">Lote vence {formatDate(m.expiryDate)}</span>)

                return (
                  <tr key={m.id}>
                    <td>{formatDayMonthTime(m.date)}</td>
                    <td>
                      <Badge tone={info.tone}>{info.label}</Badge>
                    </td>
                    <td className="name">{m.product.name}</td>
                    <td className="r" style={{ color: quantityColor, fontWeight: info.kind === 'sale' ? 700 : undefined }}>
                      {info.delta === null ? <span className="ig-muted">ajuste a {m.quantity}</span> : formatSignedInt(info.delta)}
                    </td>
                    <td className="ig-muted">
                      {details.length === 0
                        ? '—'
                        : details.map((d, i) => (
                            <span key={i}>
                              {i > 0 && ' · '}
                              {d}
                            </span>
                          ))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
