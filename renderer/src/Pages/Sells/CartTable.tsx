import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Receipt, TriangleAlert, X } from 'lucide-react'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { formatMoney } from '../../utils/format'
import { lineTotal } from './cartReducer'
import EditableCell from './EditableCell'
import type { CartLine } from './types'

type Props = {
  lines: CartLine[]
  /** Fila a resaltar 600 ms (la que se acaba de agregar). */
  flashLineId: string | null
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, price: string) => void
  onRemove: (lineId: string) => void
  /** Devuelve el foco al input de código de barras. */
  onExit: () => void
}

export type CartTableHandle = { focusFirstRow: () => void }

/** Qué hacer con el foco cuando se quita una línea (se resuelve después del re-render). */
type PendingFocus = { kind: 'row'; index: number } | { kind: 'exit' }

/** Nombre mostrado/accesible de una línea. */
const lineName = (line: CartLine): string => (line.kind === 'product' ? line.product.name : 'General')

/**
 * Carrito de Ventas. Cantidad y precio unitario se editan en el lugar (`EditableCell`).
 *
 * Teclado (con el foco en una fila): ↑/↓ cambian de fila; Enter edita la cantidad; Supr quita la línea
 * y pasa el foco a la siguiente; Esc vuelve al input de código. Dentro de un input, Supr conserva su
 * significado de edición de texto.
 */
const CartTable = forwardRef<CartTableHandle, Props>(function CartTable(
  { lines, flashLineId, onQuantityChange, onUnitPriceChange, onRemove, onExit },
  ref,
) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())
  const cellRefs = useRef({ qty: new Map<string, HTMLInputElement>(), price: new Map<string, HTMLInputElement>() })
  const pendingFocus = useRef<PendingFocus | null>(null)

  const focusRow = (index: number) => {
    const line = lines[index]
    if (line) rowRefs.current.get(line.lineId)?.focus()
  }

  useImperativeHandle(ref, () => ({ focusFirstRow: () => focusRow(0) }))

  // Después de quitar una línea, el foco se resuelve con la lista ya actualizada.
  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    if (pending.kind === 'exit' || lines.length === 0) {
      onExit()
      return
    }
    focusRow(Math.min(pending.index, lines.length - 1))
    // Solo depende de la cantidad de líneas: es el momento en que cambió la lista.
  }, [lines.length])

  /**
   * Quita la línea `index`. Con `row`, el foco queda en la siguiente (o la anterior si era la última) una vez
   * actualizada la lista. Con `exit`, el foco vuelve ya mismo al input de código: si era la última línea, esta
   * tabla se desmonta y no llegaría a resolver un foco pendiente.
   */
  function removeAt(index: number, focus: PendingFocus) {
    if (focus.kind === 'exit') {
      onExit()
    } else {
      pendingFocus.current = focus
    }
    onRemove(lines[index].lineId)
  }

  /** Mueve el foco a la misma celda (cantidad/precio) de la fila de arriba o abajo. */
  function navigateCell(kind: 'qty' | 'price', fromIndex: number, dir: -1 | 1) {
    const target = lines[fromIndex + dir]
    if (target) cellRefs.current[kind].get(target.lineId)?.focus()
  }

  function onRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, index: number) {
    // Solo las teclas de la fila misma; los inputs de adentro manejan las suyas.
    if (e.target !== e.currentTarget) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusRow(Math.min(index + 1, lines.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        focusRow(Math.max(index - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        cellRefs.current.qty.get(lines[index].lineId)?.focus()
        break
      case 'Delete':
        e.preventDefault()
        removeAt(index, lines.length === 1 ? { kind: 'exit' } : { kind: 'row', index })
        break
      case 'Escape':
        e.preventDefault()
        onExit()
        break
    }
  }

  if (lines.length === 0) return null

  return (
    <div className="ig-table-wrap">
      <table className="ig-table ig-cart">
        <thead>
          <tr>
            <th>Producto</th>
            <th className="r qty">Cantidad</th>
            <th className="r price">Precio unit.</th>
            <th className="r">Total</th>
            <th className="actions">
              <span className="ig-sr">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const name = lineName(line)
            const isProduct = line.kind === 'product'
            const modified = isProduct && Number(line.unitPrice) !== Number(line.product.salePrice)
            const noStock = isProduct && line.quantity > line.product.stock
            const classes = [activeId === line.lineId && 'is-selected', flashLineId === line.lineId && 'ig-row-flash']
              .filter(Boolean)
              .join(' ')

            return (
              // La fila recibe el foco (tabIndex -1) para navegar con flechas; su teclado se maneja acá.
              <tr
                key={line.lineId}
                ref={(el) => {
                  if (el) rowRefs.current.set(line.lineId, el)
                  else rowRefs.current.delete(line.lineId)
                }}
                tabIndex={-1}
                data-line-id={line.lineId}
                className={classes || undefined}
                onFocus={() => setActiveId(line.lineId)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveId(null)
                }}
                onKeyDown={(e) => onRowKeyDown(e, index)}
              >
                <td className="name">
                  {isProduct ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {name}
                      {noStock && (
                        <Badge tone="warning" icon={TriangleAlert} title="Sin stock suficiente">
                          Sin stock
                        </Badge>
                      )}
                    </span>
                  ) : (
                    <span className="general">
                      <Receipt size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                      General <Badge tone="neutral">F10</Badge>
                    </span>
                  )}
                </td>
                <td className="r qty">
                  <EditableCell
                    kind="int"
                    value={line.quantity}
                    ariaLabel={`Cantidad de ${name}`}
                    onCommit={(n) => onQuantityChange(line.lineId, n)}
                    onNavigate={(dir) => navigateCell('qty', index, dir)}
                    onExit={() => focusRow(index)}
                    inputRef={(el) => {
                      if (el) cellRefs.current.qty.set(line.lineId, el)
                      else cellRefs.current.qty.delete(line.lineId)
                    }}
                  />
                </td>
                <td className="r price">
                  <EditableCell
                    kind="money"
                    value={line.unitPrice}
                    ariaLabel={`Precio unitario de ${name}`}
                    modified={modified}
                    onCommit={(n) => onUnitPriceChange(line.lineId, String(n))}
                    onNavigate={(dir) => navigateCell('price', index, dir)}
                    onExit={() => focusRow(index)}
                    inputRef={(el) => {
                      if (el) cellRefs.current.price.set(line.lineId, el)
                      else cellRefs.current.price.delete(line.lineId)
                    }}
                  />
                  {modified && isProduct && (
                    <div className="ig-cell-orig">
                      <s>{formatMoney(line.product.salePrice)}</s>
                    </div>
                  )}
                </td>
                <td className="r line-total">{formatMoney(lineTotal(line))}</td>
                <td className="actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon={X}
                    aria-label={`Quitar ${name}`}
                    onClick={() => removeAt(index, { kind: 'exit' })}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

export default CartTable
