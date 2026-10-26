import { scrollIntoViewSafe } from '../utils/dom'

/**
 * Navegación por teclado de una tabla con un único tab-stop (patrón `role="grid"` con
 * `aria-activedescendant`). Devuelve el handler `onKeyDown` para el contenedor del grid.
 *
 * - ↓/↑: fila siguiente/anterior (si no hay activa, la primera). Se detiene en los extremos.
 * - Home/End: primera/última.
 * - Enter: `onActivate(activeKey)`.
 * No hace nada con listas vacías.
 */
export function useRowNavigation<K extends string | number>(opts: {
  keys: K[]
  activeKey: K | null
  setActiveKey: (k: K) => void
  onActivate?: (k: K) => void
  rowDomId: (k: K) => string
}): (e: React.KeyboardEvent) => void {
  const { keys, activeKey, setActiveKey, onActivate, rowDomId } = opts

  return (e) => {
    if (keys.length === 0) return

    const go = (k: K) => {
      setActiveKey(k)
      scrollIntoViewSafe(document.getElementById(rowDomId(k)))
    }
    const idx = activeKey === null ? -1 : keys.indexOf(activeKey)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        go(idx < 0 ? keys[0] : keys[Math.min(idx + 1, keys.length - 1)])
        break
      case 'ArrowUp':
        e.preventDefault()
        go(idx < 0 ? keys[0] : keys[Math.max(idx - 1, 0)])
        break
      case 'Home':
        e.preventDefault()
        go(keys[0])
        break
      case 'End':
        e.preventDefault()
        go(keys[keys.length - 1])
        break
      case 'Enter':
        if (activeKey !== null && onActivate) {
          e.preventDefault()
          onActivate(activeKey)
        }
        break
    }
  }
}
