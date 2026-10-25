/**
 * Horas tipeadas por el usuario en formato "HH:MM" (24 h).
 * Como las fechas (`DateField`): texto con máscara, nunca `type="time"`.
 * Los minutos se cuentan desde las 00:00 (0–1439).
 */

export const TIME_RANGE_ERROR = 'Ingresá una hora entre 00:00 y 23:59.'
export const TIME_INCOMPLETE_ERROR = 'Completá la hora (HH:MM).'

/**
 * Máscara mientras se tipea: deja solo dígitos (máx. 4) e inserta ":" → "0800" → "08:00", "083" → "08:3".
 * Si empieza con un dígito seguido de ":" ("8:", "8:3") se asume hora de un dígito → "08", "08:3".
 */
export function maskTimeInput(raw: string): string {
  const fixed = /^\d:/.test(raw) ? `0${raw}` : raw
  const digits = fixed.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/** "HH:MM" exacto (00–23 : 00–59) → minutos desde las 00:00; cualquier otra cosa → null. Ignora espacios alrededor. */
export function parseTimeHM(input: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(input.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutos desde las 00:00 (0–1439) → "HH:MM". */
export function formatMinutesHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Error a mostrar en un campo HH:MM.
 * - Válida → null.
 * - Completa (5 caracteres) pero fuera de rango ("25:00", "12:60") → TIME_RANGE_ERROR.
 * - Vacía o incompleta → TIME_INCOMPLETE_ERROR solo si `submitted` (se intentó guardar); si no, null.
 */
export function timeFieldError(text: string, submitted: boolean): string | null {
  if (parseTimeHM(text) !== null) return null
  if (text.length === 5) return TIME_RANGE_ERROR
  return submitted ? TIME_INCOMPLETE_ERROR : null
}
