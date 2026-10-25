import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HourFilterBar, { type HourFilterBarProps } from '../HourFilterBar'

const W = { startMinute: 480, endMinute: 120 } // 08:00 → 02:00
const RANGE_ERR = 'Ingresá una hora entre 00:00 y 23:59.'
const INCOMPLETE_ERR = 'Completá la hora (HH:MM).'
const HELP = 'Completá las dos horas para aplicar el filtro.'

function setup(over: Partial<HourFilterBarProps> = {}) {
  const props: HourFilterBarProps = {
    mode: 'workday',
    onModeChange: vi.fn(),
    workday: W,
    onWorkdayChange: vi.fn(),
    customStart: '',
    customEnd: '',
    onCustomStartChange: vi.fn(),
    onCustomEndChange: vi.fn(),
    ...over
  }
  const utils = render(<HourFilterBar {...props} />)
  return { ...utils, props }
}

const openEditor = () => fireEvent.click(screen.getByRole('button', { name: 'Cambiar jornada' }))
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('HourFilterBar', () => {
  it('1. muestra las 3 pestañas y nada más con "Todo el día"', () => {
    setup({ mode: 'all' })
    const tabs = within(screen.getByRole('tablist', { name: 'Horario' })).getAllByRole('tab')
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Todo el día', 'Jornada laboral', 'Personalizado'])
    expect(screen.getByRole('tab', { name: 'Todo el día' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: 'Cambiar jornada' })).toBeNull()
    expect(screen.queryByLabelText('Desde hora')).toBeNull()
    expect(screen.queryByLabelText('Abre')).toBeNull()
  })

  it('2. cambiar de modo llama a onModeChange', () => {
    const { props } = setup({ mode: 'all' })
    fireEvent.click(screen.getByRole('tab', { name: 'Jornada laboral' }))
    expect(props.onModeChange).toHaveBeenCalledWith('workday')
  })

  it('3. jornada: descripción y botón', () => {
    setup()
    expect(screen.getByText('De 08:00 a 02:00 del día siguiente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar jornada' })).toBeInTheDocument()
  })

  it('4. abrir el editor precarga las horas y enfoca "Abre"', () => {
    setup()
    openEditor()
    expect(screen.getByLabelText('Abre')).toHaveValue('08:00')
    expect(screen.getByLabelText('Cierra')).toHaveValue('02:00')
    expect(screen.getByLabelText('Abre')).toHaveFocus()
  })

  it('5. guardar llama a onWorkdayChange, cierra el editor y devuelve el foco', () => {
    const { props } = setup()
    openEditor()
    type('Abre', '1000')
    type('Cierra', '0300')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jornada' }))
    expect(props.onWorkdayChange).toHaveBeenCalledTimes(1)
    expect(props.onWorkdayChange).toHaveBeenCalledWith({ startMinute: 600, endMinute: 180 })
    expect(screen.queryByLabelText('Abre')).toBeNull()
    expect(screen.getByRole('button', { name: 'Cambiar jornada' })).toHaveFocus()
  })

  it('6. hora fuera de rango muestra error y no guarda', () => {
    const { props } = setup()
    openEditor()
    type('Abre', '2500')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jornada' }))
    expect(screen.getByText(RANGE_ERR)).toBeInTheDocument()
    expect(screen.getByLabelText('Abre')).toHaveAttribute('aria-invalid', 'true')
    expect(props.onWorkdayChange).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Abre')).toBeInTheDocument()
  })

  it('7. hora incompleta muestra el error de completar', () => {
    const { props } = setup()
    openEditor()
    type('Cierra', '08')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jornada' }))
    expect(screen.getByText(INCOMPLETE_ERR)).toBeInTheDocument()
    expect(props.onWorkdayChange).not.toHaveBeenCalled()
  })

  it('8. el error se borra al tipear', () => {
    setup()
    openEditor()
    type('Abre', '2500')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar jornada' }))
    type('Abre', '0900')
    expect(screen.queryByText(RANGE_ERR)).toBeNull()
    expect(screen.getByLabelText('Abre')).toHaveAttribute('aria-invalid', 'false')
  })

  it('9. cancelar no guarda y devuelve el foco', () => {
    const { props } = setup()
    openEditor()
    type('Abre', '1000')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(props.onWorkdayChange).not.toHaveBeenCalled()
    expect(screen.getByText('De 08:00 a 02:00 del día siguiente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar jornada' })).toHaveFocus()
  })

  it('10. Enter guarda', () => {
    const { props } = setup()
    openEditor()
    type('Abre', '0900')
    fireEvent.keyDown(screen.getByLabelText('Cierra'), { key: 'Enter' })
    expect(props.onWorkdayChange).toHaveBeenCalledWith({ startMinute: 540, endMinute: 120 })
  })

  it('11. Esc cancela', () => {
    const { props } = setup()
    openEditor()
    fireEvent.keyDown(screen.getByLabelText('Abre'), { key: 'Escape' })
    expect(screen.queryByLabelText('Abre')).toBeNull()
    expect(props.onWorkdayChange).not.toHaveBeenCalled()
  })

  it('12. cambiar de modo cierra el editor', () => {
    const { rerender, props } = setup()
    openEditor()
    fireEvent.click(screen.getByRole('tab', { name: 'Todo el día' }))
    expect(props.onModeChange).toHaveBeenCalledWith('all')
    rerender(<HourFilterBar {...props} mode="workday" />)
    expect(screen.queryByLabelText('Abre')).toBeNull()
    expect(screen.getByText('De 08:00 a 02:00 del día siguiente')).toBeInTheDocument()
  })

  it('13. personalizado vacío', () => {
    setup({ mode: 'custom' })
    expect(screen.getByLabelText('Desde hora')).toHaveValue('')
    expect(screen.getByLabelText('Hasta hora')).toHaveValue('')
    expect(screen.getByText(HELP)).toBeInTheDocument()
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull()
  })

  it('14. personalizado aplica la máscara', () => {
    const { props } = setup({ mode: 'custom' })
    type('Desde hora', '2200')
    expect(props.onCustomStartChange).toHaveBeenCalledWith('22:00')
  })

  it.each([
    ['15. cruza medianoche', '22:00', '06:00', 'De 22:00 a 06:00 del día siguiente'],
    ['16. mismo día', '09:00', '13:00', 'De 09:00 a 13:00'],
    ['17. 24 h', '08:00', '08:00', 'De 08:00 a 08:00 del día siguiente (24 h)']
  ])('%s', (_name, start, end, text) => {
    setup({ mode: 'custom', customStart: start, customEnd: end })
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('18. personalizado fuera de rango marca el campo y pide completar', () => {
    setup({ mode: 'custom', customStart: '25:00', customEnd: '06:00' })
    expect(screen.getByText(RANGE_ERR)).toBeInTheDocument()
    expect(screen.getByLabelText('Desde hora')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText(HELP)).toBeInTheDocument()
  })

  it('19. personalizado incompleto no marca error', () => {
    setup({ mode: 'custom', customStart: '08', customEnd: '' })
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull()
  })
})
