/**
 * Utilidades de texto para búsquedas que ignoran tildes y mayúsculas.
 */

/**
 * Quita tildes y pasa a minúsculas, conservando el largo (1 carácter → 1 carácter),
 * así los índices del texto plegado sirven para cortar el original.
 */
export function foldText(s: string): string {
  return s
    .split('')
    .map((ch) => {
      const base = ch.normalize('NFD')[0].toLowerCase()
      // Si la minúscula cambiara el largo, se conserva el carácter original para no desfasar índices.
      return base.length === 1 ? base : ch
    })
    .join('')
}

/** Divide `text` en segmentos marcando la primera coincidencia de `query` (sin tildes ni mayúsculas). */
export function splitMatch(text: string, query: string): { text: string; match: boolean }[] {
  const q = foldText(query.trim())
  if (q === '') return [{ text, match: false }]
  const idx = foldText(text).indexOf(q)
  if (idx < 0) return [{ text, match: false }]
  const parts: { text: string; match: boolean }[] = []
  if (idx > 0) parts.push({ text: text.slice(0, idx), match: false })
  parts.push({ text: text.slice(idx, idx + q.length), match: true })
  if (idx + q.length < text.length) parts.push({ text: text.slice(idx + q.length), match: false })
  return parts
}

/** true si `text` contiene `query` ignorando tildes y mayúsculas. Query vacía → true. */
export function includesFolded(text: string, query: string): boolean {
  const q = foldText(query.trim())
  if (q === '') return true
  return foldText(text).includes(q)
}
