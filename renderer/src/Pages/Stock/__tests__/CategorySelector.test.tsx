import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { CategoryFromApi } from '../../../electron-api'
import CategorySelector from '../CategorySelector'

const mockCategories: CategoryFromApi[] = [
  { id: 1, name: 'Lácteos' },
  { id: 2, name: 'Bebidas' }
]

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listCategories: vi.fn(),
    createCategory: vi.fn()
  }
})

describe('CategorySelector', () => {
  it('Muestra "Cargando categorías..." mientras la promesa no resolvió', () => {
    // Promesa que nunca se resuelve: simula carga en progreso
    ;(window as any).api.listCategories.mockReturnValue(new Promise(() => {}))
    render(<CategorySelector value={0} onChange={vi.fn()} />)
    expect(screen.getByText('Cargando categorías...')).toBeInTheDocument()
  })

  it('Muestra las categorías cargadas en el select', async () => {
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    render(<CategorySelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByText('Lácteos')).toBeInTheDocument()
    expect(screen.getByText('Bebidas')).toBeInTheDocument()
  })

  it('Seleccionar una categoría llama onChange con el id correcto', async () => {
    const onChange = vi.fn()
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    render(<CategorySelector value={0} onChange={onChange} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '2')
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('Seleccionar "+ Nueva categoría..." cambia a modo create', async () => {
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    render(<CategorySelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    expect(screen.getByPlaceholderText('Nombre de la categoría')).toBeInTheDocument()
  })

  it('Cancelar en modo create vuelve al select y llama onChange(0)', async () => {
    const onChange = vi.fn()
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    render(<CategorySelector value={0} onChange={onChange} />)
    await waitFor(() => screen.getByRole('combobox'))
    // Entrar a modo create
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    // Click en Cancelar
    await userEvent.click(screen.getByText('Cancelar'))
    // El select vuelve a ser visible
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('Crear con nombre vacío muestra error y no llama createCategory', async () => {
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    render(<CategorySelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    // Dejar input vacío y hacer click en Crear
    await userEvent.click(screen.getByText('Crear'))
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument()
    expect((window as any).api.createCategory).not.toHaveBeenCalled()
  })

  it('Crear categoría exitosa llama onChange con el nuevo id y vuelve al select', async () => {
    const onChange = vi.fn()
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    ;(window as any).api.createCategory.mockResolvedValue({ id: 99, name: 'Nueva Cat' })
    render(<CategorySelector value={0} onChange={onChange} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    await userEvent.type(screen.getByPlaceholderText('Nombre de la categoría'), 'Nueva Cat')
    await userEvent.click(screen.getByText('Crear'))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(99))
    // El select vuelve a ser visible
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('Error del API al crear muestra el createError', async () => {
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    ;(window as any).api.createCategory.mockRejectedValue(new Error('DB error'))
    render(<CategorySelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    await userEvent.type(screen.getByPlaceholderText('Nombre de la categoría'), 'Algo')
    await userEvent.click(screen.getByText('Crear'))
    await waitFor(() => screen.getByText('DB error'))
    expect(screen.getByText('DB error')).toBeInTheDocument()
  })

  it('Prop error se muestra debajo del select', async () => {
    ;(window as any).api.listCategories.mockResolvedValue(mockCategories)
    render(<CategorySelector value={0} onChange={vi.fn()} error="Seleccioná una categoría" />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByText('Seleccioná una categoría')).toBeInTheDocument()
  })
})
