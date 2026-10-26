/**
 * Contador global de modales abiertos.
 *
 * Los atajos globales de cada pantalla (F2, Ctrl+N, F12…) consultan `openModalCount()`
 * para no dispararse mientras hay un modal encima. `Modal` hace push/pop al abrir/cerrar.
 */
let openCount = 0

export function pushModal(): void {
  openCount += 1
}

export function popModal(): void {
  openCount = Math.max(0, openCount - 1)
}

export function openModalCount(): number {
  return openCount
}
