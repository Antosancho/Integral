import { useEffect, useMemo, useState } from 'react'
import { Banknote, Calendar, ChartColumn, CircleAlert, PiggyBank, Receipt, RotateCcw, ShoppingBasket } from 'lucide-react'
import type {
  LowRotationFromApi,
  SalesByPeriodFromApi,
  StatsSummaryFromApi,
  TopProductFromApi
} from '../../electron-api'
import type { Navigate } from '../../navigation'
import { Button } from '../../ui/Button'
import { DateField } from '../../ui/DateField'
import { EmptyState } from '../../ui/EmptyState'
import { InlineAlert } from '../../ui/InlineAlert'
import { Segmented } from '../../ui/Segmented'
import { TableSkeleton } from '../../ui/TableSkeleton'
import { useDelayedFlag } from '../../ui/useDelayedFlag'
import { formatDate, formatInt, formatMoney } from '../../utils/format'
import { parseDateAR } from '../../utils/parse'
import HourFilterBar from './HourFilterBar'
import {
  MAX_FILTERED_DAYS,
  countDays,
  getBusinessToday,
  orderHourRows,
  resolveHourFilter,
  toStatsInput,
  type HourFilterMode,
  type TimeWindow
} from './hourFilter'
import RankingList from './RankingList'
import StatCard from './StatCard'
import { loadWorkday, saveWorkday } from './workdayStorage'
import {
  HOUR_LABEL,
  WEEKDAY_LABELS,
  calcPctChange,
  comparedToLabel,
  formatRange,
  getEndOfDay,
  getPeriodDatesAt,
  getPreviousPeriod,
  getStartOfDay,
  peakIndex,
  type DateRange,
  type PeriodPreset
} from './statsUtils'

type Props = {
  navigate: Navigate
}

/** Cantidad de productos en cada ranking y en "menor rotación". */
const TOP_LIMIT = 5
const LOW_LIMIT = 10
/** Filas visibles de "menor rotación" antes de expandir. */
const LOW_COLLAPSED = 5

const PERIOD_OPTIONS: { value: PeriodPreset; label: string; icon?: typeof Calendar }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'custom', label: 'Personalizado', icon: Calendar }
]

/**
 * Estadísticas: período (Hoy / Esta semana / Este mes / Personalizado) + filtro horario (Todo el día /
 * Jornada laboral / Personalizado), 4 KPIs con comparación contra el período anterior (con la misma franja),
 * rankings de productos, ventas por franja y productos de menor rotación.
 *
 * Con franja, se arma un intervalo [from, to) por día del período (`hourFilter.ts`) y se manda en
 * `intervals`; sin franja el payload es `{ from, to }` como siempre. Las 7 consultas se hacen en paralelo
 * (`Promise.all`); la comparación llama a `getSalesSummary` dos veces (período actual y anterior).
 * Click en un producto abre Stock › Movimientos filtrado por ese producto.
 */
