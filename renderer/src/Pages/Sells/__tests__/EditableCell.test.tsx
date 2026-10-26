import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EditableCell from '../EditableCell'

function setupMoney(value: string | number = '1450.5') {
  const onCommit = vi.fn()
  const onExit = vi.fn()
  const onNavigate = vi.fn()
  render(<EditableCell kind="money" value={value} ariaLabel="Precio" onCommit={onCommit} onExit={onExit} onNavigate={onNavigate} />)
  const input = screen.getByLabelText('Precio') as HTMLInputElement
  return { input, onCommit, onExit, onNavigate }
}

function setupInt(value = 2) {
  const onCommit = vi.fn()
  const onExit = vi.fn()
  render(<EditableCell kind="int" value={value} ariaLabel="Cantidad" onCommit={onCommit} onExit={onExit} />)
  const input = screen.getByLabelText('Cantidad') as HTMLInputElement
  return { input, onCommit, onExit }
}

const edit = (input: HTMLInputElement, text: string) => {
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: text } })
}

describe('EditableCell', () => {
  it('muestra el precio formateado es-AR y la cantidad como entero', () => {
    expect(setupMoney().input.value).toBe('1.450,50')
    document.body.innerHTML = ''
    expect(setupInt(3).input.value).toBe('3')
  })

  it('tipear "1.200,00" + Enter confirma 1200 y devuelve el foco a la fila', () => {
    const { input, onCommit, onExit } = setupMoney()
    edit(input, '1.200,00')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(1200)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('un valor vacío se descarta en silencio y vuelve al valor anterior', () => {
    const { input, onCommit } = setupMoney()
    edit(input, '')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('1.450,50')
  })

  it('cantidad 0 o negativa no se confirma', () => {
    const { input, onCommit } = setupInt(2)
    edit(input, '0')
    fireEvent.keyDown(input, { key: 'Enter' })
    edit(input, '-3')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('2')
  })

  it('texto no numérico se descarta y vuelve al valor anterior', () => {
    const { input, onCommit } = setupMoney()
    edit(input, 'abc')
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('1.450,50')
  })

  it('un precio 0 es válido (>= 0)', () => {
    const { input, onCommit } = setupMoney()
    edit(input, '0')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledWith(0)
  })

  it('un precio negativo no se confirma', () => {
    const { input, onCommit } = setupMoney()
    edit(input, '-5')
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('confirmar el mismo valor no dispara onCommit', () => {
    const { input, onCommit } = setupMoney()
    edit(input, '1.450,50')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('Esc descarta el borrador, avisa onExit y no se propaga', () => {
    const outer = vi.fn()
    const onCommit = vi.fn()
    const onExit = vi.fn()
    render(
      <div onKeyDown={outer}>
        <EditableCell kind="money" value="100" ariaLabel="Precio" onCommit={onCommit} onExit={onExit} />
      </div>,
    )
    const input = screen.getByLabelText('Precio') as HTMLInputElement
    edit(input, '999')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    expect(input.value).toBe('100,00')
    // El blur posterior (al mover el foco) no debe confirmar el borrador descartado.
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('↓ confirma y llama onNavigate(1); ↑ llama onNavigate(-1)', () => {
    const { input, onCommit, onNavigate } = setupMoney()
    edit(input, '2000')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(onCommit).toHaveBeenCalledWith(2000)
    expect(onNavigate).toHaveBeenCalledWith(1)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(onNavigate).toHaveBeenLastCalledWith(-1)
  })

  it('blur confirma el borrador válido', () => {
    const { input, onCommit } = setupInt(2)
    edit(input, '5')
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith(5)
  })

  it('Enter seguido del blur no confirma dos veces', () => {
    const { input, onCommit } = setupInt(2)
    edit(input, '5')
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('aplica las clases is-editing e is-modified', () => {
    const onCommit = vi.fn()
    render(<EditableCell kind="money" value="100" modified ariaLabel="Precio" onCommit={onCommit} />)
    const input = screen.getByLabelText('Precio')
    expect(input).toHaveClass('ig-cell-edit', 'is-modified')
    expect(input).not.toHaveClass('is-editing')
    fireEvent.focus(input)
    expect(input).toHaveClass('is-editing')
  })

  it('es un input de texto con inputMode adecuado (sin spinners)', () => {
    const { input } = setupMoney()
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    document.body.innerHTML = ''
    expect(setupInt().input).toHaveAttribute('inputmode', 'numeric')
  })
})
