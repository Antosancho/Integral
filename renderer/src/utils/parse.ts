/**
 * Parseo de texto tipeado por el usuario (convención es-AR).
 * Todas las funciones devuelven `null` cuando el texto está vacío o es inválido:
 * decidir qué hacer con eso (error, descarte silencioso) es responsabilidad de quien llama.
 */

/**
 * Parseo de montos es-AR.
 * "1.234,50" | "1234,50" | "1234.50" | "$ 1.234" | "−5" → número; vacío o inválido → null.
 *
 * Regla de puntos sin coma: si el texto es /^\d{1,3}(\.\d{3})+$/ los puntos son de miles
 * ("1.500" → 1500); si no, el punto es decimal ("2.5" → 2.5). Excepción: un primer grupo
 * que empieza en 0 ("0.500") es decimal, porque un número no se escribe con ceros a la izquierda.
 */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/[\s$]/g, '').replace(/−/g, '-')
  if (s === '') return null
  let norm: string
  if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, '')
  else norm = s
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

/** Enteros: "24" → 24, "−2"/"-2" → -2, " 7 " → 7; "2,5", "abc", "" → null. */
export function parseInteger(input: string): number | null {
  const s = input.trim().replace(/−/g, '-')
  if (!/^-?\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isSafeInteger(n)) return null
  // Evita devolver -0 para "-0".
  return n === 0 ? 0 : n
}

/** "DD/MM/AAAA" → Date local 00:00; valida día/mes reales (31/02 → null). */
export function parseDateAR(input: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim())
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  const d = new Date(year, month - 1, day)
  // `new Date` "corrige" fechas imposibles (31/02 → 03/03): se compara para detectarlo.
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return d
}

/** Máscara mientras se tipea: deja solo dígitos (máx 8) e inserta "/" → "24102026" → "24/10/2026", "241" → "24/1". */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
