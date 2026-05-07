import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, beforeEach, vi, expect } from 'vitest'
import type { SupplierFromApi } from '../../../electron-api'
import SupplierSelector from '../SupplierSelector'

const mockSuppliers: SupplierFromApi[] = [
  { id: 1, name: 'ProvA', phone: null, notes: null },
  { id: 2, name: 'ProvB', phone: '1234', notes: null }
]

beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    listSuppliers: vi.fn(),
    createSupplier: vi.fn()
  }
})

describe('SupplierSelector', () => {
  it('Muestra "Cargando proveedores..." mientras la promesa no resolvió', () => {
    // Promesa que nunca se resuelve: simula carga en progreso
    ;(window as any).api.listSuppliers.mockReturnValue(new Promise(() => {}))
    render(<SupplierSelector value={0} onChange={vi.fn()} />)
    expect(screen.getByText('Cargando proveedores...')).toBeInTheDocument()
  })

  it('Muestra los proveedores cargados en el select', async () => {
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    render(<SupplierSelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByText('ProvA')).toBeInTheDocument()
    expect(screen.getByText('ProvB')).toBeInTheDocument()
  })

  it('Seleccionar un proveedor llama onChange con su id', async () => {
    const onChange = vi.fn()
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    render(<SupplierSelector value={0} onChange={onChange} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '2')
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('Seleccionar "+ Nuevo proveedor..." cambia a modo create', async () => {
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    render(<SupplierSelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    // El input de nombre debe aparecer
    expect(screen.getByPlaceholderText('Nombre')).toBeInTheDocument()
  })

  it('Cancelar en modo create vuelve al select y llama onChange(0)', async () => {
    const onChange = vi.fn()
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    render(<SupplierSelector value={0} onChange={onChange} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    await userEvent.click(screen.getByText('Cancelar'))
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('Crear con nombre vacío muestra error y no llama createSupplier', async () => {
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    render(<SupplierSelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    await userEvent.click(screen.getByText('Crear'))
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument()
    expect((window as any).api.createSupplier).not.toHaveBeenCalled()
  })

  it('Crear proveedor con solo nombre envía phone y notes como null', async () => {
    const onChange = vi.fn()
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    ;(window as any).api.createSupplier.mockResolvedValue({ id: 10, name: 'NuevoProv', phone: null, notes: null })
    render(<SupplierSelector value={0} onChange={onChange} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    await userEvent.type(screen.getByPlaceholderText('Nombre'), 'NuevoProv')
    await userEvent.click(screen.getByText('Crear'))
    await waitFor(() => expect((window as any).api.createSupplier).toHaveBeenCalled())
    expect((window as any).api.createSupplier).toHaveBeenCalledWith({
      name: 'NuevoProv',
      phone: null,
      notes: null
    })
    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('Crear proveedor con todos los campos envía phone y notes correctamente', async () => {
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    ;(window as any).api.createSupplier.mockResolvedValue({ id: 11, name: 'ProvFull', phone: '11-1234-5678', notes: 'Mayorista' })
    render(<SupplierSelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    await userEvent.type(screen.getByPlaceholderText('Nombre'), 'ProvFull')
    await userEvent.type(screen.getByPlaceholderText('Teléfono (opcional)'), '11-1234-5678')
    await userEvent.type(screen.getByPlaceholderText('Notas (opcional)'), 'Mayorista')
    await userEvent.click(screen.getByText('Crear'))
    await waitFor(() => expect((window as any).api.createSupplier).toHaveBeenCalled())
    expect((window as any).api.createSupplier).toHaveBeenCalledWith({
      name: 'ProvFull',
      phone: '11-1234-5678',
      notes: 'Mayorista'
    })
  })

  it('Error del API al crear muestra createError', async () => {
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    ;(window as any).api.createSupplier.mockRejectedValue(new Error('Fallo al crear'))
    render(<SupplierSelector value={0} onChange={vi.fn()} />)
    await waitFor(() => screen.getByRole('combobox'))
    await userEvent.selectOptions(screen.getByRole('combobox'), '-1')
    await userEvent.type(screen.getByPlaceholderText('Nombre'), 'Algo')
    await userEvent.click(screen.getByText('Crear'))
    await waitFor(() => screen.getByText('Fallo al crear'))
    expect(screen.getByText('Fallo al crear')).toBeInTheDocument()
  })

  it('Prop error se muestra debajo del select', async () => {
    ;(window as any).api.listSuppliers.mockResolvedValue(mockSuppliers)
    render(<SupplierSelector value={0} onChange={vi.fn()} error="Seleccioná un proveedor" />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByText('Seleccioná un proveedor')).toBeInTheDocument()
  })
})
