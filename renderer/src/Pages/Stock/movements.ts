/**
 * Clasificación y filtros (puros) de los movimientos de stock para la vista Stock › Movimientos.
 *
 * El backend guarda `type` ("IN" | "SALE" | "ADJUSTMENT"), `quantity` y `appliedDelta`. La vista distingue
 * además reposición, merma y alta inicial a partir de esos tres datos (ver `classifyMovement`).
 */

export type MovementKind = 'sale' | 'restock' | 'shrink' | 'initial' | 'adjustment'

export type MovementInfo = {
  kind: MovementKind
  /** Texto del badge. */
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'info'
  /** Variación de stock con signo; `null` si no se puede saber (ajuste sin `appliedDelta`). */
  delta: number | null
}

/**
 * Clasifica un movimiento:
 *  - SALE → Venta (resta `quantity`).
 *  - IN con `appliedDelta === 0` y cantidad positiva → Alta inicial: así lo crea `createProduct`, que
 *    ya persistió el stock en el producto y registra el lote con delta 0.
 *  - IN con cantidad negativa → Merma.
 *  - IN → Reposición.
 *  - cualquier otro (ADJUSTMENT) → Ajuste; su variación es `appliedDelta` porque `quantity` es el valor absoluto nuevo.
 */
export function classifyMovement(m: { type: string; quantity: number; appliedDelta: number | null }): MovementInfo {
  if (m.type === 'SALE') return { kind: 'sale', label: 'Venta', tone: 'neutral', delta: -m.quantity }
  if (m.type === 'IN' && m.appliedDelta === 0 && m.quantity > 0) return { kind: 'initial', label: 'Alta inicial', tone: 'info', delta: m.quantity }
  if (m.type === 'IN' && m.quantity < 0) return { kind: 'shrink', label: 'Merma', tone: 'warning', delta: m.quantity }
  if (m.type === 'IN') return { kind: 'restock', label: 'Reposición', tone: 'success', delta: m.quantity }
  return { kind: 'adjustment', label: 'Ajuste', tone: 'neutral', delta: m.appliedDelta }
}

export type MovementTypeFilter = 'all' | 'sale' | 'restock' | 'shrink' | 'adjustment'

/** true si el movimiento pasa el filtro de tipo. 'restock' incluye también las altas iniciales. */
export function matchesTypeFilter(info: MovementInfo, f: MovementTypeFilter): boolean {
  switch (f) {
    case 'all':
      return true
    case 'restock':
      return info.kind === 'restock' || info.kind === 'initial'
    default:
      return info.kind === f
  }
}

/** Últimos 7 días: desde hoy-6 00:00 hasta hoy 23:59:59.999 (zona local). */
export function lastSevenDays(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { from, to }
}
