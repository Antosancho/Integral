import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from '../Modal'
import { openModalCount } from '../modalStack'

describe('Modal', () => {
  it('open=false no renderiza nada', () => {
    render(
      <Modal open={false} title="Título" onClose={() => {}}>
        contenido
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('open muestra un dialog con nombre = título y subtítulo', () => {
    render(
      <Modal open title="Nuevo producto" subtitle="Los campos con * son obligatorios." onClose={() => {}}>
        contenido
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toBeInTheDocument()
    expect(screen.getByText('Los campos con * son obligatorios.')).toBeInTheDocument()
  })

  it('Escape llama onClose', () => {
    const onClose = vi.fn()
    render(
      <Modal open title="T" onClose={onClose}>
        <input aria-label="a" />
      </Modal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('con onEscape llama onEscape y no onClose', () => {
    const onClose = vi.fn()
    const onEscape = vi.fn()
    render(
      <Modal open title="T" onClose={onClose} onEscape={onEscape}>
        x
      </Modal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('click en el overlay cierra solo con closeOnOverlay', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal open title="T" onClose={onClose}>
        x
      </Modal>,
    )
    fireEvent.mouseDown(document.querySelector('.ig-overlay')!)
    expect(onClose).not.toHaveBeenCalled()

    rerender(
      <Modal open title="T" onClose={onClose} closeOnOverlay>
        x
      </Modal>,
    )
    fireEvent.mouseDown(document.querySelector('.ig-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click dentro del diálogo no cierra aunque haya closeOnOverlay', () => {
    const onClose = vi.fn()
    render(
      <Modal open title="T" onClose={onClose} closeOnOverlay>
        x
      </Modal>,
    )
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('el foco inicial va al primer input del cuerpo', async () => {
    render(
      <Modal open title="T" onClose={() => {}}>
        <input aria-label="primero" />
        <input aria-label="segundo" />
      </Modal>,
    )
    await waitFor(() => expect(screen.getByLabelText('primero')).toHaveFocus())
  })

  it('respeta initialFocusRef', async () => {
    const Harness = () => {
      const ref = { current: null as HTMLInputElement | null }
      return (
        <Modal open title="T" onClose={() => {}} initialFocusRef={ref}>
          <input aria-label="primero" />
          <input aria-label="segundo" ref={(el) => { ref.current = el }} />
        </Modal>
      )
    }
    render(<Harness />)
    await waitFor(() => expect(screen.getByLabelText('segundo')).toHaveFocus())
  })

  it('focus trap: Tab en el último va al primero y Shift+Tab en el primero va al último', async () => {
    render(
      <Modal open title="T" onClose={() => {}} footer={<button>Último</button>}>
        <input aria-label="campo" />
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: 'Cerrar' })
    const last = screen.getByRole('button', { name: 'Último' })

    last.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(close).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('al cerrar, el foco vuelve al botón que lo abrió', async () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Abrir</button>
          <Modal open={open} title="T" onClose={() => setOpen(false)}>
            <input aria-label="campo" />
          </Modal>
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    opener.focus()
    fireEvent.click(opener)
    await waitFor(() => expect(screen.getByLabelText('campo')).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('openModalCount() vale 1 con el modal abierto y 0 al cerrarlo', () => {
    const { rerender } = render(
      <Modal open title="T" onClose={() => {}}>
        x
      </Modal>,
    )
    expect(openModalCount()).toBe(1)
    rerender(
      <Modal open={false} title="T" onClose={() => {}}>
        x
      </Modal>,
    )
    expect(openModalCount()).toBe(0)
  })

  it('modal anidado: Escape en el interno cierra solo el interno', () => {
    const outerClose = vi.fn()
    const innerClose = vi.fn()
    render(
      <Modal open title="Externo" onClose={outerClose}>
        <Modal open title="Interno" size="sm" onClose={innerClose}>
          <input aria-label="interno" />
        </Modal>
      </Modal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Interno' }), { key: 'Escape' })
    expect(innerClose).toHaveBeenCalledTimes(1)
    expect(outerClose).not.toHaveBeenCalled()
    expect(openModalCount()).toBe(2)
  })

  it('muestra atajos y footer en el pie', () => {
    render(
      <Modal open title="T" onClose={() => {}} shortcuts={[{ keys: ['Esc'], label: 'Cancelar' }]} footer={<button>Guardar</button>}>
        x
      </Modal>,
    )
    expect(screen.getByText(/Cancelar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('hideCloseButton oculta la X', () => {
    render(
      <Modal open title="T" onClose={() => {}} hideCloseButton>
        x
      </Modal>,
    )
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
  })
})
