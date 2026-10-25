import { useState } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SalesProvider, useSales } from '../SalesContext'
import { makeProduct } from '../../test/fixtures'

function Probe() {
  const { cart, discountPct, payments } = useSales()
  return (
    <div>
      <span data-testid="lines">{cart.lines.length}</span>
      <span data-testid="discount">{discountPct}</span>
      <span data-testid="cash">{payments.CASH}</span>
    </div>
  )
}

function Controls() {
  const { dispatchCart, setDiscountPct, setPayments, resetSale } = useSales()
  return (
    <>
      <button onClick={() => dispatchCart({ type: 'ADD', product: makeProduct() })}>agregar</button>
      <button onClick={() => setDiscountPct(15)}>descuento</button>
      <button onClick={() => setPayments((p) => ({ ...p, CASH: '500' }))}>pago</button>
      <button onClick={resetSale}>reset</button>
    </>
  )
}

describe('SalesContext', () => {
  it('agregar un producto vía dispatchCart se refleja en el estado', () => {
    render(
      <SalesProvider>
        <Probe />
        <Controls />
      </SalesProvider>,
    )
    expect(screen.getByTestId('lines')).toHaveTextContent('0')
    fireEvent.click(screen.getByText('agregar'))
    expect(screen.getByTestId('lines')).toHaveTextContent('1')
  })

  it('resetSale deja carrito vacío, descuento en 0 y pagos en ""', () => {
    render(
      <SalesProvider>
        <Probe />
        <Controls />
      </SalesProvider>,
    )
    fireEvent.click(screen.getByText('agregar'))
    fireEvent.click(screen.getByText('descuento'))
    fireEvent.click(screen.getByText('pago'))
    expect(screen.getByTestId('discount')).toHaveTextContent('15')
    expect(screen.getByTestId('cash')).toHaveTextContent('500')

    fireEvent.click(screen.getByText('reset'))
    expect(screen.getByTestId('lines')).toHaveTextContent('0')
    expect(screen.getByTestId('discount')).toHaveTextContent('0')
    expect(screen.getByTestId('cash')).toBeEmptyDOMElement()
  })

  it('el estado sobrevive a desmontar y volver a montar un hijo', () => {
    function Harness() {
      const [visible, setVisible] = useState(true)
      return (
        <SalesProvider>
          <button onClick={() => setVisible((v) => !v)}>toggle</button>
          <Controls />
          {visible && <Probe />}
        </SalesProvider>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByText('agregar'))
    fireEvent.click(screen.getByText('toggle')) // oculta
    expect(screen.queryByTestId('lines')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('toggle')) // vuelve a mostrar
    expect(screen.getByTestId('lines')).toHaveTextContent('1')
  })

  it('useSales fuera de SalesProvider lanza', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useSales())).toThrow('useSales fuera de SalesProvider')
    spy.mockRestore()
  })

  it('resetSale mantiene una identidad estable', () => {
    const { result, rerender } = renderHook(() => useSales(), { wrapper: SalesProvider })
    const first = result.current.resetSale
    act(() => result.current.setDiscountPct(5))
    rerender()
    expect(result.current.resetSale).toBe(first)
  })
})
