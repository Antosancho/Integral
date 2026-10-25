/**
 * Helpers de DOM compartidos por los manejadores de teclado globales.
 */

/** true si el target es un campo editable (input, textarea, select o contentEditable). */
export function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

/** scrollIntoView seguro (happy-dom no lo implementa). */
export function scrollIntoViewSafe(el: Element | null): void {
  if (el && typeof (el as HTMLElement).scrollIntoView === 'function') (el as HTMLElement).scrollIntoView({ block: 'nearest' })
}
