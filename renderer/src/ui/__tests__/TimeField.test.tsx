import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeField } from '../TimeField'

describe('TimeField', () => {
  it('es un input de texto con máscara y label asociado', () => {
    render(<TimeField id="t" label="Abre" value="" onChange={() => {}} />)
    const input = screen.getByLabelText('Abre')
    expect(input).toHaveAttribute('placeholder', 'HH:MM')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('maxlength', '5')
  })

  it('onChange recibe el texto enmascarado', () => {
    const onChange = vi.fn()
    render(<TimeField id="t" label="Abre" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Abre'), { target: { value: '0800' } })
    expect(onChange).toHaveBeenCalledWith('08:00')
  })

  it('con error: aria-invalid, aria-describedby y texto visible', () => {
    render(<TimeField id="t" label="Abre" value="25:00" onChange={() => {}} error="Ingresá una hora entre 00:00 y 23:59." />)
    const input = screen.getByLabelText('Abre')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 't-error')
    expect(screen.getByText('Ingresá una hora entre 00:00 y 23:59.')).toBeInTheDocument()
  })

  it('con ayuda y sin error: aria-describedby apunta a la ayuda', () => {
    render(<TimeField id="t" label="Abre" value="" onChange={() => {}} help="HH:MM" />)
    expect(screen.getByLabelText('Abre')).toHaveAttribute('aria-describedby', 't-help')
  })

  it('reenvía onKeyDown', () => {
    const onKeyDown = vi.fn()
    render(<TimeField id="t" label="Abre" value="" onChange={() => {}} onKeyDown={onKeyDown} />)
    fireEvent.keyDown(screen.getByLabelText('Abre'), { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})
