import { useEffect, useState } from 'react'
import type { SaleFromApi } from '../../electron-api'
import { PAYMENT_LABELS, type PaymentMethod } from '../Sells/payments'
import { formatMoney } from '../../utils/format'
import { buildApiFilters, filterByTime, initialFilters, type SalesHistoryFilters } from './salesHistoryFilters'
import SaleDetailModal from './SaleDetailModal'
import './SalesHistory.css'

export default function SalesHistory() {
  const [filters, setFilters] = useState<SalesHistoryFilters>(initialFilters)
  const [sales, setSales] = useState<SaleFromApi[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSale, setSelectedSale] = useState<SaleFromApi | null>(null)

  async function loadSales() {
    setLoading(true)
    try {
      const apiFilters = buildApiFilters(filters)
      const result = await window.api.listSales(apiFilters)
      const filtered = filterByTime(result, filters.fromTime, filters.toTime)
      setSales(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSales()
  }, [])

  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires'
    }).format(new Date(date))
  }

  function formatPaymentMethods(payments: SaleFromApi['payments']): string {
    if (payments.length === 0) return '—'
    return payments.map(p => PAYMENT_LABELS[p.method as PaymentMethod] ?? p.method).join(', ')
  }

  return (
    <section className="sales-history">
      <div className="sales-history__filters">
        <label>
          Desde fecha
          <input
            type="date"
            value={filters.fromDate}
            onChange={e => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
          />
        </label>
        <label>
          Hasta fecha
          <input
            type="date"
            value={filters.toDate}
            onChange={e => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
          />
        </label>
        <label>
          Desde hora
          <input
            type="time"
            value={filters.fromTime}
            onChange={e => setFilters(prev => ({ ...prev, fromTime: e.target.value }))}
          />
        </label>
        <label>
          Hasta hora
          <input
            type="time"
            value={filters.toTime}
            onChange={e => setFilters(prev => ({ ...prev, toTime: e.target.value }))}
          />
        </label>
        <label>
          Precio mínimo
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.minTotal}
            onChange={e => setFilters(prev => ({ ...prev, minTotal: e.target.value }))}
          />
        </label>
        <label>
          Precio máximo
          <input
            type="number"
            min="0"
            step="0.01"
            value={filters.maxTotal}
            onChange={e => setFilters(prev => ({ ...prev, maxTotal: e.target.value }))}
          />
        </label>
        <label>
          Medio de pago
          <select
            value={filters.method}
            onChange={e => setFilters(prev => ({ ...prev, method: e.target.value }))}
          >
            <option value="">Todos los medios</option>
            <option value="CASH">EFECTIVO</option>
            <option value="DEBIT">DÉBITO</option>
            <option value="CREDIT">CRÉDITO</option>
            <option value="TRANSFER">TRANSFERENCIA</option>
            <option value="OTHER">OTROS</option>
          </select>
        </label>
        <button type="button" onClick={loadSales}>Buscar</button>
      </div>

      <div className="sales-history__list">
        {loading ? (
          <p>Cargando...</p>
        ) : sales.length === 0 ? (
          <p className="sales-history__empty">No se encontraron ventas con los filtros aplicados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha y hora</th>
                <th>Total</th>
                <th>Medios de pago</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => (
                <tr
                  key={sale.id}
                  className="sales-history__row"
                  tabIndex={0}
                  onClick={() => setSelectedSale(sale)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedSale(sale)
                    }
                  }}
                >
                  <td>{sale.id}</td>
                  <td>{formatDate(sale.date)}</td>
                  <td>{formatMoney(Number(sale.total))}</td>
                  <td>{formatPaymentMethods(sale.payments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SaleDetailModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />
    </section>
  )
}
