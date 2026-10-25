import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppHeader from '../AppHeader'

const listExpiring = vi.fn()

beforeEach(() => {
  listExpiring.mockReset().mockResolvedValue([])
  ;(window as unknown as { api: unknown }).api = { listExpiringStockMovements: listExpiring }
})

describe('AppHeader', () => {
  it('muestra los botones Stock, Ventas y Estadísticas', async () => {
    render(<AppHeader section="stock" onNavigate={() => {}} />)
    await waitFor(() => expect(listExpiring).toHaveBeenCalled())
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(nav).toHaveTextContent('Stock')
    expect(screen.getByRole('button', { name: 'Ventas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Estadísticas' })).toBeInTheDocument()
  })

  it('la sección activa tiene aria-current="page"', async () => {
    render(<AppHeader section="sells" onNavigate={() => {}} />)
    await waitFor(() => expect(listExpiring).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Ventas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Stock' })).not.toHaveAttribute('aria-current')
  })

  it('click en "Ventas" llama onNavigate("sells")', async () => {
    const onNavigate = vi.fn()
    render(<AppHeader section="stock" onNavigate={onNavigate} />)
    await waitFor(() => expect(listExpiring).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Ventas' }))
    expect(onNavigate).toHaveBeenCalledWith('sells')
  })

  it('click en el logo llama onNavigate("stock")', async () => {
    const onNavigate = vi.fn()
    render(<AppHeader section="stats" onNavigate={onNavigate} />)
    await waitFor(() => expect(listExpiring).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Factor Integral/ }))
    expect(onNavigate).toHaveBeenCalledWith('stock')
  })

  it('no existe un botón "Historial" (vive dentro de Ventas)', async () => {
    render(<AppHeader section="stock" onNavigate={() => {}} />)
    await waitFor(() => expect(listExpiring).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /Historial/ })).not.toBeInTheDocument()
  })

  it('incluye el selector de tema', async () => {
    render(<AppHeader section="stock" onNavigate={() => {}} />)
    await waitFor(() => expect(listExpiring).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Activar tema/ })).toBeInTheDocument()
  })
})
