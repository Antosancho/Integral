import { fireEvent, render, screen } from '@testing-library/react'
import { History } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { MenuButton } from '../MenuButton'

function setup(onSelectA = vi.fn(), onSelectB = vi.fn()) {
  render(
    <div>
      <MenuButton
        label="Más acciones"
        iconOnly
        items={[
          { id: 'a', label: 'Ver movimientos', icon: History, onSelect: onSelectA },
          { id: 'b', label: 'Cargar stock', onSelect: onSelectB, checked: true },
        ]}
      />
      <span>afuera</span>
    </div>,
  )
  return { onSelectA, onSelectB, trigger: screen.getByRole('button', { name: 'Más acciones' }) }
}

describe('MenuButton', () => {
  it('abre con click y muestra los ítems; el primero recibe el foco', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Ver movimientos' })).toHaveFocus()
    expect(screen.getByRole('menuitem', { name: 'Cargar stock' })).toBeInTheDocument()
  })

  it('↓ mueve el foco entre ítems', () => {
    const { trigger } = setup()
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: 'Cargar stock' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: 'Ver movimientos' })).toHaveFocus()
  })

  it('↓ sobre el botón cerrado abre el menú', () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Enter/click en un ítem ejecuta onSelect y cierra', () => {
    const { trigger, onSelectB } = setup()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cargar stock' }))
    expect(onSelectB).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Esc cierra y devuelve el foco al botón, sin propagarse', () => {
    const outerKeyDown = vi.fn()
    const onSelect = vi.fn()
    render(
      <div onKeyDown={outerKeyDown}>
        <MenuButton label="Menú" items={[{ id: 'a', label: 'Uno', onSelect }]} />
      </div>,
    )
    const trigger = screen.getByRole('button', { name: 'Menú' })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(outerKeyDown).not.toHaveBeenCalled()
  })

  it('click afuera cierra', () => {
    const { trigger } = setup()
    fireEvent.click(trigger)
    fireEvent.mouseDown(screen.getByText('afuera'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('muestra el texto del botón cuando no es iconOnly', () => {
    render(<MenuButton label="Filtrar por categoría" buttonText="Categoría: Todas" items={[]} />)
    expect(screen.getByRole('button', { name: 'Categoría: Todas' })).toBeInTheDocument()
  })
})