export default function Stats({ navigate }: Props) {
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // ── Filtro horario ──────────────────────────────────────────────────────
  // El modo no se recuerda (arranca en "Todo el día"); la jornada sí (localStorage).
  const [hourMode, setHourMode] = useState<HourFilterMode>('all')
  const [workday, setWorkday] = useState<TimeWindow>(() => loadWorkday())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [summary, setSummary] = useState<StatsSummaryFromApi | null>(null)
  const [prevSummary, setPrevSummary] = useState<StatsSummaryFromApi | null>(null)
  const [topByQty, setTopByQty] = useState<TopProductFromApi[]>([])
  const [topByRev, setTopByRev] = useState<TopProductFromApi[]>([])
  const [byHour, setByHour] = useState<SalesByPeriodFromApi[]>([])
  const [byWeekday, setByWeekday] = useState<SalesByPeriodFromApi[]>([])
  const [lowRot, setLowRot] = useState<LowRotationFromApi[]>([])

  const [temporalTab, setTemporalTab] = useState<'hour' | 'weekday'>('hour')
  const [showAllLow, setShowAllLow] = useState(false)

  const hourState = resolveHourFilter(hourMode, workday, customStart, customEnd)
  const currentWindow: TimeWindow | null = hourState.kind === 'window' ? hourState.window : null
  // Primitivos para las dependencias de los useMemo: un objeto nuevo en cada render dispararía recargas.
  const winStart = currentWindow ? currentWindow.startMinute : null
  const winEnd = currentWindow ? currentWindow.endMinute : null
  const hourReady = hourState.kind !== 'incomplete'

  // Rango actual (días ancla). Con franja, Hoy / Esta semana / Este mes se anclan al día comercial en curso.
  // Para "Personalizado" solo existe si ambas fechas son válidas y desde <= hasta.
  // Con "Personalizado" (horario) incompleto no hay rango: no se consulta.
  const range = useMemo<DateRange | null>(() => {
    if (!hourReady) return null
    const w = winStart !== null && winEnd !== null ? { startMinute: winStart, endMinute: winEnd } : null
    if (preset !== 'custom') return getPeriodDatesAt(preset, getBusinessToday(new Date(), w))
    const from = parseDateAR(customFrom)
    const to = parseDateAR(customTo)
    if (!from || !to || from.getTime() > to.getTime()) return null
    return { from: getStartOfDay(from), to: getEndOfDay(to) }
  }, [preset, customFrom, customTo, hourReady, winStart, winEnd])

  const prevRange = useMemo(() => (range ? getPreviousPeriod(range, preset) : null), [range, preset])

  // Con franja, un período de más de MAX_FILTERED_DAYS días no se consulta (se avisa).
  const tooLong = winStart !== null && range !== null && countDays(range) > MAX_FILTERED_DAYS

  // Payloads de las 7 consultas. Sin franja: { from, to } como siempre; con franja: + intervals,
  // y el período anterior usa la MISMA franja.
  const query = useMemo(() => {
    if (!range || !prevRange || tooLong) return null
    const w = winStart !== null && winEnd !== null ? { startMinute: winStart, endMinute: winEnd } : null
    return { window: w, input: toStatsInput(range, w), prevInput: toStatsInput(prevRange, w) }
  }, [range, prevRange, tooLong, winStart, winEnd])

  useEffect(() => {
    if (!query) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(false)
      try {
        const { input, prevInput } = query
        const [cur, prv, qty, rev, hour, wday, low] = await Promise.all([
          window.api.getSalesSummary(input),
          window.api.getSalesSummary(prevInput),
          window.api.getTopProductsByQuantity({ ...input, limit: TOP_LIMIT }),
          window.api.getTopProductsByRevenue({ ...input, limit: TOP_LIMIT }),
          window.api.getSalesByHour(input),
          window.api.getSalesByWeekday(input),
          window.api.getLowRotationProducts({ ...input, limit: LOW_LIMIT })
        ])
        if (cancelled) return
        setSummary(cur)
        setPrevSummary(prv)
        setTopByQty(qty)
        setTopByRev(rev)
        setByHour(orderHourRows(hour, query.window))
        setByWeekday(wday)
        setLowRot(low)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [query, reloadKey])

  const showSkeleton = useDelayedFlag(loading)

  const openMovements = (id: number, name: string) =>
    navigate({ section: 'stock', stockView: 'movements', movementsProduct: { id, name } })

  const changeWorkday = (w: TimeWindow) => {
    saveWorkday(w)
    setWorkday(w)
  }

  const fillLastSevenDays = () => {
    const today = getBusinessToday(new Date(), currentWindow)
    setCustomFrom(formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)))
    setCustomTo(formatDate(today))
  }
  const fillLastMonth = () => {
    const today = getBusinessToday(new Date(), currentWindow)
    setCustomFrom(formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)))
    setCustomTo(formatDate(new Date(today.getFullYear(), today.getMonth(), 0)))
  }

  // ── Derivados de presentación ────────────────────────────────────────────
  const comparedTo = prevRange ? comparedToLabel(preset, prevRange) : ''
  const temporalRows = temporalTab === 'hour' ? byHour : byWeekday
  const temporalMax = Math.max(...temporalRows.map((r) => r.saleCount), 0)
  const peak = peakIndex(temporalRows)
  const lowVisible = showAllLow ? lowRot : lowRot.slice(0, LOW_COLLAPSED)
  const noSales = summary !== null && summary.saleCount === 0

  const delta = (cur: string, prev: string) => calcPctChange(parseFloat(cur), parseFloat(prev))

  const hasData = !loading && !error && summary !== null && prevSummary !== null

  return (
    <main className="ig-page">
      <div className="ig-page-head">
        <h1>Estadísticas</h1>
        <div className="ig-spacer" />
        {range && prevRange && (
          <span className="ig-help">
            {formatRange(range)} · comparado con {formatRange(prevRange)}
          </span>
        )}
        <Segmented<PeriodPreset> ariaLabel="Período" options={PERIOD_OPTIONS} value={preset} onChange={setPreset} />
      </div>

      {preset === 'custom' && (
        <div className="ig-filters">
          <DateField id="stats-from" label="Desde" value={customFrom} onChange={setCustomFrom} />
          <DateField id="stats-to" label="Hasta" value={customTo} onChange={setCustomTo} />
          <Button size="sm" variant="ghost" onClick={fillLastSevenDays}>
            Últimos 7 días
          </Button>
          <Button size="sm" variant="ghost" onClick={fillLastMonth}>
            Mes pasado
          </Button>
        </div>
      )}

      <HourFilterBar
        mode={hourMode}
        onModeChange={setHourMode}
        workday={workday}
        onWorkdayChange={changeWorkday}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      {tooLong && (
        <InlineAlert tone="info">
          {`Con un filtro horario el período puede tener hasta ${MAX_FILTERED_DAYS} días. Acortá las fechas o elegí «Todo el día».`}
        </InlineAlert>
      )}

      {error && (
        <div className="ig-card">
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="No pudimos calcular las estadísticas"
            description="Revisá que la base de datos esté disponible y probá de nuevo."
            action={
              <Button icon={RotateCcw} onClick={() => setReloadKey((k) => k + 1)}>
                Reintentar
              </Button>
            }
          />
        </div>
      )}

      {!error && loading && showSkeleton && (
        <>
          <div className="ig-kpi-grid">
            {[0, 1, 2, 3].map((i) => (
              <TableSkeleton key={i} rows={2} cols={1} label="Calculando…" />
            ))}
          </div>
          <div className="ig-grid-2">
            {[0, 1, 2, 3].map((i) => (
              <TableSkeleton key={i} rows={5} cols={3} label="Calculando…" />
            ))}
          </div>
        </>
      )}

      {hasData && summary && prevSummary && (
        <>
          <div className="ig-kpi-grid">
            <StatCard
              label="Ventas totales"
              icon={Banknote}
              value={formatMoney(summary.totalRevenue)}
              deltaPct={delta(summary.totalRevenue, prevSummary.totalRevenue)}
              comparedTo={comparedTo}
              empty={noSales}
            />
            <StatCard
              label="Cantidad de ventas"
              icon={Receipt}
              value={formatInt(summary.saleCount)}
              deltaPct={calcPctChange(summary.saleCount, prevSummary.saleCount)}
              comparedTo={comparedTo}
              empty={noSales}
            />
            <StatCard
              label="Ticket promedio"
              icon={ShoppingBasket}
              value={formatMoney(summary.averageTicket)}
              deltaPct={delta(summary.averageTicket, prevSummary.averageTicket)}
              comparedTo={comparedTo}
              empty={noSales}
            />
            <StatCard
              label="Ganancia total"
              icon={PiggyBank}
              value={formatMoney(summary.totalProfit)}
              deltaPct={delta(summary.totalProfit, prevSummary.totalProfit)}
              comparedTo={comparedTo}
              empty={noSales}
            />
          </div>

          <div className="ig-grid-2">
            <section className="ig-card">
              <div className="ig-card-head">
                <h3>Productos más vendidos</h3>
                <span className="ig-help">top 5 · unidades</span>
              </div>
              <div className="ig-card-body">
                <RankingList
                  items={topByQty.map((p) => ({ id: p.productId, name: p.productName, value: Number(p.value) }))}
                  format={(v) => `${formatInt(v)} u.`}
                  onSelect={openMovements}
                />
              </div>
            </section>

            <section className="ig-card">
              <div className="ig-card-head">
                <h3>Productos que más facturan</h3>
                <span className="ig-help">top 5 · monto</span>
              </div>
              <div className="ig-card-body">
                <RankingList
                  items={topByRev.map((p) => ({ id: p.productId, name: p.productName, value: Number(p.value) }))}
                  format={formatMoney}
                  onSelect={openMovements}
                />
              </div>
            </section>

            <section className="ig-card">
              <div className="ig-card-head">
                <h3>Cuándo se vende más</h3>
                <Segmented<'hour' | 'weekday'>
                  ariaLabel="Agrupar ventas"
                  options={[
                    { value: 'hour', label: 'Por hora' },
                    { value: 'weekday', label: 'Por día de semana' }
                  ]}
                  value={temporalTab}
                  onChange={setTemporalTab}
                />
              </div>
              {temporalRows.length === 0 ? (
                <EmptyState icon={ChartColumn} title="Sin ventas en este período" />
              ) : (
                <table className="ig-table">
                  <thead>
                    <tr>
                      <th>Franja</th>
                      <th>Ventas</th>
                      <th className="r">Tickets</th>
                      <th className="r">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {temporalRows.map((row, i) => (
                      <tr key={row.label}>
                        <td className="name">
                          {temporalTab === 'hour' ? HOUR_LABEL(row.label) : (WEEKDAY_LABELS[row.label] ?? row.label)}
                        </td>
                        <td style={{ width: '40%' }}>
                          <div className="ig-bar">
                            <i
                              className={i === peak ? 'is-peak' : undefined}
                              style={{ width: `${temporalMax > 0 ? (row.saleCount / temporalMax) * 100 : 0}%` }}
                            />
                          </div>
                        </td>
                        <td className="r">{formatInt(row.saleCount)}</td>
                        <td className="r">{formatMoney(row.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="ig-card">
              <div className="ig-card-head">
                <h3>Menor rotación</h3>
                <span className="ig-help">10 menos vendidos</span>
              </div>
              {lowRot.length === 0 ? (
                <EmptyState icon={ChartColumn} title="Sin ventas en este período" />
              ) : (
                <>
                  <table className="ig-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Producto</th>
                        <th className="r">Vendidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowVisible.map((p, i) => (
                        <tr key={p.productId}>
                          <td className="code">{i + 1}</td>
                          <td className="name">
                            <button
                              type="button"
                              className="ig-link"
                              style={{ textDecoration: 'none', color: 'var(--ink)', textAlign: 'left', fontWeight: 600 }}
                              onClick={() => openMovements(p.productId, p.productName)}
                            >
                              {p.productName}
                            </button>
                          </td>
                          <td className="r">{formatInt(p.totalQuantity)} u.</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {lowRot.length > LOW_COLLAPSED && (
                    <div className="ig-table-foot">
                      <span />
                      <Button size="sm" variant="ghost" onClick={() => setShowAllLow((v) => !v)}>
                        {showAllLow ? 'Ver menos' : `Ver los ${lowRot.length}`}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}
