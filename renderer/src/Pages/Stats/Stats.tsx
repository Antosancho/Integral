import { useState, useEffect, useCallback } from 'react'
import type {
  StatsSummaryFromApi,
  TopProductFromApi,
  SalesByPeriodFromApi,
  LowRotationFromApi
} from '../../electron-api'
import {
  getPeriodDates,
  getPreviousPeriod,
  calcPctChange,
  formatPctChange,
  formatMoney,
  WEEKDAY_LABELS,
  PERIOD_LABELS,
  type PeriodPreset,
  type DateRange
} from './statsUtils'
import './Stats.css'

// ---------------------------------------------------------------------------
// Componente auxiliar: tarjeta de métrica con variación porcentual
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  prevValue,
  format
}: {
  label: string
  value: number
  prevValue: number
  format: (v: number) => string
}) {
  const pct = calcPctChange(value, prevValue)
  const pctStr = formatPctChange(pct)
  const changeClass =
    pct === null ? 'neutral' : pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral'

  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{format(value)}</p>
      <p className={`stat-card__change stat-card__change--${changeClass}`}>
        {pctStr} vs período anterior
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function Stats() {
  // ── Estado de selección de período ─────────────────────────────────────
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [customFrom, setCustomFrom] = useState('')  // formato yyyy-mm-dd
  const [customTo, setCustomTo] = useState('')

  // ── Estado de carga ─────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Datos cargados ──────────────────────────────────────────────────────
  const [summary, setSummary] = useState<StatsSummaryFromApi | null>(null)
  const [prevSummary, setPrevSummary] = useState<StatsSummaryFromApi | null>(null)
  const [topByQty, setTopByQty] = useState<TopProductFromApi[]>([])
  const [topByRev, setTopByRev] = useState<TopProductFromApi[]>([])
  const [byHour, setByHour] = useState<SalesByPeriodFromApi[]>([])
  const [byWeekday, setByWeekday] = useState<SalesByPeriodFromApi[]>([])
  const [lowRot, setLowRot] = useState<LowRotationFromApi[]>([])

  // ── Tab activo en el panel temporal ────────────────────────────────────
  const [temporalTab, setTemporalTab] = useState<'hour' | 'weekday'>('hour')

  // ── Calcula el rango actual según preset y fechas custom ───────────────
  function getCurrentRange(): DateRange | null {
    if (preset === 'custom') {
      if (!customFrom || !customTo) return null
      const from = new Date(customFrom + 'T00:00:00')
      const to = new Date(customTo + 'T23:59:59.999')
      if (from > to) return null
      return { from, to }
    }
    return getPeriodDates(preset)
  }

  // ── Carga todas las estadísticas en paralelo ───────────────────────────
  // preset es dependencia porque getPreviousPeriod necesita ser calendar-aware
  const loadStats = useCallback(async (range: DateRange) => {
    setLoading(true)
    setError(null)
    try {
      const prev = getPreviousPeriod(range, preset)
      const LIMIT = 5
      const LOW_LIMIT = 10

      const [cur, prv, qty, rev, hour, wday, low] = await Promise.all([
        window.api.getSalesSummary({ from: range.from, to: range.to }),
        window.api.getSalesSummary({ from: prev.from, to: prev.to }),
        window.api.getTopProductsByQuantity({ from: range.from, to: range.to, limit: LIMIT }),
        window.api.getTopProductsByRevenue({ from: range.from, to: range.to, limit: LIMIT }),
        window.api.getSalesByHour({ from: range.from, to: range.to }),
        window.api.getSalesByWeekday({ from: range.from, to: range.to }),
        window.api.getLowRotationProducts({ from: range.from, to: range.to, limit: LOW_LIMIT })
      ])

      setSummary(cur)
      setPrevSummary(prv)
      setTopByQty(qty)
      setTopByRev(rev)
      setByHour(hour)
      setByWeekday(wday)
      setLowRot(low)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }, [preset])

  // Dispara la carga cuando cambia el preset o las fechas custom
  useEffect(() => {
    const range = getCurrentRange()
    if (range) loadStats(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo, loadStats])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="stats-page">

      {/* Cabecera fija: selector de período */}
      <div className="stats-header">
        <div className="stats-period-selector">
          {(['today', 'week', 'month', 'custom'] as PeriodPreset[]).map((p) => (
            <button
              key={p}
              className={`stats-period-btn${preset === p ? ' stats-period-btn--active' : ''}`}
              onClick={() => setPreset(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="stats-custom-range">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span>—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Contenido scrolleable */}
      <div className="stats-scroll-area">

      {loading && <p className="stats-loading">Cargando...</p>}
      {error && <p className="stats-error">{error}</p>}

      {!loading && summary && prevSummary && (
        <>
          {/* ── Sección 1: Cards de resumen ─────────────────────────────── */}
          <section className="stats-section">
            <h2 className="stats-section__title">Resumen del período</h2>
            <div className="stats-cards">
              <StatCard
                label="Ventas Totales"
                value={parseFloat(summary.totalRevenue)}
                prevValue={parseFloat(prevSummary.totalRevenue)}
                format={(v) => formatMoney(v)}
              />
              <StatCard
                label="Cantidad de Ventas"
                value={summary.saleCount}
                prevValue={prevSummary.saleCount}
                format={(v) => v.toString()}
              />
              <StatCard
                label="Ticket Promedio"
                value={parseFloat(summary.averageTicket)}
                prevValue={parseFloat(prevSummary.averageTicket)}
                format={(v) => formatMoney(v)}
              />
              <StatCard
                label="Ganancia Total"
                value={parseFloat(summary.totalProfit)}
                prevValue={parseFloat(prevSummary.totalProfit)}
                format={(v) => formatMoney(v)}
              />
            </div>
          </section>

          {/* ── Sección 2: Top productos ─────────────────────────────────── */}
          <section className="stats-section">
            <h2 className="stats-section__title">Productos</h2>
            <div className="stats-tables-row">

              <div className="stats-table-container">
                <h3>Más vendidos (por unidades)</h3>
                <table className="stats-table">
                  <thead>
                    <tr><th>#</th><th>Producto</th><th>Unidades</th></tr>
                  </thead>
                  <tbody>
                    {topByQty.length === 0
                      ? <tr><td colSpan={3} className="stats-empty">Sin datos</td></tr>
                      : topByQty.map((p, i) => (
                          <tr key={p.productId}>
                            <td>{i + 1}</td>
                            <td>{p.productName}</td>
                            <td>{p.value}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

              <div className="stats-table-container">
                <h3>Más facturan (por monto)</h3>
                <table className="stats-table">
                  <thead>
                    <tr><th>#</th><th>Producto</th><th>Facturado</th></tr>
                  </thead>
                  <tbody>
                    {topByRev.length === 0
                      ? <tr><td colSpan={3} className="stats-empty">Sin datos</td></tr>
                      : topByRev.map((p, i) => (
                          <tr key={p.productId}>
                            <td>{i + 1}</td>
                            <td>{p.productName}</td>
                            <td>{formatMoney(p.value)}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>

            </div>
          </section>

          {/* ── Sección 3: Análisis temporal ─────────────────────────────── */}
          <section className="stats-section">
            <h2 className="stats-section__title">Horarios y días con más ventas</h2>
            <div className="stats-temporal-tabs">
              <button
                className={`stats-temporal-tab${temporalTab === 'hour' ? ' stats-temporal-tab--active' : ''}`}
                onClick={() => setTemporalTab('hour')}
              >
                Por hora
              </button>
              <button
                className={`stats-temporal-tab${temporalTab === 'weekday' ? ' stats-temporal-tab--active' : ''}`}
                onClick={() => setTemporalTab('weekday')}
              >
                Por día de semana
              </button>
            </div>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>{temporalTab === 'hour' ? 'Hora' : 'Día'}</th>
                  <th>Cantidad de ventas</th>
                  <th>Total facturado</th>
                </tr>
              </thead>
              <tbody>
                {(temporalTab === 'hour' ? byHour : byWeekday).length === 0
                  ? <tr><td colSpan={3} className="stats-empty">Sin ventas en el período</td></tr>
                  : (temporalTab === 'hour' ? byHour : byWeekday).map((row) => (
                      <tr key={row.label}>
                        <td>
                          {temporalTab === 'hour'
                            ? `${row.label}:00`
                            : (WEEKDAY_LABELS[row.label] ?? row.label)
                          }
                        </td>
                        <td>{row.saleCount}</td>
                        <td>{formatMoney(row.totalRevenue)}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </section>

          {/* ── Sección 4: Baja rotación ─────────────────────────────────── */}
          <section className="stats-section">
            <h2 className="stats-section__title">Productos con menor rotación</h2>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Unidades vendidas en el período</th>
                </tr>
              </thead>
              <tbody>
                {lowRot.length === 0
                  ? <tr><td colSpan={2} className="stats-empty">Sin datos</td></tr>
                  : lowRot.map((p) => (
                      <tr key={p.productId}>
                        <td>{p.productName}</td>
                        <td>{p.totalQuantity}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </section>
        </>
      )}

      </div>
    </div>
  )
}
