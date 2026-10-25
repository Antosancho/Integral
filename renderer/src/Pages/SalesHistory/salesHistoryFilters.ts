import type { ListSalesFiltersPayload, SaleFromApi } from '../../electron-api'
import { formatDate } from '../../utils/format'
import { parseDateAR, parseDecimal } from '../../utils/parse'
import { includesFolded } from '../../utils/text'
import { PAYMENT_METHODS, PAYMENT_TITLE_LABELS } from '../Sells/payments'
import type { PaymentMethod } from '../Sells/payments'

/** '' = todos; los 5 medios simples; 'MIXED' = ventas con más de un pago (se filtra en el cliente). */
export type SalesMethodFilter = '' | PaymentMethod | 'MIXED'

export interface SalesHistoryFilters {
  /** "DD/MM/AAAA" o ''. */
  fromDate: string
  /** "DD/MM/AAAA" o ''. */
  toDate: string
  /** Texto libre: nombre del producto o parte de su código de barras. */
  product: string
  method: SalesMethodFilter
  /** "HH:MM" o '' (filtro extra, se aplica en el cliente). */
  fromTime: string
  toTime: string
  /** Texto es-AR o '' (filtro extra). */
  minTotal: string
  maxTotal: string
}

/** Filtros por defecto: ventas de hoy (desde hoy hasta hoy), el resto vacío. */
export function defaultFilters(now: Date = new Date()): SalesHistoryFilters {
  const today = formatDate(now)
  return { fromDate: today, toDate: today, product: '', method: '', fromTime: '', toTime: '', minTotal: '', maxTotal: '' }
}

/** Últimos 7 días (hoy incluido), con el resto de los filtros vacíos. */
export function lastSevenDaysFilters(now: Date = new Date()): SalesHistoryFilters {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  return { ...defaultFilters(now), fromDate: formatDate(from) }
}

/** true si algún filtro difiere del default (para mostrar "Limpiar filtros"). */
export function hasActiveFilters(f: SalesHistoryFilters, now: Date = new Date()): boolean {
  const base = defaultFilters(now)
  return (Object.keys(base) as (keyof SalesHistoryFilters)[]).some((k) => f[k] !== base[k])
}

/**
 * Devuelve la hora local en formato "HH:MM" usando la zona horaria de Argentina.
 */
export function getSaleLocalTime(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

/**
 * Filtra ventas por rango de hora (formato "HH:MM").
 * Si ambos parámetros están vacíos, devuelve todas las ventas.
 * Si solo fromTime está definido, incluye ventas con hora >= fromTime.
 * Si solo toTime está definido, incluye ventas con hora <= toTime.
 * Si ambos están definidos, incluye ventas con hora entre fromTime y toTime (inclusive).
 * Si fromTime > toTime (caso de cruce de medianoche), devuelve todas las ventas sin filtrar.
 */
export function filterByTime<T extends { date: Date | string }>(sales: T[], fromTime: string, toTime: string): T[] {
  if (!fromTime && !toTime) {
    return sales
  }

  if (fromTime && toTime && fromTime > toTime) {
    return sales
  }

  return sales.filter((sale) => {
    const saleTime = getSaleLocalTime(new Date(sale.date))

    if (fromTime && toTime) {
      return saleTime >= fromTime && saleTime <= toTime
    }

    if (fromTime) {
      return saleTime >= fromTime
    }

    if (toTime) {
      return saleTime <= toTime
    }

    return true
  })
}

/**
 * Convierte los filtros de la UI al payload del backend.
 *  - Fechas: `fromDate` a las 00:00 y `toDate` a las 23:59:59.999 (zona local).
 *  - `method` solo viaja si es uno de los 5 medios simples ('MIXED' se resuelve en el cliente).
 *  - Montos: se parsean con convención es-AR.
 * Hora y producto se aplican en el cliente (ver `filterSalesClientSide`) y no se envían.
 */
export function buildApiFilters(f: SalesHistoryFilters): ListSalesFiltersPayload {
  const api: ListSalesFiltersPayload = {}

  const from = parseDateAR(f.fromDate)
  if (from) api.fromDate = from

  const to = parseDateAR(f.toDate)
  if (to) api.toDate = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)

  if ((PAYMENT_METHODS as string[]).includes(f.method)) api.method = f.method

  const min = parseDecimal(f.minTotal)
  if (min !== null) api.minTotal = min
  const max = parseDecimal(f.maxTotal)
  if (max !== null) api.maxTotal = max

  return api
}

/**
 * Filtros que se resuelven en el cliente sobre las ventas que devolvió la API:
 * hora del día, producto (nombre sin tildes o parte del código; las líneas General no tienen producto)
 * y medio "Combinado" (más de un pago).
 */
export function filterSalesClientSide(sales: SaleFromApi[], f: SalesHistoryFilters): SaleFromApi[] {
  let result = filterByTime(sales, f.fromTime, f.toTime)

  const q = f.product.trim()
  if (q !== '') {
    result = result.filter((sale) =>
      sale.items.some(
        (item) =>
          item.product !== null &&
          (includesFolded(item.product.name, q) || (item.product.barcode !== null && item.product.barcode.toString().includes(q)))
      )
    )
  }

  if (f.method === 'MIXED') result = result.filter((sale) => sale.payments.length > 1)

  return result
}

/** "Efectivo + Transferencia"; sin pagos "—". Cada medio aparece una sola vez, en el orden en que se pagó. */
export function formatMethods(payments: SaleFromApi['payments']): string {
  if (payments.length === 0) return '—'
  const titles: string[] = []
  for (const p of payments) {
    const title = PAYMENT_TITLE_LABELS[p.method as PaymentMethod] ?? p.method
    if (!titles.includes(title)) titles.push(title)
  }
  return titles.join(' + ')
}
