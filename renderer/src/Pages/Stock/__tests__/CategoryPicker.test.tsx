import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CategoryPicker from '../CategoryPicker'

const listCategories = vi.fn()
const createCategory = vi.fn()

beforeEach(() => {
  listCategories.mockReset().mockResolvedValue([{ id: 1, name: 'Almacén' }])
  createCategory.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as unknown as { api: unknown }).api = { listCategories, createCategory }
})

describe('CategoryPicker', () => {
  it('carga las categorías con la API al montar', async () => {
    render(<CategoryPicker id="cat" valueId={0} onChange={() => {}} />)
    await waitFor(() => expect(listCategories).toHaveBeenCalledTimes(1))
  })

  it('muestra la categoría seleccionada una vez cargada', async () => {
    render(<CategoryPicker id="cat" valueId={1} onChange={() => {}} />)
    expect(await screen.findByText('Almacén')).toBeInTheDocument()
  })

  it('crear agrega la categoría a la lista y la selecciona', async () => {
    createCategory.mockResolvedValue({ id: 7, name: 'Bebidas' })
    const onChange = vi.fn()
    render(<CategoryPicker id="cat" valueId={0} onChange={onChange} />)
    await waitFor(() => expect(listCategories).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /Categoría/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /Buscar categoría/ }), { target: { value: 'Bebidas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «Bebidas»' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear y elegir' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(7))
    expect(createCategory).toHaveBeenCalledWith({ name: 'Bebidas' })
  })

  it('un error de carga muestra el mensaje', async () => {
    listCategories.mockRejectedValue(new Error('boom'))
    render(<CategoryPicker id="cat" valueId={0} onChange={() => {}} />)
    expect(await screen.findByText('No pudimos cargar las categorías.')).toBeInTheDocument()
  })

  it('el error de validación tiene prioridad sobre el de carga', async () => {
    render(<CategoryPicker id="cat" valueId={0} onChange={() => {}} error="Elegí o creá una categoría." />)
    expect(await screen.findByText('Elegí o creá una categoría.')).toBeInTheDocument()
  })
})
