import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GeneralAmountPopup from '../GeneralAmountPopup'

describe('GeneralAmountPopup', () => {
  it('con open=false no renderiza nada', () => {
    render(<GeneralAmountPopup open={false} onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('con open=true renderiza el título y el input', () => {
    render(<GeneralAmountPopup open={true} onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Monto general' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('escribir "500" + Enter llama onConfirm("500") y onClose()', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={onClose} onConfirm={onConfirm} />)
    await user.type(screen.getByRole('textbox'), '500{Enter}')
    expect(onConfirm).toHaveBeenCalledWith('500')
    expect(onClose).toHaveBeenCalled()
  })

  it('escribir "150,50" + Enter normaliza a punto y llama onConfirm("150.50")', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={() => {}} onConfirm={onConfirm} />)
    await user.type(screen.getByRole('textbox'), '150,50{Enter}')
    expect(onConfirm).toHaveBeenCalledWith('150.50')
  })

  it('escribir "" + Enter no llama onConfirm ni onClose, muestra error', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={onClose} onConfirm={onConfirm} />)
    await user.type(screen.getByRole('textbox'), '{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Ingresá un monto')).toBeInTheDocument()
  })

  it('escribir "-5" + Enter no llama onConfirm, muestra error', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={() => {}} onConfirm={onConfirm} />)
    await user.type(screen.getByRole('textbox'), '-5{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Ingresá un monto positivo')).toBeInTheDocument()
  })

  it('escribir "abc" + Enter no llama onConfirm, muestra error', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={() => {}} onConfirm={onConfirm} />)
    await user.type(screen.getByRole('textbox'), 'abc{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Ingresá un monto positivo')).toBeInTheDocument()
  })

  it('escribir "150.50" + Enter llama onConfirm("150.50")', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={() => {}} onConfirm={onConfirm} />)
    await user.type(screen.getByRole('textbox'), '150.50{Enter}')
    expect(onConfirm).toHaveBeenCalledWith('150.50')
  })

  it('Escape llama onClose sin llamar onConfirm', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={onClose} onConfirm={onConfirm} />)
    await user.type(screen.getByRole('textbox'), '{Escape}')
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('al pasar open=false a true, el input arranca vacío y sin error', () => {
    const { rerender } = render(
      <GeneralAmountPopup open={false} onClose={() => {}} onConfirm={() => {}} />
    )
    rerender(<GeneralAmountPopup open={true} onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.queryByText(/ingres/i)).not.toBeInTheDocument()
  })

  it('click en overlay llama onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<GeneralAmountPopup open={true} onClose={onClose} onConfirm={() => {}} />)
    const overlay = document.querySelector('.search-popup__overlay') as HTMLElement
    await user.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })
})