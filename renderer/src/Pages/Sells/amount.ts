/**
 * Normaliza un string de monto ingresada por el usuario para parseo:
 * - Quita espacios en blanco al inicio/final.
 * - Reemplaza coma decimal (es-AR) por punto.
 */
export function normalizeAmount(raw: string): string {
  return raw.trim().replace(',', '.')
}

/**
 * Valida que el string normalizado sea un monto válido (finito y > 0).
 * Si es válido devuelve { ok: true, value: <string normalizado con punto> }.
 * Si no, devuelve { ok: false, error: <mensaje descriptivo> }.
 */
export function validateGeneralAmount(raw: string):
  | { ok: true; value: string }
  | { ok: false; error: string } {
  if (raw.trim() === '') {
    return { ok: false, error: 'Ingresá un monto' }
  }
  const normalized = normalizeAmount(raw)
  const n = Number(normalized)
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Ingresá un monto positivo' }
  }
  return { ok: true, value: normalized }
}