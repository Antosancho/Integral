import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, CircleAlert, Receipt, RotateCcw, Search } from 'lucide-react'
import type { SaleFromApi } from '../../electron-api'
import { Button } from '../../ui/Button'
import { DateField } from '../../ui/DateField'
import { EmptyState } from '../../ui/EmptyState'
import { Field } from '../../ui/Field'
import { TableSkeleton } from '../../ui/TableSkeleton'
import { useDelayedFlag } from '../../ui/useDelayedFlag'
import { useRowNavigation } from '../../ui/useRowNavigation'
import { formatDate, formatDayMonthTime, formatMoney } from '../../utils/format'
import { parseDateAR } from '../../utils/parse'
import CajaSummary from './CajaSummary'
import SaleDetailCard from './SaleDetailCard'
import {
  buildApiFilters,
  defaultFilters,
  filterSalesClientSide,
  formatMethods,
  hasActiveFilters,
  lastSevenDaysFilters,
  type SalesHistoryFilters,
  type SalesMethodFilter
} from './salesHistoryFilters'

type Props = {
  /** Segmentado Nueva venta | Historial que arma `SalesPage`. */
  viewSwitcher: React.ReactNode
  /** Venta a seleccionar al abrir (desde Stock › Movimientos); null = la primera de la lista. */
  initialSaleId: number | null
}

const METHOD_OPTIONS: { value: SalesMethodFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'CREDIT', label: 'Crédito' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otros' },
  { value: 'MIXED', label: 'Combinado' }
]

/** "1 venta" / "3 ventas". */
const salesLabel = (n: number): string => `${n} ${n === 1 ? 'venta' : 'ventas'}`

/** Período legible para el resumen: "24/10/2026", "18/10/2026 – 24/10/2026" o "todas las fechas". */
function rangeLabel(f: SalesHistoryFilters): string {
  if (f.fromDate === '' && f.toDate === '') return 'todas las fechas'
  if (f.fromDate === f.toDate) return f.fromDate
  return `${f.fromDate || '…'} – ${f.toDate || '…'}`
}

/** true si un campo de fecha tiene texto pero todavía no es una fecha válida (se está tipeando). */
const dateIsPending = (text: string): boolean => text !== '' && parseDateAR(text) === null

/**
 * Ventas › Historial: filtros que se aplican solos, lista de ventas a la izquierda y, a la derecha,
 * el detalle de la venta elegida más el resumen de caja del período.
 *
 * La tabla es un único tab-stop: ↑/↓ cambian la venta seleccionada y el detalle se actualiza.
 */
