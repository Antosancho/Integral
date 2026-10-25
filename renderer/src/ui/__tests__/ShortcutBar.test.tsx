import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShortcutBar } from '../ShortcutBar'

describe('ShortcutBar', () => {
  it('renderiza un span por atajo con su etiqueta', () => {
    const { container } = render(
      <ShortcutBar items={[{ keys: ['↑', '↓'], label: 'Elegir' }, { keys: ['Esc'], label: 'Cerrar' }]} />,
    )
    expect(container.querySelector('.ig-shortcuts')).toBeInTheDocument()
    expect(container.querySelectorAll('.ig-shortcuts > span')).toHaveLength(2)
    expect(screen.getByText(/Elegir/)).toBeInTheDocument()
    expect(container.querySelectorAll('.ig-kbd')).toHaveLength(3)
  })

  it('une las teclas de una combinación con "+"', () => {
    const { container } = render(<ShortcutBar items={[{ keys: ['Ctrl', 'Enter'], label: 'Guardar' }]} />)
    expect(container.querySelector('.ig-shortcuts > span')!.textContent).toBe('Ctrl+Enter Guardar')
  })
})
