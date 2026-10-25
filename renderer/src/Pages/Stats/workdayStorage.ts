/**
 * Jornada laboral de Estadísticas recordada en localStorage (mismo patrón que utils/theme.ts).
 * Valor: {"start":"08:00","end":"02:00"}. Ante cualquier problema se usa DEFAULT_WORKDAY.
 */
import { formatMinutesHM, parseTimeHM } from '../../utils/time'
import { DEFAULT_WORKDAY, type TimeWindow } from './hourFilter'

/** Clave de localStorage donde se recuerda la jornada laboral. */
export const WORKDAY_STORAGE_KEY = 'integral.stats.workday'

/** Lee la jornada guardada. Sin clave, JSON corrupto, horas inválidas o storage inaccesible → 08:00 → 02:00. */
export function loadWorkday(): TimeWindow {
  try {
    const raw = localStorage.getItem(WORKDAY_STORAGE_KEY)
    if (raw === null) return { ...DEFAULT_WORKDAY }
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_WORKDAY }
    const { start, end } = data as { start?: unknown; end?: unknown }
    const startMinute = typeof start === 'string' ? parseTimeHM(start) : null
    const endMinute = typeof end === 'string' ? parseTimeHM(end) : null
    if (startMinute === null || endMinute === null) return { ...DEFAULT_WORKDAY }
    return { startMinute, endMinute }
  } catch {
    return { ...DEFAULT_WORKDAY }
  }
}

/** Guarda la jornada. Si no hay storage, el cambio vale solo para esta sesión. */
export function saveWorkday(w: TimeWindow): void {
  try {
    localStorage.setItem(
      WORKDAY_STORAGE_KEY,
      JSON.stringify({ start: formatMinutesHM(w.startMinute), end: formatMinutesHM(w.endMinute) })
    )
  } catch {
    /* sin storage: solo esta sesión */
  }
}
