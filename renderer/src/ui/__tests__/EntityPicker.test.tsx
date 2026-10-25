import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EntityPicker } from '../EntityPicker'
import type { Entity } from '../EntityPicker'

const ITEMS: Entity[] = [
  { id: 1, name: 'Almacén' },
  { id: 2, name: 'Bebidas frías' },
  { id: 3, name: 'Limpieza' },
]

type Overrides = Partial<React.ComponentProps<typeof EntityPicker>>

function setup(overrides: Overrides = {}) {
  const onChange = vi.fn()
  const onCreate = vi.fn(async (name: string): Promise<Entity> => ({ id: 99, name }))
  const utils = render(
    <div>
      <EntityPicker
        id="categoria"
        label="Categoría"
        required
        entityName="categoría"
        items={ITEMS}
        valueId={0}
        onChange={onChange}
        onCreate={onCreate}
        {...overrides}
      />
      <span>afuera</span>
    </div>,
  )
  const trigger = () => screen.getByRole('button', { name: /^Categoría/ })
  return { ...utils, onChange, onCreate, trigger }
}

const searchBox = () => screen.getByRole('textbox', { name: /Buscar categoría/ })

/** happy-dom no hace layout: se fija el tamaño de la ventana y el rectángulo del disparador a mano. */
function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}
function makeRect(r: { top: number; left: number; width: number; height: number }): DOMRect {
  return { ...r, bottom: r.top + r.height, right: r.left + r.width, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect
}
function mockRect(el: HTMLElement, r: { top: number; left: number; width: number; height: number }) {
  return vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(makeRect(r))
}
const popover = () => screen.getByRole('dialog', { name: /^Elegir/ })

describe('EntityPicker', () => {
  it('muestra el placeholder sin selección y el nombre con valueId', () => {
    const { unmount } = setup()
    expect(screen.getByText('Elegí o creá una categoría')).toBeInTheDocument()
    unmount()
    setup({ valueId: 2 })
    expect(screen.getByText('Bebidas frías')).toBeInTheDocument()
  })

  it('click abre, el buscador recibe foco y lista todos los ítems', async () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    await waitFor(() => expect(searchBox()).toHaveFocus())
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('tipear filtra y resalta la coincidencia en negrita', () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'alm' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(document.querySelector('.ig-picker-list b')).toHaveTextContent('Alm')
  })

  it('↓ + Enter elige el segundo ítem y cierra', () => {
    const { trigger, onChange } = setup()
    fireEvent.click(trigger())
    fireEvent.keyDown(searchBox(), { key: 'ArrowDown' })
    fireEvent.keyDown(searchBox(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger()).toHaveFocus()
  })

  it('click en un ítem lo elige', () => {
    const { trigger, onChange } = setup()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('option', { name: 'Limpieza' }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('sin coincidencias muestra el mensaje y Enter abre el alta con el nombre precargado', async () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'xyz' } })
    expect(screen.getByText('No hay categorías con «xyz»')).toBeInTheDocument()
    fireEvent.keyDown(searchBox(), { key: 'Enter' })
    expect(screen.getByText('Nueva categoría')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('xyz')
  })

  it('"Crear y elegir" llama onCreate(nombre, undefined) y luego onChange con el nuevo id', async () => {
    const { trigger, onCreate, onChange } = setup()
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'Bebidas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «Bebidas»' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear y elegir' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(99))
    expect(onCreate).toHaveBeenCalledWith('Bebidas', undefined)
  })

  it('un nombre repetido (sin importar tildes/mayúsculas) muestra error y no llama onCreate', async () => {
    const { trigger, onCreate } = setup()
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'almacen' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «almacen»' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear y elegir' }))
    expect(await screen.findByText('Ya existe «Almacén». Elegilo de la lista.')).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('nombre vacío en el alta muestra "Ingresá un nombre."', () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «x»' }))
    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear y elegir' }))
    expect(screen.getByText('Ingresá un nombre.')).toBeInTheDocument()
  })

  it('proveedor con campos extra envía teléfono y notas', async () => {
    const onChange = vi.fn()
    const onCreate = vi.fn(async (name: string): Promise<Entity> => ({ id: 50, name }))
    render(
      <EntityPicker
        id="prov"
        label="Proveedor"
        entityName="proveedor"
        items={[]}
        valueId={0}
        onChange={onChange}
        onCreate={onCreate}
        withExtraFields
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Proveedor/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /Buscar proveedor/ }), { target: { value: 'Distri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «Distri»' }))
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear y elegir' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Distri', { phone: '123', notes: 'x' }))
    expect(onChange).toHaveBeenCalledWith(50)
  })

  it('un error de onCreate muestra el mensaje y deja abierto el alta', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onCreate = vi.fn().mockRejectedValue(new Error('boom'))
    const { trigger } = setup({ onCreate })
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'Nueva' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «Nueva»' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear y elegir' }))
    expect(await screen.findByText('No se pudo crear. Probá de nuevo.')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('Esc cierra el popover, devuelve el foco al disparador y no llega al contenedor padre', () => {
    const outer = vi.fn()
    render(
      <div onKeyDown={outer}>
        <EntityPicker id="c2" label="Cat" entityName="categoría" items={ITEMS} valueId={0} onChange={() => {}} onCreate={vi.fn()} />
      </div>,
    )
    const trigger = screen.getByRole('button', { name: /Cat/ })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('textbox', { name: /Buscar categoría/ }), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(outer).not.toHaveBeenCalled()
  })

  it('Esc dentro del alta vuelve a la lista sin cerrar el popover', () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'zzz' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «zzz»' }))
    fireEvent.keyDown(screen.getByLabelText(/^Nombre/), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Nueva categoría')).not.toBeInTheDocument()
  })

  it('Enter dentro del popover no se propaga al formulario', () => {
    const outer = vi.fn()
    render(
      <div onKeyDown={outer}>
        <EntityPicker id="c3" label="Cat" entityName="categoría" items={ITEMS} valueId={0} onChange={() => {}} onCreate={vi.fn()} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Cat/ }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: /Buscar categoría/ }), { key: 'Enter' })
    expect(outer).not.toHaveBeenCalled()
  })

  it('click afuera cierra', () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.mouseDown(screen.getByText('afuera'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('muestra el error del campo', () => {
    setup({ error: 'Elegí o creá una categoría.' })
    expect(screen.getByText('Elegí o creá una categoría.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Categoría/ })).toHaveAttribute('aria-invalid', 'true')
  })

  it('↓ sobre el disparador cerrado abre el popover', () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('EntityPicker — popover flotante', () => {
  it('el popover flota: position fixed debajo del disparador, 420 px de ancho y alto máximo según el espacio', () => {
    setViewport(1280, 690)
    const { trigger } = setup()
    mockRect(trigger(), { top: 100, left: 200, width: 246, height: 40 })
    fireEvent.click(trigger())
    const pop = popover()
    expect(pop).toHaveClass('ig-picker-pop', 'is-floating')
    expect(pop.style.position).toBe('fixed')
    expect(pop.style.top).toBe('144px')
    expect(pop.style.bottom).toBe('auto')
    expect(pop.style.left).toBe('200px')
    expect(pop.style.width).toBe('420px')
    expect(pop.style.maxHeight).toBe('538px')
  })

  it('si no entra a la derecha, se alinea con el borde derecho del disparador', () => {
    setViewport(1280, 690)
    const { trigger } = setup()
    mockRect(trigger(), { top: 100, left: 1000, width: 246, height: 40 })
    fireEvent.click(trigger())
    expect(popover().style.left).toBe('826px')
  })

  it('si no hay lugar abajo, abre hacia arriba', () => {
    setViewport(1280, 690)
    const { trigger } = setup()
    mockRect(trigger(), { top: 560, left: 200, width: 246, height: 40 })
    fireEvent.click(trigger())
    const pop = popover()
    expect(pop.style.top).toBe('auto')
    expect(pop.style.bottom).toBe('134px')
    expect(pop.style.maxHeight).toBe('548px')
  })

  it('sigue al disparador cuando la ventana cambia de tamaño o scrollea un contenedor', () => {
    setViewport(1280, 690)
    const { trigger } = setup()
    const spy = mockRect(trigger(), { top: 100, left: 200, width: 246, height: 40 })
    fireEvent.click(trigger())
    spy.mockReturnValue(makeRect({ top: 300, left: 10, width: 246, height: 40 }))
    fireEvent(window, new Event('resize'))
    expect(popover().style.top).toBe('344px')
    expect(popover().style.left).toBe('10px')
    spy.mockReturnValue(makeRect({ top: 310, left: 10, width: 246, height: 40 }))
    fireEvent.scroll(document.body)
    expect(popover().style.top).toBe('354px')
  })

  it('el scroll de la propia lista no recalcula la posición', () => {
    setViewport(1280, 690)
    const { trigger } = setup()
    const spy = mockRect(trigger(), { top: 100, left: 200, width: 246, height: 40 })
    fireEvent.click(trigger())
    spy.mockReturnValue(makeRect({ top: 300, left: 200, width: 246, height: 40 }))
    fireEvent.scroll(document.querySelector('.ig-picker-list')!)
    expect(popover().style.top).toBe('144px')
  })

  it('el popover sigue dentro del árbol del picker (no es un portal) y un mousedown adentro no lo cierra', () => {
    setViewport(1280, 690)
    const { container, trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.mouseDown(searchBox())
    expect(container.contains(popover())).toBe(true)
    expect(document.body.contains(popover())).toBe(true)
  })

  it('Tab en la lista cierra el popover', () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.keyDown(searchBox(), { key: 'Tab' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Tab dentro del alta no cierra el popover', () => {
    const { trigger } = setup()
    fireEvent.click(trigger())
    fireEvent.change(searchBox(), { target: { value: 'zzz' } })
    fireEvent.click(screen.getByRole('button', { name: /Crear «zzz»/ }))
    fireEvent.keyDown(screen.getByLabelText(/^Nombre/), { key: 'Tab' })
    expect(popover()).toBeInTheDocument()
    expect(screen.getByText('Nueva categoría')).toBeInTheDocument()
  })
})
