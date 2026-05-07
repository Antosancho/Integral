import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CartList from '../CartList'
import type { CartLine, ProductCartLine } from '../types'
import type { ProductFromApi } from '../../../electron-api'

const mockProduct = (id: number, overrides: Partial<ProductFromApi> = {}): ProductFromApi => ({
  id,
  name: `Producto ${id}`,
  barcode: null,
  purchasePrice: '50.00',
  salePrice: '100.00',
  stock: 10,
  minStock: 0,
  createdAt: new Date(),
  categoryId: 1,
  supplierId: 1,
  category: { id: 1, name: 'Cat' },
  supplier: { id: 1, name: 'Prov', phone: null, notes: null },
  ...overrides
})

const productLine = (id: number, quantity = 1, unitPrice = '100'): ProductCartLine => ({
  kind: 'product',
  lineId: `line-${id}`,
  productId: id,
  product: mockProduct(id),
  quantity,
  unitPrice
})

const renderCart = (lines: CartLine[], handlers: Partial<{
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, unitPrice: string) => void
  onRemove: (lineId: string) => void
}> = {}) => {
  const onQuantityChange = handlers.onQuantityChange ?? vi.fn()
  const onUnitPriceChange = handlers.onUnitPriceChange ?? vi.fn()
  const onRemove = handlers.onRemove ?? vi.fn()
  const utils = render(
    <CartList
      lines={lines}
      onQuantityChange={onQuantityChange}
      onUnitPriceChange={onUnitPriceChange}
      onRemove={onRemove}
    />
  )
  return { ...utils, onQuantityChange, onUnitPriceChange, onRemove }
}

describe('CartList — input Cantidad', () => {
  it('borrar el contenido del input NO dispara onQuantityChange y la fila sigue en el DOM', () => {
    const { onQuantityChange, onRemove } = renderCart([productLine(1, 1)])
    const qtyInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '' } })
    expect(onQuantityChange).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByText('Producto 1')).toBeInTheDocument()
    expect(qtyInput.value).toBe('')
  })

  it('borrar + escribir "5" + blur dispara onQuantityChange con 5', () => {
    const { onQuantityChange } = renderCart([productLine(1, 1)])
    const qtyInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '' } })
    fireEvent.change(qtyInput, { target: { value: '5' } })
    expect(onQuantityChange).not.toHaveBeenCalled()
    fireEvent.blur(qtyInput)
    expect(onQuantityChange).toHaveBeenCalledTimes(1)
    expect(onQuantityChange).toHaveBeenCalledWith('line-1', 5)
  })

  it('blur con el input vacío descarta el draft y el input vuelve a mostrar la cantidad del estado', () => {
    const { onQuantityChange } = renderCart([productLine(1, 3)])
    const qtyInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '' } })
    expect(qtyInput.value).toBe('')
    fireEvent.blur(qtyInput)
    expect(qtyInput.value).toBe('3')
    expect(onQuantityChange).not.toHaveBeenCalled()
  })

  it('Enter con valor válido confirma y dispara onQuantityChange', () => {
    const { onQuantityChange } = renderCart([productLine(1, 1)])
    const qtyInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '7' } })
    fireEvent.keyDown(qtyInput, { key: 'Enter' })
    expect(onQuantityChange).toHaveBeenCalledWith('line-1', 7)
  })

  it('Escape descarta el draft sin disparar onQuantityChange', () => {
    const { onQuantityChange } = renderCart([productLine(1, 4)])
    const qtyInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '99' } })
    expect(qtyInput.value).toBe('99')
    fireEvent.keyDown(qtyInput, { key: 'Escape' })
    expect(qtyInput.value).toBe('4')
    expect(onQuantityChange).not.toHaveBeenCalled()
  })

  it('blur con valor 0 o negativo descarta el draft (no elimina la fila)', () => {
    const { onQuantityChange, onRemove } = renderCart([productLine(1, 2)])
    const qtyInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '0' } })
    fireEvent.blur(qtyInput)
    expect(onQuantityChange).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
    expect(qtyInput.value).toBe('2')
  })
})

describe('CartList — input Precio unitario', () => {
  it('borrar el contenido del input NO dispara onUnitPriceChange y la fila sigue en el DOM', () => {
    const { onUnitPriceChange } = renderCart([productLine(1, 1, '100')])
    const priceInput = screen.getAllByRole('spinbutton')[1] as HTMLInputElement
    fireEvent.change(priceInput, { target: { value: '' } })
    expect(onUnitPriceChange).not.toHaveBeenCalled()
    expect(screen.getByText('Producto 1')).toBeInTheDocument()
    expect(priceInput.value).toBe('')
  })

  it('blur con el input vacío descarta el draft y el input vuelve al precio del estado', () => {
    const { onUnitPriceChange } = renderCart([productLine(1, 1, '250.50')])
    const priceInput = screen.getAllByRole('spinbutton')[1] as HTMLInputElement
    fireEvent.change(priceInput, { target: { value: '' } })
    fireEvent.blur(priceInput)
    expect(priceInput.value).toBe('250.50')
    expect(onUnitPriceChange).not.toHaveBeenCalled()
  })

  it('escribir "150" + blur dispara onUnitPriceChange("line-1", "150")', () => {
    const { onUnitPriceChange } = renderCart([productLine(1, 1, '100')])
    const priceInput = screen.getAllByRole('spinbutton')[1] as HTMLInputElement
    fireEvent.change(priceInput, { target: { value: '150' } })
    fireEvent.blur(priceInput)
    expect(onUnitPriceChange).toHaveBeenCalledTimes(1)
    expect(onUnitPriceChange).toHaveBeenCalledWith('line-1', '150')
  })

  it('Escape descarta el draft de precio', () => {
    const { onUnitPriceChange } = renderCart([productLine(1, 1, '100')])
    const priceInput = screen.getAllByRole('spinbutton')[1] as HTMLInputElement
    fireEvent.change(priceInput, { target: { value: '999' } })
    fireEvent.keyDown(priceInput, { key: 'Escape' })
    expect(priceInput.value).toBe('100')
    expect(onUnitPriceChange).not.toHaveBeenCalled()
  })
})

describe('CartList — eliminación explícita sigue funcionando', () => {
  it('click en ✕ llama onRemove con el lineId correcto', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderCart([productLine(1, 1), productLine(2, 1)])
    const removeButtons = screen.getAllByRole('button', { name: 'Eliminar' })
    await user.click(removeButtons[1])
    expect(onRemove).toHaveBeenCalledWith('line-2')
  })

  it('Delete con foco en la fila (no en el input) llama onRemove', () => {
    const { onRemove } = renderCart([productLine(1, 1)])
    const row = document.querySelector('.cart-list__row') as HTMLElement
    row.focus()
    fireEvent.keyDown(row, { key: 'Delete' })
    expect(onRemove).toHaveBeenCalledWith('line-1')
  })

  it('Delete con foco dentro del input de cantidad NO llama onRemove', () => {
    const { onRemove } = renderCart([productLine(1, 5)])
    const qtyInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
    qtyInput.focus()
    fireEvent.keyDown(qtyInput, { key: 'Delete' })
    expect(onRemove).not.toHaveBeenCalled()
  })
})
