// Funciones puras de utilidad para el módulo de Estadísticas.
// Sin imports de React ni de window.api.

import { formatPct } from '../../utils/format'
import type { SalesByPeriodFromApi } from '../../electron-api'

export type PeriodPreset = 'today' | 'week' | 'month' | 'custom'
export type DateRange = { from: Date; to: Date }

// ---------------------------------------------------------------------------
// Helpers de fecha
// ---------------------------------------------------------------------------

/** Retorna una copia del Date con tiempo en 00:00:00.000 */
export function getStartOfDay(d: Date): Date {
  const result = new Date(d)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Retorna una copia del Date con tiempo en 23:59:59.999 */
export function getEndOfDay(d: Date): Date {
  const result = new Date(d)
  result.setHours(23, 59, 59, 999)
  return result
}

// ---------------------------------------------------------------------------
// Cálculo de rango de fechas según preset
// ---------------------------------------------------------------------------

/**
 * Rango de días ancla del preset tomando `ref` como "hoy".
 * Con filtro horario, `ref` es el día comercial en curso (ver hourFilter.ts › getBusinessToday).
 */
export function getPeriodDatesAt(preset: Exclude<PeriodPreset, 'custom'>, ref: Date): DateRange {
  switch (preset) {
    case 'today':
      return { from: getStartOfDay(ref), to: getEndOfDay(ref) }
    case 'week': {
      // getDay() retorna 0=Dom ... 6=Sáb; el offset al lunes es (day + 6) % 7
      const offsetToMonday = (ref.getDay() + 6) % 7
      const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - offsetToMonday)
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
      return { from: getStartOfDay(monday), to: getEndOfDay(sunday) }
    }
    case 'month': {
      const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1)
      // Día 0 del mes siguiente = último día del mes actual
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
      return { from: getStartOfDay(firstDay), to: getEndOfDay(lastDay) }
    }
  }
}

/**
 * Calcula el DateRange correspondiente al preset seleccionado.
 * Para 'custom', el caller debe garantizar que customFrom y customTo están definidos.
 */
export function getPeriodDates(
  preset: PeriodPreset,
  customFrom?: Date,
  customTo?: Date
): DateRange {
  if (preset === 'custom') return { from: customFrom!, to: customTo! }
  return getPeriodDatesAt(preset, new Date())
}

// ---------------------------------------------------------------------------
// Cálculo del período anterior (para comparación %)
// ---------------------------------------------------------------------------

/**
 * Retorna el DateRange del período inmediatamente anterior al dado.
 * La lógica es calendar-aware: 'month' retrocede un mes calendario completo,
 * 'week' retrocede exactamente 7 días, y el resto usa la misma duración en ms.
 */
export function getPreviousPeriod(range: DateRange, preset: PeriodPreset): DateRange {
  switch (preset) {
    case 'month': {
      const refDate = range.from
      const firstDayPrev = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
      // Día 0 del mes actual = último día del mes anterior
      const lastDayPrev = new Date(refDate.getFullYear(), refDate.getMonth(), 0)
      return { from: getStartOfDay(firstDayPrev), to: getEndOfDay(lastDayPrev) }
    }

    case 'week': {
      const from = new Date(range.from)
      from.setDate(from.getDate() - 7)
      const to = new Date(range.to)
      to.setDate(to.getDate() - 7)
      return { from, to }
    }

    // 'today' y 'custom': misma duración corrida hacia atrás
    default: {
      const durationMs = range.to.getTime() - range.from.getTime() + 1
      return {
        from: new Date(range.from.getTime() - durationMs),
        to: new Date(range.from.getTime() - 1)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cálculo de variación porcentual
// ---------------------------------------------------------------------------

/**
 * Calcula el cambio porcentual entre `current` y `previous`.
 * Retorna null cuando `previous` es 0 (división imposible).
 */
export function calcPctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/**
 * Formatea el cambio porcentual para mostrar en UI (convención del design system).
 * null → '—', positivo → '+12,4 %', negativo → '−2,3 %', cero → '0,0 %'.
 */
export function formatPctChange(pct: number | null): string {
  return formatPct(pct)
}

// ---------------------------------------------------------------------------
// Re-exportar formatMoney desde el util compartido
// ---------------------------------------------------------------------------

export { formatMoney } from '../../utils/format'

// ---------------------------------------------------------------------------
// Constantes de etiquetas
// ---------------------------------------------------------------------------

export const WEEKDAY_LABELS: Record<string, string> = {
  '0': 'Domingo',
  '1': 'Lunes',
  '2': 'Martes',
  '3': 'Miércoles',
  '4': 'Jueves',
  '5': 'Viernes',
  '6': 'Sábado'
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  custom: 'Personalizado'
}

// ---------------------------------------------------------------------------
// Textos del período y de las franjas horarias
// ---------------------------------------------------------------------------

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

/**
 * Rango legible para el encabezado:
 *  - mismo mes y año → "1 – 24 oct 2026"
 *  - distinto mes    → "28 sep – 4 oct 2026"
 *  - distinto año    → "28 dic 2025 – 3 ene 2026"
 */
export function formatRange(r: DateRange): string {
  const a = r.from
  const b = r.to
  const sameYear = a.getFullYear() === b.getFullYear()
  const sameMonth = sameYear && a.getMonth() === b.getMonth()
  if (sameMonth) {
    return `${a.getDate()} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
  }
  if (sameYear) {
    return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
  }
  return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
}

/** Con qué se compara cada KPI: "vs. ayer", "vs. semana anterior", "vs. septiembre", "vs. período anterior". */
export function comparedToLabel(preset: PeriodPreset, prev: DateRange): string {
  switch (preset) {
    case 'today':
      return 'vs. ayer'
    case 'week':
      return 'vs. semana anterior'
    case 'month':
      return `vs. ${MONTHS_LONG[prev.from.getMonth()]}`
    case 'custom':
      return 'vs. período anterior'
  }
}

/** Etiqueta de una franja horaria: '18' → "18–19 h" ('23' → "23–00 h"). */
export function HOUR_LABEL(label: string): string {
  const h = Number(label)
  if (!Number.isInteger(h)) return label
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}–${pad((h + 1) % 24)} h`
}

/** Índice de la fila con más ventas (el primero si hay empate); -1 si no hay filas. */
export function peakIndex(rows: SalesByPeriodFromApi[]): number {
  let best = -1
  rows.forEach((row, i) => {
    if (best === -1 || row.saleCount > rows[best].saleCount) best = i
  })
  return best
}
