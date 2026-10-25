import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SupplierPicker from '../SupplierPicker'

const listSuppliers = vi.fn()
const createSupplier = vi.fn()

beforeEach(() => {
  listSuppliers.mockReset().mockResolvedValue([{ id: 1, name: 'Distribuidora Sur', phone: null, notes: null }])
  createSupplier.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  ;(window as unknown as { api: unknown }).api = { listSuppliers, createSupplier }
})

describe('SupplierPicker', () => {
  it('carga los proveedores con la API al montar', async () => {
    render(<SupplierPicker id="prov" valueId={0} onChange={() => {}} />)
    await waitFor(() => expect(listSuppliers).toHaveBeenCalledTimes(1))
  })

  it('crear envía teléfono y notas (null si están vacíos) y selecciona el nuevo proveedor', async () => {
    createSupplier.mockResolvedValue({ id: 5, name: 'Nuevo', phone: '123', notes: null })
    const onChange = vi.fn()
    render(<SupplierPicker id="prov" valueId={0} onChange={onChange} />)
    await waitFor(() => expect(listSuppliers).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: /Proveedor/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /Buscar proveedor/ }), { target: { value: 'Nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear «Nuevo»' }))
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear y elegir' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(5))
    expect(createSupplier).toHaveBeenCalledWith({ name: 'Nuevo', phone: '123', notes: null })
  })

  it('un error de carga muestra el mensaje', async () => {
    listSuppliers.mockRejectedValue(new Error('boom'))
    render(<SupplierPicker id="prov" valueId={0} onChange={() => {}} />)
    expect(await screen.findByText('No pudimos cargar los proveedores.')).toBeInTheDocument()
  })
})
