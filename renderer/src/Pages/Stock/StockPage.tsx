import type { Navigate, NavState, StockView } from '../../navigation'
import { Segmented } from '../../ui/Segmented'
import StockMovements from './StockMovements'
import StockProducts from './StockProducts'

/**
 * Sección Stock: arma el segmentado Productos | Movimientos y monta la vista elegida.
 * Cada vista dibuja su propia cabecera (`ig-page-head`) y recibe el segmentado ya armado.
 */
export default function StockPage({ nav, navigate }: { nav: NavState; navigate: Navigate }) {
  const viewSwitcher = (
    <Segmented<StockView>
      ariaLabel="Vista de stock"
      options={[
        { value: 'products', label: 'Productos' },
        { value: 'movements', label: 'Movimientos' },
      ]}
      value={nav.stockView}
      onChange={(v) => navigate({ stockView: v, movementsProduct: null })}
    />
  )

  if (nav.stockView === 'movements') {
    // `key`: si llega otro producto por navegación, la vista se reinicia con sus filtros.
    return (
      <StockMovements
        key={nav.movementsProduct?.id ?? 'all'}
        viewSwitcher={viewSwitcher}
        navigate={navigate}
        product={nav.movementsProduct}
      />
    )
  }

  return <StockProducts viewSwitcher={viewSwitcher} navigate={navigate} />
}
