import { computeCaja, type CajaResult } from './cajaUtils'
import type { SaleFromApi } from '../../electron-api'
import { formatMoney } from '../../utils/format'
import './CajaSummary.css'

interface Props {
  sales: SaleFromApi[]
}

export default function CajaSummary({ sales }: Props) {
  // Return null if no sales to avoid rendering empty component
  if (sales.length === 0) {
    return null
  }

  const { total, byMethod }: CajaResult = computeCaja(sales)

  return (
    <section className="caja-summary">
      <h3>Resumen de caja</h3>
      
      {/* Total row */}
      <div className="caja-summary__row caja-summary__row--total">
        <span className="caja-summary__label">Total del período</span>
        <span className="caja-summary__value">{formatMoney(total)}</span>
      </div>
      
      {/* Separator if there are payment methods */}
      {byMethod.length > 0 && <hr className="caja-summary__separator" />}
      
      {/* Payment methods rows */}
      {byMethod.map((method) => (
        <div key={method.method} className="caja-summary__row">
          <span className="caja-summary__label">{method.label}</span>
          <span className="caja-summary__value">{formatMoney(method.amount)}</span>
        </div>
      ))}
    </section>
  )
}