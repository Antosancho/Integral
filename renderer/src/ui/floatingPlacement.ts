/**
 * Posición de un popover flotante (`position: fixed`) respecto de su disparador, en coordenadas de
 * la ventana. Función pura: la usa EntityPicker con el getBoundingClientRect() del disparador.
 */

/** Lo que se usa del rectángulo del disparador (un DOMRect sirve tal cual). */
export type AnchorRect = { top: number; bottom: number; left: number; right: number; width: number }
export type Viewport = { width: number; height: number }

export type FloatingPlacement = {
  /** 'below' = abre debajo del disparador; 'above' = encima. */
  side: 'below' | 'above'
  /** px desde el borde superior de la ventana ('auto' si abre hacia arriba). */
  top: number | 'auto'
  /** px desde el borde inferior de la ventana ('auto' si abre hacia abajo). */
  bottom: number | 'auto'
  left: number
  width: number
  /** Alto disponible en ese lado: el contenido se achica y scrollea si no entra. */
  maxHeight: number
}

/** Separación entre disparador y popover (la misma que el `calc(100% + 4px)` anterior). */
export const FLOATING_GAP = 4
/** Distancia mínima a los bordes de la ventana. */
export const FLOATING_MARGIN = 8
/** Ancho del popover del design system (`.ig-picker-pop`). */
export const FLOATING_MIN_WIDTH = 420
/** Si abajo hay al menos este alto, se abre abajo sin mirar arriba. */
export const FLOATING_PREFERRED_HEIGHT = 360

export function computeFloatingPlacement(anchor: AnchorRect, viewport: Viewport, minWidth = FLOATING_MIN_WIDTH): FloatingPlacement {
  const maxWidth = Math.max(0, viewport.width - 2 * FLOATING_MARGIN)
  const width = Math.min(Math.max(anchor.width, minWidth), maxWidth)

  // Alineado al borde izquierdo del disparador; si se sale por la derecha, al borde derecho.
  let left = anchor.left
  if (left + width > viewport.width - FLOATING_MARGIN) left = anchor.right - width
  left = Math.max(FLOATING_MARGIN, Math.min(left, viewport.width - FLOATING_MARGIN - width))

  const spaceBelow = viewport.height - anchor.bottom - FLOATING_GAP - FLOATING_MARGIN
  const spaceAbove = anchor.top - FLOATING_GAP - FLOATING_MARGIN
  const base = { left: Math.round(left), width: Math.round(width) }

  if (spaceBelow >= FLOATING_PREFERRED_HEIGHT || spaceBelow >= spaceAbove) {
    return { side: 'below', top: Math.round(anchor.bottom + FLOATING_GAP), bottom: 'auto', ...base, maxHeight: Math.max(0, Math.floor(spaceBelow)) }
  }
  return { side: 'above', top: 'auto', bottom: Math.round(viewport.height - anchor.top + FLOATING_GAP), ...base, maxHeight: Math.max(0, Math.floor(spaceAbove)) }
}
