/**
 * Genera un identificador único para cada fila del carrito.
 * Usa crypto.randomUUID() cuando está disponible (navegador moderno,
 * Node.js 16+), de lo contrario recurre a un fallback basado en
 * timestamp + random para mantener compatibilidad.
 */
export function newLineId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}