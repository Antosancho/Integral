import { createRef, useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeProduct } from '../../../test/fixtures'
import CartTable from '../CartTable'
import type { CartTableHandle } from '../CartTable'
import type { CartLine, ProductCartLine } from '../types'

function productLine(id: number, name: string, over: Partial<ProductCartLine> = {}): ProductCartLine {
  const product = makeProduct({ id, name, salePrice: '1000', stock: 10 })
  return { kind: 'product', lineId: `l${id}`, productId: id, product, quantity: 1, unitPrice: '1000', ...over }
}

const A = productLine(1, 'Leche')
const B = productLine(2, 'Yerba')
const C = productLine(3, 'Fideos')

type HarnessProps = {
  initial: CartLine[]
  onExit?: () => void
  onRemove?: (id: string) => void
  onQuantityChange?: (id: string, q: number) => void
  onUnitPriceChange?: (id: string, p: string) => void
  flashLineId?: string | null
  tableRef?: React.Ref<CartTableHandle>
}

/** Mantiene las líneas en estado para que Supr realmente las quite. */
function Harness({ initial, onExit = () => {}, onRemove, onQuantityChange, onUnitPriceChange, flashLineId = null, tableRef }: HarnessProps) {
  const [lines, setLines] = useState(initial)
  return (
    <CartTable
      ref={tableRef}
      lines={lines}
      flashLineId={flashLineId}
      onQuantityChange={onQuantityChange ?? (() => {})}
      onUnitPriceChange={onUnitPriceChange ?? (() => {})}
      onRemove={(id) => {
        onRemove?.(id)
        setLines((ls) => ls.filter((l) => l.lineId !== id))
      }}
      onExit={onExit}
    />
  )
}

const rowOf = (name: string) => screen.getByLabelText(`Cantidad de ${name}`).closest('tr') as HTMLElement

