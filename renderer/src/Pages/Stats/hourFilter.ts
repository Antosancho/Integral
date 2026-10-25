// Filtro horario del panel de Estadísticas: funciones puras (sin React ni window.api).
// Semántica: ver CLAUDE.md › Módulo de Estadísticas › Filtro horario.

import type { SalesByPeriodFromApi, StatsInterval, StatsRangeInput } from '../../electron-api'
import { formatMinutesHM, parseTimeHM } from '../../utils/time'
import { getStartOfDay, type DateRange } from './statsUtils'

/** Opción elegida en el segmentado "Horario". */
export type HourFilterMode = 'all' | 'workday' | 'custom'

/**
 * Franja diaria en minutos desde las 00:00 (0–1439). `startMinute` inclusivo, `endMinute` EXCLUSIVO.
 * - start < end  → franja del mismo día: [D start, D end)
 * - end <= start → cruza la medianoche ("día comercial"): [D start, D+1 end). end == start = 24 h.
 */
export type TimeWindow = { startMinute: number; endMinute: number }

/** Resultado de resolver el filtro elegido. */
export type HourFilterState =
  | { kind: 'all' } // "Todo el día": sin franja (comportamiento de siempre)
  | { kind: 'window'; window: TimeWindow } // franja válida (jornada laboral o personalizada)
  | { kind: 'incomplete' } // "Personalizado" con horas vacías, incompletas o inválidas: no se consulta

/** Jornada laboral por defecto: 08:00 → 02:00 del día siguiente. */
export const DEFAULT_WORKDAY: Readonly<TimeWindow> = Object.freeze({ startMinute: 8 * 60, endMinute: 2 * 60 })

/** Con franja, máximo de días por período (más que esto tarda demasiado). */
export const MAX_FILTERED_DAYS = 366

/** true si la franja termina al día siguiente (incluye end == start, 24 h). */
export function crossesMidnight(w: TimeWindow): boolean {
  return w.endMinute <= w.startMinute
}

/**
 * Día comercial en curso (00:00 de ese día). Con una franja que cruza la medianoche, antes de la
 * hora de cierre todavía corre el día comercial de AYER (martes 01:00 con 08→02 → lunes).
 * Sin franja o con franja del mismo día → hoy.
 */
export function getBusinessToday(now: Date, w: TimeWindow | null): Date {
  const today = getStartOfDay(now)
  if (!w || !crossesMidnight(w)) return today
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  if (nowMinute < w.endMinute) return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  return today
}

/** Cantidad de días ancla del rango (from y to inclusive). */
export function countDays(range: DateRange): number {
  const a = getStartOfDay(range.from)
  const b = getStartOfDay(range.to)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

/**
 * Un intervalo [from, to) por cada día ancla D del rango, en hora local:
 * franja del mismo día → [D start, D end); cruza medianoche → [D start, D+1 end).
 * Siempre con new Date(y, m, d, h, min): nunca sumando milisegundos.
 */
export function buildIntervals(range: DateRange, w: TimeWindow): StatsInterval[] {
  const first = getStartOfDay(range.from)
  const n = countDays(range)
  const sh = Math.floor(w.startMinute / 60)
  const sm = w.startMinute % 60
  const eh = Math.floor(w.endMinute / 60)
  const em = w.endMinute % 60
  const endDayOffset = crossesMidnight(w) ? 1 : 0
  const out: StatsInterval[] = []
  for (let i = 0; i < n; i++) {
    const y = first.getFullYear()
    const m = first.getMonth()
    const d = first.getDate() + i
    out.push({ from: new Date(y, m, d, sh, sm), to: new Date(y, m, d + endDayOffset, eh, em) })
  }
  return out
}

/** Payload de los canales stats:*. Sin franja: { from, to } exactamente como siempre (sin la clave intervals). */
export function toStatsInput(range: DateRange, w: TimeWindow | null): StatsRangeInput {
  if (!w) return { from: range.from, to: range.to }
  return { from: range.from, to: range.to, intervals: buildIntervals(range, w) }
}

/**
 * "Por hora" con franja: ordena empezando por la hora de apertura (08…23, 00, 01).
 * Sin franja devuelve el mismo array (orden 00→23 del backend). No muta la entrada.
 */
export function orderHourRows(rows: SalesByPeriodFromApi[], w: TimeWindow | null): SalesByPeriodFromApi[] {
  if (!w) return rows
  const startHour = Math.floor(w.startMinute / 60)
  const pos = (label: string) => (Number(label) - startHour + 24) % 24
  return [...rows].sort((a, b) => pos(a.label) - pos(b.label))
}

/** "De 09:00 a 13:00" · "De 08:00 a 02:00 del día siguiente" · "De 08:00 a 08:00 del día siguiente (24 h)". */
export function describeWindow(w: TimeWindow): string {
  const a = formatMinutesHM(w.startMinute)
  const b = formatMinutesHM(w.endMinute)
  if (!crossesMidnight(w)) return `De ${a} a ${b}`
  if (w.startMinute === w.endMinute) return `De ${a} a ${b} del día siguiente (24 h)`
  return `De ${a} a ${b} del día siguiente`
}

/** Traduce lo elegido en pantalla a un estado único. */
export function resolveHourFilter(
  mode: HourFilterMode,
  workday: TimeWindow,
  customStart: string,
  customEnd: string
): HourFilterState {
  if (mode === 'all') return { kind: 'all' }
  if (mode === 'workday') return { kind: 'window', window: workday }
  const startMinute = parseTimeHM(customStart)
  const endMinute = parseTimeHM(customEnd)
  if (startMinute === null || endMinute === null) return { kind: 'incomplete' }
  return { kind: 'window', window: { startMinute, endMinute } }
}
