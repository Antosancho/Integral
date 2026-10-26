import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../Button'

describe('Button', () => {
  it('por defecto es secundario, mediano y type="button"', () => {
    render(<Button>Guardar</Button>)
    const btn = screen.getByRole('button', { name: 'Guardar' })
    expect(btn).toHaveClass('ig-btn', 'ig-btn-secondary')
    expect(btn).not.toHaveClass('ig-btn-md')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it.each([
    ['primary', 'ig-btn-primary'],
    ['ghost', 'ig-btn-ghost'],
    ['edit', 'ig-btn-edit'],
    ['danger', 'ig-btn-danger'],
  ] as const)('variante %s → %s', (variant, cls) => {
    render(<Button variant={variant}>X</Button>)
    expect(screen.getByRole('button')).toHaveClass(cls)
  })

  it.each([
    ['sm', 'ig-btn-sm'],
    ['lg', 'ig-btn-lg'],
    ['xl', 'ig-btn-xl'],
  ] as const)('tamaño %s → %s', (size, cls) => {
    render(<Button size={size}>X</Button>)
    expect(screen.getByRole('button')).toHaveClass(cls)
  })

  it('iconOnly agrega ig-btn-icon y el aria-label es el nombre', () => {
    render(<Button iconOnly icon={Plus} aria-label="Agregar" />)
    expect(screen.getByRole('button', { name: 'Agregar' })).toHaveClass('ig-btn-icon')
  })

  it('shortcut muestra el Kbd pero no forma parte del nombre accesible', () => {
    render(<Button shortcut="F2">Buscar</Button>)
    expect(screen.getByText('F2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument()
  })

  it('el ícono es decorativo (aria-hidden)', () => {
    const { container } = render(<Button icon={Plus}>Nuevo</Button>)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('disabled no dispara onClick', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>X</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('reenvía el ref al <button>', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>X</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