describe('CartTable', () => {
  it('muestra las columnas Producto, Cantidad, Precio unit., Total y Quitar (solo lectores)', () => {
    render(<Harness initial={[A]} />)
    const headers = Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent)
    expect(headers).toEqual(['Producto', 'Cantidad', 'Precio unit.', 'Total', 'Quitar'])
  })

  it('con carrito vacío no renderiza la tabla', () => {
    const { container } = render(<Harness initial={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra el total de cada línea formateado', () => {
    render(<Harness initial={[productLine(1, 'Leche', { quantity: 3, unitPrice: '1450.5' })]} />)
    expect(within(rowOf('Leche')).getByText('$ 4.351,50')).toBeInTheDocument()
  })

  it('badge "Sin stock" cuando la cantidad supera el stock', () => {
    const p = makeProduct({ id: 9, name: 'Coca', stock: 2 })
    render(<Harness initial={[productLine(9, 'Coca', { product: p, quantity: 3 })]} />)
    expect(screen.getByText('Sin stock')).toBeInTheDocument()
  })

  it('sin badge cuando alcanza el stock', () => {
    render(<Harness initial={[productLine(1, 'Leche', { quantity: 10 })]} />)
    expect(screen.queryByText('Sin stock')).toBeNull()
  })

  it('precio distinto al de lista: is-modified y el precio original tachado', () => {
    render(<Harness initial={[productLine(1, 'Leche', { unitPrice: '800' })]} />)
    expect(screen.getByLabelText('Precio unitario de Leche')).toHaveClass('is-modified')
    const original = document.querySelector('.ig-cell-orig s')
    expect(original).toHaveTextContent('$ 1.000,00')
  })

  it('precio igual al de lista: sin marca ni precio tachado', () => {
    render(<Harness initial={[A]} />)
    expect(screen.getByLabelText('Precio unitario de Leche')).not.toHaveClass('is-modified')
    expect(document.querySelector('.ig-cell-orig')).toBeNull()
  })

  it('línea General con su nombre, el atajo F10 y sin alerta de stock', () => {
    const general: CartLine = { kind: 'general', lineId: 'g1', quantity: 2, unitPrice: '850.5' }
    render(<Harness initial={[general]} />)
    expect(screen.getByText('General', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('F10')).toBeInTheDocument()
    expect(screen.queryByText('Sin stock')).toBeNull()
    expect(screen.getByLabelText('Precio unitario de General')).not.toHaveClass('is-modified')
  })

  it('editar cantidad y precio llama a los callbacks (el precio como string numérico)', () => {
    const onQuantityChange = vi.fn()
    const onUnitPriceChange = vi.fn()
    render(<Harness initial={[A]} onQuantityChange={onQuantityChange} onUnitPriceChange={onUnitPriceChange} />)
    const qty = screen.getByLabelText('Cantidad de Leche')
    fireEvent.focus(qty)
    fireEvent.change(qty, { target: { value: '4' } })
    fireEvent.keyDown(qty, { key: 'Enter' })
    expect(onQuantityChange).toHaveBeenCalledWith('l1', 4)

    const price = screen.getByLabelText('Precio unitario de Leche')
    fireEvent.focus(price)
    fireEvent.change(price, { target: { value: '1.200,50' } })
    fireEvent.keyDown(price, { key: 'Enter' })
    expect(onUnitPriceChange).toHaveBeenCalledWith('l1', '1200.5')
  })

  it('el botón ✕ quita la línea y devuelve el foco al código de barras', () => {
    const onRemove = vi.fn()
    const onExit = vi.fn()
    render(<Harness initial={[A, B]} onRemove={onRemove} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Leche' }))
    expect(onRemove).toHaveBeenCalledWith('l1')
    expect(screen.queryByLabelText('Cantidad de Leche')).toBeNull()
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('Supr en una fila quita la línea y el foco pasa a la siguiente', () => {
    const onRemove = vi.fn()
    render(<Harness initial={[A, B, C]} onRemove={onRemove} />)
    const row = rowOf('Leche')
    row.focus()
    fireEvent.keyDown(row, { key: 'Delete' })
    expect(onRemove).toHaveBeenCalledWith('l1')
    expect(rowOf('Yerba')).toHaveFocus()
  })

  it('Supr en la última fila pasa el foco a la anterior', () => {
    render(<Harness initial={[A, B]} />)
    const row = rowOf('Yerba')
    row.focus()
    fireEvent.keyDown(row, { key: 'Delete' })
    expect(rowOf('Leche')).toHaveFocus()
  })

  it('Supr sobre la única línea la quita y vuelve al código de barras (onExit)', () => {
    const onExit = vi.fn()
    render(<Harness initial={[A]} onExit={onExit} />)
    const row = rowOf('Leche')
    row.focus()
    fireEvent.keyDown(row, { key: 'Delete' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('Supr con el foco en un input NO borra la línea', () => {
    const onRemove = vi.fn()
    render(<Harness initial={[A]} onRemove={onRemove} />)
    const qty = screen.getByLabelText('Cantidad de Leche')
    qty.focus()
    fireEvent.keyDown(qty, { key: 'Delete' })
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('Esc en una fila llama onExit', () => {
    const onExit = vi.fn()
    render(<Harness initial={[A]} onExit={onExit} />)
    const row = rowOf('Leche')
    row.focus()
    fireEvent.keyDown(row, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('↓ y ↑ en una fila mueven el foco a la siguiente / anterior', () => {
    render(<Harness initial={[A, B]} />)
    const first = rowOf('Leche')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(rowOf('Yerba')).toHaveFocus()
    fireEvent.keyDown(rowOf('Yerba'), { key: 'ArrowUp' })
    expect(rowOf('Leche')).toHaveFocus()
  })

  it('Enter en una fila enfoca el input de cantidad', () => {
    render(<Harness initial={[A]} />)
    const row = rowOf('Leche')
    row.focus()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(screen.getByLabelText('Cantidad de Leche')).toHaveFocus()
  })

  it('↓ dentro de la cantidad confirma y salta a la cantidad de la fila siguiente', () => {
    render(<Harness initial={[A, B]} />)
    const qty = screen.getByLabelText('Cantidad de Leche')
    qty.focus()
    fireEvent.keyDown(qty, { key: 'ArrowDown' })
    expect(screen.getByLabelText('Cantidad de Yerba')).toHaveFocus()
  })

  it('Esc dentro de un input devuelve el foco a su fila', () => {
    render(<Harness initial={[A]} />)
    const qty = screen.getByLabelText('Cantidad de Leche')
    qty.focus()
    fireEvent.keyDown(qty, { key: 'Escape' })
    expect(rowOf('Leche')).toHaveFocus()
  })

  it('focusFirstRow() enfoca la primera fila', () => {
    const ref = createRef<CartTableHandle>()
    render(<Harness initial={[A, B]} tableRef={ref} />)
    ref.current!.focusFirstRow()
    expect(rowOf('Leche')).toHaveFocus()
  })

  it('la fila con foco queda is-selected y la resaltada con ig-row-flash', () => {
    render(<Harness initial={[A, B]} flashLineId="l2" />)
    expect(rowOf('Yerba')).toHaveClass('ig-row-flash')
    act(() => rowOf('Leche').focus())
    expect(rowOf('Leche')).toHaveClass('is-selected')
    expect(rowOf('Yerba')).not.toHaveClass('is-selected')
  })
})
