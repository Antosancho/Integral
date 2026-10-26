import { computeCaja, type CajaResult } from './cajaUtils'
import type { SaleFromApi } from '../../electron-api'
import { formatMoney } from '../../utils/format'

interface Props {
  sales: SaleFromApi[]
}

/**
 * Resumen de caja del período listado: total vendido y desglose por medio de pago.
 * No se muestra si no hay ventas.
 */
export default function CajaSummary({ sales }: Props) {
  if (sales.length === 0) {
    return null
  }

  const { total, byMethod }: CajaResult = computeCaja(sales)

  return (
    <section className="ig-card">
      <div className="ig-card-head">
        <h3>Resumen de caja</h3>
      </div>
      <div className="ig-card-body" style={{ display: 'grid', gap: 8 }}>
        <div className="ig-pay-row" style={{ color: 'var(--ink)' }}>
          <b>Total del período</b>
          <span className="v num">{formatMoney(total)}</span>
        </div>
        {byMethod.map((method) => (
          <div key={method.method} className="ig-pay-row">
            <span>{method.label}</span>
            <span className="v num">{formatMoney(method.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
