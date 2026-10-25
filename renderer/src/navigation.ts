/**
 * Estado de navegación de la app. No hay router: las secciones y sub-vistas son estado de `App`.
 * Reemplaza al viejo `renderTypes.ts`.
 */

/** Sección principal (los tres botones del header). */
export type Section = 'stock' | 'sells' | 'stats'
/** Sub-vista de Stock (segmentado Productos | Movimientos). */
export type StockView = 'products' | 'movements'
/** Sub-vista de Ventas (segmentado Nueva venta | Historial). */
export type SalesView = 'new' | 'history'

export type NavState = {
  section: Section
  stockView: StockView
  salesView: SalesView
  /** Producto con el que se abre Movimientos (desde ⋮ o desde Estadísticas). */
  movementsProduct: { id: number; name: string } | null
  /** Venta a seleccionar al abrir el Historial (desde Movimientos). */
  historySaleId: number | null
}

export const initialNav: NavState = {
  section: 'stock',
  stockView: 'products',
  salesView: 'new',
  movementsProduct: null,
  historySaleId: null,
}

/** Navega aplicando un cambio parcial sobre el estado actual. */
export type Navigate = (patch: Partial<NavState>) => void
