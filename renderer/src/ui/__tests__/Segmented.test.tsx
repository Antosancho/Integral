import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Segmented } from '../Segmented'

const OPTIONS = [
  { value: 'a', label: 'Productos' },
  { value: 'b', label: 'Movimientos' },
  { value: 'c', label: 'Otros' },
]

describe('Segmented', () => {
  it('marca la opción seleccionada con aria-selected y deja un único tab-stop', () => {
    render(<Segmented ariaLabel="Vista" options={OPTIONS} value="b" onChange={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Vista' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Productos' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Productos' })).toHaveAttribute('tabindex', '-1')
  })

  it('click llama onChange con el valor', () => {
    const onChange = vi.fn()
    render(<Segmented ariaLabel="Vista" options={OPTIONS} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Movimientos' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('ArrowRight desde el primero selecciona el segundo y le pasa el foco', () => {
    const onChange = vi.fn()
    render(<Segmented ariaLabel="Vista" options={OPTIONS} value="a" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Productos' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toHaveFocus()
  })

  it('ArrowLeft desde el primero da la vuelta al último', () => {
    const onChange = vi.fn()
    render(<Segmented ariaLabel="Vista" options={OPTIONS} value="a" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Productos' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('c')
  })
})
