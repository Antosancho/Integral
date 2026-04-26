// Funciones puras de utilidad para el módulo de Estadísticas.
// Sin imports de React ni de window.api.

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
 * Calcula el DateRange correspondiente al preset seleccionado.
 * Para 'custom', el caller debe garantizar que customFrom y customTo están definidos.
 */
export function getPeriodDates(
  preset: PeriodPreset,
  customFrom?: Date,
  customTo?: Date
): DateRange {
  switch (preset) {
    case 'today': {
      const today = new Date()
      return { from: getStartOfDay(today), to: getEndOfDay(today) }
    }

    case 'week': {
      const today = new Date()
      const dayOfWeek = today.getDay()
      // getDay() retorna 0=Dom ... 6=Sáb; el offset al lunes es (day + 6) % 7
      const offsetToMonday = (dayOfWeek + 6) % 7
      const monday = new Date(today)
      monday.setDate(today.getDate() - offsetToMonday)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { from: getStartOfDay(monday), to: getEndOfDay(sunday) }
    }

    case 'month': {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      // Día 0 del mes siguiente = último día del mes actual
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { from: getStartOfDay(firstDay), to: getEndOfDay(lastDay) }
    }

    case 'custom':
      return { from: customFrom!, to: customTo! }
  }
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
 * Formatea el cambio porcentual para mostrar en UI.
 * null → 'N/A', positivo → '+X.X%', negativo → '-X.X%'.
 */
export function formatPctChange(pct: number | null): string {
  if (pct === null) return 'N/A'
  if (pct >= 0) return '+' + pct.toFixed(1) + '%'
  return pct.toFixed(1) + '%'
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
