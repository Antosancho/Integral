import { parseDecimal } from '../../utils/parse'

/**
 * Valida el monto de un ítem "General" (F10) tipeado por el cajero.
 * Acepta formato es-AR (`1.500,50`, `1500,50`) o con punto (`1500.50`) y exige un monto mayor a 0.
 *
 * Si es válido devuelve `{ ok: true, value }` con `value` en formato máquina (punto decimal, a lo sumo
 * 2 decimales): ese texto es el que viaja al carrito y, al ser de 2 decimales como máximo, se puede
 * volver a validar sin ambigüedad. Si no, `{ ok: false, error }`.
 */
export function validateGeneralAmount(raw: string):
  | { ok: true; value: string }
  | { ok: false; error: string } {
  const error = 'Ingresá un monto mayor a 0.'
  const n = parseDecimal(raw)
  if (n === null) return { ok: false, error }
  // Redondeo a centavos: así el valor guardado nunca tiene 3 decimales (ambiguo con el separador de miles).
  const rounded = Math.round(n * 100) / 100
  if (!Number.isFinite(rounded) || rounded <= 0) return { ok: false, error }
  return { ok: true, value: String(rounded) }
}
