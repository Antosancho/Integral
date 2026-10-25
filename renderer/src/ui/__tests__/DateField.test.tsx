import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateField } from '../DateField'

describe('DateField', () => {
  it('tiene el placeholder DD/MM/AAAA y el label asociado', () => {
    render(<DateField id="venc" label="Vencimiento" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Vencimiento')).toHaveAttribute('placeholder', 'DD/MM/AAAA')
  })

  it('tipear dígitos llama onChange con la máscara aplicada', () => {
    const onChange = vi.fn()
    render(<DateField id="venc" label="Vencimiento" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Vencimiento'), { target: { value: '24102026' } })
    expect(onChange).toHaveBeenCalledWith('24/10/2026')
  })

  it('muestra el error y marca el input como inválido', () => {
    render(<DateField id="venc" label="Vencimiento" value="31/02/2026" onChange={() => {}} error="Revisá la fecha (DD/MM/AAAA)." />)
    const input = screen.getByLabelText('Vencimiento')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'venc-error')
    expect(screen.getByText('Revisá la fecha (DD/MM/AAAA).')).toBeInTheDocument()
  })
})
