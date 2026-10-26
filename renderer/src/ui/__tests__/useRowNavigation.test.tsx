import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRowNavigation } from '../useRowNavigation'

const KEYS = [10, 20, 30]

function Harness({ keys = KEYS, onActivate }: { keys?: number[]; onActivate?: (k: number) => void }) {
  const [active, setActive] = useState<number | null>(null)
  const onKeyDown = useRowNavigation({
    keys,
    activeKey: active,
    setActiveKey: setActive,
    onActivate,
    rowDomId: (k) => `row-${k}`,
  })
  return (
    <div role="grid" tabIndex={0} aria-label="grid" data-active={active ?? ''} onKeyDown={onKeyDown}>
      {keys.map((k) => (
        <div key={k} id={`row-${k}`} />
      ))}
    </div>
  )
}

const activeOf = () => screen.getByRole('grid').getAttribute('data-active')

describe('useRowNavigation', () => {
  it('↓ sin fila activa selecciona la primera', () => {
    render(<Harness />)
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' })
    expect(activeOf()).toBe('10')
  })

  it('↓ avanza y se queda en la última', () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    for (let i = 0; i < 5; i++) fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(activeOf()).toBe('30')
  })

  it('↑ retrocede y se queda en la primera', () => {
    render(<Harness />)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'End' })
    fireEvent.keyDown(grid, { key: 'ArrowUp' })
    expect(activeOf()).toBe('20')
    fireEvent.keyDown(grid, { key: 'Home' })
    fireEvent.keyDown(grid, { key: 'ArrowUp' })
    expect(activeOf()).toBe('10')
  })

  it('End va a la última fila', () => {
    render(<Harness />)
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'End' })
    expect(activeOf()).toBe('30')
  })

  it('Enter llama onActivate con la fila activa', () => {
    const onActivate = vi.fn()
    render(<Harness onActivate={onActivate} />)
    const grid = screen.getByRole('grid')
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    fireEvent.keyDown(grid, { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(10)
  })

  it('Enter sin fila activa no hace nada', () => {
    const onActivate = vi.fn()
    render(<Harness onActivate={onActivate} />)
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'Enter' })
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('con lista vacía no hace nada', () => {
    render(<Harness keys={[]} />)
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'ArrowDown' })
    expect(activeOf()).toBe('')
  })
})
