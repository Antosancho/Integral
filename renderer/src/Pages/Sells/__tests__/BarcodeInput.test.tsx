import { createRef } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BarcodeInput from '../BarcodeInput'
import type { BarcodeInputHandle } from '../BarcodeInput'

const input = () => screen.getByLabelText('Código de barras') as HTMLInputElement

describe('BarcodeInput', () => {
  it('Enter con onScan → true limpia el input', async () => {
    const onScan = vi.fn().mockResolvedValue(true)
    render(<BarcodeInput onScan={onScan} onArrowDown={() => {}} />)
    fireEvent.change(input(), { target: { value: '7790070000005' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onScan).toHaveBeenCalledWith('7790070000005')
    await waitFor(() => expect(input().value).toBe(''))
  })

  it('Enter con onScan → false conserva el texto y lo selecciona', async () => {
    const onScan = vi.fn().mockResolvedValue(false)
    render(<BarcodeInput onScan={onScan} onArrowDown={() => {}} />)
    fireEvent.change(input(), { target: { value: '999' } })
    const select = vi.spyOn(input(), 'select')
    fireEvent.keyDown(input(), { key: 'Enter' })
    await waitFor(() => expect(select).toHaveBeenCalled())
    expect(input().value).toBe('999')
  })

  it('Enter con el input vacío o en blanco no llama a onScan', () => {
    const onScan = vi.fn()
    render(<BarcodeInput onScan={onScan} onArrowDown={() => {}} />)
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.change(input(), { target: { value: '   ' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onScan).not.toHaveBeenCalled()
  })

  it('recorta espacios del código antes de escanear', () => {
    const onScan = vi.fn().mockResolvedValue(true)
    render(<BarcodeInput onScan={onScan} onArrowDown={() => {}} />)
    fireEvent.change(input(), { target: { value: '  123  ' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onScan).toHaveBeenCalledWith('123')
  })

  it('muestra "Listo para escanear" con foco y el aviso sin foco', async () => {
    render(<BarcodeInput onScan={vi.fn()} onArrowDown={() => {}} />)
    input().focus()
    await waitFor(() => expect(screen.getByText('Listo para escanear')).toBeInTheDocument())
    expect(input().closest('.ig-scan')).toHaveClass('is-focus')

    input().blur()
    await waitFor(() => expect(screen.getByText('Hacé click acá o tocá Esc para escanear')).toBeInTheDocument())
    expect(input().closest('.ig-scan')).toHaveClass('is-idle')
  })

  it('↓ llama onArrowDown', () => {
    const onArrowDown = vi.fn()
    render(<BarcodeInput onScan={vi.fn()} onArrowDown={onArrowDown} />)
    fireEvent.keyDown(input(), { key: 'ArrowDown' })
    expect(onArrowDown).toHaveBeenCalledTimes(1)
  })

  it('expone focus() por ref', () => {
    const ref = createRef<BarcodeInputHandle>()
    render(<BarcodeInput ref={ref} onScan={vi.fn()} onArrowDown={() => {}} />)
    input().blur()
    ref.current!.focus()
    expect(input()).toHaveFocus()
  })

  it('tiene el placeholder del design system', () => {
    render(<BarcodeInput onScan={vi.fn()} onArrowDown={() => {}} />)
    expect(input()).toHaveAttribute('placeholder', 'Escaneá o escribí un código de barras')
  })
})