export default function SalesHistory({ viewSwitcher, initialSaleId }: Props) {
  const [filters, setFilters] = useState<SalesHistoryFilters>(() => defaultFilters())
  const [sales, setSales] = useState<SaleFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(initialSaleId)
  const [showMore, setShowMore] = useState(false)
  /** Hasta resolver la venta inicial no se carga la lista (así se evita pedir un período que se va a cambiar). */
  const [ready, setReady] = useState(initialSaleId === null)

  const update = (patch: Partial<SalesHistoryFilters>) => setFilters((f) => ({ ...f, ...patch }))

  // Venta inicial: el período pasa al día de esa venta y queda seleccionada.
  useEffect(() => {
    if (initialSaleId === null) return
    let cancelled = false
    ;(async () => {
      try {
        const sale = await window.api.getSaleById(initialSaleId)
        if (cancelled) return
        if (sale) {
          const day = formatDate(new Date(sale.date))
          setFilters((f) => ({ ...f, fromDate: day, toDate: day }))
          setSelectedId(sale.id)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialSaleId])

  // Los filtros de la API se aplican al instante, con debounce de 250 ms.
  const { fromDate, toDate, method, minTotal, maxTotal } = filters
  const pending = dateIsPending(fromDate) || dateIsPending(toDate)
  useEffect(() => {
    if (!ready || pending) return
    let cancelled = false
    setLoading(true)
    setError(false)
    const timer = setTimeout(async () => {
      try {
        const result = await window.api.listSales(buildApiFilters({ ...defaultFilters(), fromDate, toDate, method, minTotal, maxTotal }))
        if (!cancelled) setSales(result)
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
  }, [ready, pending, fromDate, toDate, method, minTotal, maxTotal, reloadKey])

  const visible = useMemo(() => filterSalesClientSide(sales, filters), [sales, filters])
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0] ?? null
  const periodTotal = visible.reduce((acc, s) => acc + Number(s.total), 0)

  const onGridKeyDown = useRowNavigation({
    keys: visible.map((s) => s.id),
    activeKey: selected?.id ?? null,
    setActiveKey: setSelectedId,
    rowDomId: (id) => `sale-row-${id}`
  })

  const showSkeleton = useDelayedFlag(loading && sales.length === 0)

  return (
    <main className="ig-page">
      <div className="ig-page-head">
        <h1>Ventas</h1>
        {viewSwitcher}
      </div>

      <div className="ig-filters">
        <DateField id="sh-from" label="Desde" value={fromDate} onChange={(v) => update({ fromDate: v })} />
        <DateField id="sh-to" label="Hasta" value={toDate} onChange={(v) => update({ toDate: v })} />
        <Field label="Producto" htmlFor="sh-product">
          <div className="ig-input-wrap" style={{ width: 260 }}>
            <Search className="ig-icon" size={18} aria-hidden="true" />
            <input
              id="sh-product"
              className="ig-input"
              placeholder="Nombre o código"
              value={filters.product}
              onChange={(e) => update({ product: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Medio de pago" htmlFor="sh-method">
          <select
            id="sh-method"
            className="ig-input"
            style={{ width: 200 }}
            value={filters.method}
            onChange={(e) => update({ method: e.target.value as SalesMethodFilter })}
          >
            {METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="ghost"
          icon={showMore ? ChevronUp : ChevronDown}
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          Más filtros
        </Button>
        {hasActiveFilters(filters) && (
          <Button variant="ghost" onClick={() => setFilters(defaultFilters())}>
            Limpiar filtros
          </Button>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div className="ig-help">
            {salesLabel(visible.length)} · {rangeLabel(filters)}
          </div>
          <div className="amount-lg num">{formatMoney(periodTotal)}</div>
        </div>
      </div>

      {showMore && (
        <div className="ig-filters">
          <Field label="Desde hora" htmlFor="sh-from-time">
            <input
              id="sh-from-time"
              type="time"
              className="ig-input"
              value={filters.fromTime}
              onChange={(e) => update({ fromTime: e.target.value })}
            />
          </Field>
          <Field label="Hasta hora" htmlFor="sh-to-time">
            <input
              id="sh-to-time"
              type="time"
              className="ig-input"
              value={filters.toTime}
              onChange={(e) => update({ toTime: e.target.value })}
            />
          </Field>
          <Field label="Monto mín." htmlFor="sh-min">
            <input
              id="sh-min"
              className="ig-input ig-input-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={filters.minTotal}
              onChange={(e) => update({ minTotal: e.target.value })}
            />
          </Field>
          <Field label="Monto máx." htmlFor="sh-max">
            <input
              id="sh-max"
              className="ig-input ig-input-amount"
              inputMode="decimal"
              placeholder="0,00"
              value={filters.maxTotal}
              onChange={(e) => update({ maxTotal: e.target.value })}
            />
          </Field>
        </div>
      )}

      {showSkeleton && <TableSkeleton rows={8} cols={5} label="Cargando ventas…" />}

      {error && (
        <div className="ig-card">
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="No pudimos leer las ventas"
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
            icon={Receipt}
            title="No hay ventas en este período"
            action={<Button onClick={() => setFilters(lastSevenDaysFilters())}>Ver últimos 7 días</Button>}
          />
        </div>
      )}

      {!error && visible.length > 0 && (
        <div className="ig-master-detail">
          <div
            className="ig-table-wrap ig-grid"
            tabIndex={0}
            role="grid"
            aria-label="Ventas"
            aria-activedescendant={selected ? `sale-row-${selected.id}` : undefined}
            onKeyDown={onGridKeyDown}
          >
            <table className="ig-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha y hora</th>
                  <th className="r">Ítems</th>
                  <th>Medio de pago</th>
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((sale) => (
                  // El teclado lo maneja el contenedor (role="grid"); la fila acepta click.
                  <tr
                    key={sale.id}
                    id={`sale-row-${sale.id}`}
                    className={selected?.id === sale.id ? 'is-selected' : undefined}
                    aria-selected={selected?.id === sale.id}
                    onClick={() => setSelectedId(sale.id)}
                  >
                    <td className="code">#{sale.id}</td>
                    <td>{formatDayMonthTime(new Date(sale.date))}</td>
                    <td className="r">{sale.items.reduce((acc, i) => acc + i.quantity, 0)}</td>
                    <td>{formatMethods(sale.payments)}</td>
                    <td className="r name">{formatMoney(Number(sale.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            {selected && <SaleDetailCard sale={selected} />}
            <CajaSummary sales={visible} />
          </div>
        </div>
      )}
    </main>
  )
}
