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
