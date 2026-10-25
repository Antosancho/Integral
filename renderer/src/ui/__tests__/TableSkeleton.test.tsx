import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TableSkeleton } from '../TableSkeleton'
import { useDelayedFlag } from '../useDelayedFlag'

describe('useDelayedFlag', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('es false al inicio y true tras el delay si sigue activo', () => {
    const { result } = renderHook(() => useDelayedFlag(true))
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe(true)
  })

  it('si deja de estar activo antes del delay, nunca se enciende', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active), { initialProps: { active: true } })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    rerender({ active: false })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe(false)
  })

  it('se apaga cuando active vuelve a false', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active), { initialProps: { active: true } })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current).toBe(true)
    rerender({ active: false })
    expect(result.current).toBe(false)
  })
})

describe('TableSkeleton', () => {
  it('renderiza la cantidad de filas pedida y la etiqueta', () => {
    render(<TableSkeleton rows={3} cols={2} label="Cargando productos…" />)
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3)
    expect(screen.getByText('Cargando productos…')).toBeInTheDocument()
  })

  it('marca el contenedor como ocupado', () => {
    const { container } = render(<TableSkeleton />)
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true')
  })
})
