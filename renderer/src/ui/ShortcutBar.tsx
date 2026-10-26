import { Fragment } from 'react'
import { Kbd } from './Kbd'

export type ShortcutItem = {
  /** Teclas del atajo. Más de una se muestran unidas con "+" (ej. `['Ctrl', 'Enter']`). */
  keys: string[]
  /** Qué hace el atajo. */
  label: string
}

/**
 * Barra de atajos de teclado: "enseñar en contexto" junto a lo que hace cada tecla.
 */
export function ShortcutBar({ items }: { items: ShortcutItem[] }) {
  return (
    <div className="ig-shortcuts">
      {items.map((item) => (
        <span key={`${item.keys.join('+')}:${item.label}`}>
          {item.keys.map((k, i) => (
            <Fragment key={k}>
              {i > 0 && <span aria-hidden="true">+</span>}
              <Kbd>{k}</Kbd>
            </Fragment>
          ))}{' '}
          {item.label}
        </span>
      ))}
    </div>
  )
}
