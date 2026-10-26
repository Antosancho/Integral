import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from '../Toast'
import type { ToastOptions } from '../Toast'

/** Componente de prueba: un botón por toast que se quiere disparar. */
function Trigger({ toasts }: { toasts: ToastOptions[] }) {
  const { show } = useToast()
  return (
    <>
      {toasts.map((t, i) => (
        <button key={i} onClick={() => show(t)}>
          show-{i}
        </button>
      ))}
    </>
  )
}

function setup(toasts: ToastOptions[]) {
  return render(
    <ToastProvider>
      <input aria-label="campo" />
      <Trigger toasts={toasts} />
    </ToastProvider>,
  )
}

const click = (i: number) => fireEvent.click(screen.getByText(`show-${i}`))
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('muestra título y detalle con role="status"', () => {
    setup([{ tone: 'danger', title: 'Producto no encontrado', detail: 'Código 999' }])
    click(0)
    expect(screen.getByText('Producto no encontrado')).toBeInTheDocument()
    expect(screen.getByText('Código 999')).toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('desaparece a los 4000 ms sin detalle', () => {
    setup([{ tone: 'info', title: 'Hola' }])
    click(0)
    advance(3999)
    expect(screen.getByText('Hola')).toBeInTheDocument()
    advance(1)
    expect(screen.queryByText('Hola')).not.toBeInTheDocument()
  })

  it('con detalle dura 6000 ms', () => {
    setup([{ tone: 'warning', title: 'Sin stock suficiente', detail: 'se agregó igual' }])
    click(0)
    advance(5999)
    expect(screen.getByText('Sin stock suficiente')).toBeInTheDocument()
    advance(1)
    expect(screen.queryByText('Sin stock suficiente')).not.toBeInTheDocument()
  })

  it('el mismo toast dos veces se fusiona con ×2 y reinicia el timer', () => {
    setup([{ tone: 'danger', title: 'Repetido' }])
    click(0)
    advance(3000)
    click(0)
    expect(screen.getAllByText('Repetido')).toHaveLength(1)
    expect(screen.getByText('×2')).toBeInTheDocument()
    advance(3999)
    expect(screen.getByText('Repetido')).toBeInTheDocument()
    advance(1)
    expect(screen.queryByText('Repetido')).not.toBeInTheDocument()
  })

  it('máximo 3 toasts: el más nuevo arriba y se descarta el más viejo', () => {
    setup([0, 1, 2, 3].map((n) => ({ tone: 'info' as const, title: `Toast ${n}` })))
    for (let i = 0; i < 4; i++) click(i)
    const titles = screen.getAllByRole('status').map((el) => el.textContent)
    expect(titles).toHaveLength(3)
    expect(titles[0]).toContain('Toast 3')
    expect(titles[2]).toContain('Toast 1')
    expect(screen.queryByText('Toast 0')).not.toBeInTheDocument()
  })

  it('no roba el foco', () => {
    let showFn: ((o: ToastOptions) => void) | undefined
    function Capture() {
      showFn = useToast().show
      return null
    }
    render(
      <ToastProvider>
        <input aria-label="campo" />
        <Capture />
      </ToastProvider>,
    )
    const input = screen.getByLabelText('campo')
    input.focus()
    act(() => showFn!({ tone: 'info', title: 'Aviso' }))
    expect(screen.getByText('Aviso')).toBeInTheDocument()
    expect(document.activeElement).toBe(input)
  })

  it('el hover pausa el cierre y al salir se reinicia completo', () => {
    setup([{ tone: 'info', title: 'Pausable' }])
    click(0)
    const toast = screen.getByText('Pausable').closest('.ig-toast')!
    advance(3000)
    fireEvent.mouseEnter(toast)
    advance(10000)
    expect(screen.getByText('Pausable')).toBeInTheDocument()
    fireEvent.mouseLeave(toast)
    advance(3999)
    expect(screen.getByText('Pausable')).toBeInTheDocument()
    advance(1)
    expect(screen.queryByText('Pausable')).not.toBeInTheDocument()
  })

  it('useToast fuera de ToastProvider lanza', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger toasts={[]} />)).toThrow('useToast fuera de ToastProvider')
    spy.mockRestore()
  })
})
