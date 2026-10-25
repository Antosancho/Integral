import SalesHistory from '../SalesHistory/SalesHistory'
import Sells from './Sells'
import { Segmented } from '../../ui/Segmented'
import type { Navigate, NavState, SalesView } from '../../navigation'

/**
 * Sección Ventas: arma el segmentado Nueva venta | Historial y monta la vista elegida.
 * Cada vista dibuja su propia cabecera y recibe el segmentado ya armado.
 */
export default function SalesPage({ nav, navigate }: { nav: NavState; navigate: Navigate }) {
  const viewSwitcher = (
    <Segmented<SalesView>
      ariaLabel="Vista de ventas"
      options={[
        { value: 'new', label: 'Nueva venta' },
        { value: 'history', label: 'Historial' }
      ]}
      value={nav.salesView}
      onChange={(v) => navigate({ salesView: v, historySaleId: null })}
    />
  )

  if (nav.salesView === 'history') {
    // `key`: si se llega desde Movimientos con otra venta, la vista se reinicia con ese período.
    return <SalesHistory key={nav.historySaleId ?? 'all'} viewSwitcher={viewSwitcher} initialSaleId={nav.historySaleId} />
  }

  return <Sells viewSwitcher={viewSwitcher} />
}
