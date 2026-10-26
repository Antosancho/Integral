/**
 * Formateo de valores para mostrar en pantalla (es-AR).
 *
 * Convenciones del design system:
 *  - Montos: `$ 1.234,50` (espacio duro entre `$` y el número).
 *  - Negativos con el signo menos tipográfico `−` (U+2212), nunca con `-`.
 *  - Fechas y horas en zona local, sin `Intl` para que los tests sean deterministas.
 */

const moneyFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amountFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const intFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const pctFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Signo menos tipográfico. */
const MINUS = '−'

/** Número con 2 dígitos ("5" → "05"). */
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** "$ 1.234,50"; negativos con "−". Si no es número devuelve el valor tal cual. */
export function formatMoney(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  const s = moneyFmt.format(Math.abs(n))
  return n < 0 ? `${MINUS}${s}` : s
}

/** Valor para mostrar dentro de un input de monto, sin "$": "1.234,50". '' si no es número. */
export function formatAmountInput(value: string | number | null): string {
  if (value === null) return ''
  if (typeof value === 'string' && value.trim() === '') return ''
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return ''
  const s = amountFmt.format(Math.abs(n))
  return n < 0 ? `${MINUS}${s}` : s
}

/** Enteros con separador de miles: 1284 → "1.284"; negativos con "−". */
export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const s = intFmt.format(Math.abs(n))
  // Un negativo que redondea a 0 se muestra "0", no "−0".
  return n < 0 && s !== '0' ? `${MINUS}${s}` : s
}

/** Con signo explícito: 24 → "+24", -2 → "−2", 0 → "0". */
export function formatSignedInt(n: number): string {
  if (n > 0) return `+${formatInt(n)}`
  return formatInt(n)
}

/** 12.4 → "+12,4 %", -2.3 → "−2,3 %", 0 → "0,0 %". null → "—". */
export function formatPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  const rounded = Math.round(Math.abs(n) * 10) / 10
  const body = `${pctFmt.format(rounded)} %`
  if (rounded === 0) return body
  return n > 0 ? `+${body}` : `${MINUS}${body}`
}

/** Fecha local → "24/10/2026". */
export function formatDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Fecha local → "24/10". */
export function formatDayMonth(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`
}

/** Hora local → "18:42". */
export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** "24/10 18:42". */
export function formatDayMonthTime(d: Date): string {
  return `${formatDayMonth(d)} ${formatTime(d)}`
}
