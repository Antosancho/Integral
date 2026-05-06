/**
 * Helpers de fechas de vencimiento de lotes.
 * Toda la lógica usa componentes de zona horaria LOCAL del SO (igual a lo que ve el cajero).
 * No mockear el reloj en los tests — usar aritmética con setDate(getDate() ± 1).
 */

export type ExpiryStatus = 'expired' | 'expiring_today'

/**
 * Clasifica una fecha de vencimiento relativa a hoy (zona local):
 *   - 'expired'        → expiryDate < hoy 00:00:00
 *   - 'expiring_today' → hoy 00:00:00 <= expiryDate <= hoy 23:59:59.999
 *   - null             → vence después de hoy o no hay fecha
 */
export function classifyExpiry(expiryDate: Date | null): ExpiryStatus | null {
  if (!expiryDate) return null
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  const ts = expiryDate.getTime()
  if (ts < startOfToday.getTime()) return 'expired'
  if (ts <= endOfToday.getTime()) return 'expiring_today'
  return null
}

/**
 * Parsea el string emitido por <input type="date"> ("YYYY-MM-DD") a Date local (00:00).
 * Valida bounds de mes y día antes de construir la Date para evitar normalizaciones silenciosas
 * (ej: new Date(2026, 12, 1) → enero 2027 en lugar de error).
 * Devuelve null si el string es vacío o tiene formato/rango inválido.
 */
export function parseExpiryInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return null

  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])

  if (m < 1 || m > 12 || d < 1 || d > 31) return null

  const date = new Date(y, m - 1, d, 0, 0, 0, 0)

  // Verificar que los componentes no se normalizaron (ej: 31 de febrero → marzo)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null

  return date
}

/**
 * Convierte una Date a "YYYY-MM-DD" en zona local.
 * Útil para poblar el value de <input type="date">.
 * Devuelve '' si la fecha es null.
 */
export function formatExpiryInput(date: Date | null): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
