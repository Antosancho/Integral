import { render, screen } from '@testing-library/react'
import { Package } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  it('muestra título, descripción y acción', () => {
    render(
      <EmptyState
        icon={Package}
        title="Todavía no hay productos"
        description="Cargá el primero para empezar a vender."
        action={<button>Nuevo producto</button>}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Todavía no hay productos' })).toBeInTheDocument()
    expect(screen.getByText('Cargá el primero para empezar a vender.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeInTheDocument()
  })

  it('el tono danger tiñe el ícono con tokens de peligro', () => {
    const { container } = render(<EmptyState icon={Package} title="Error" tone="danger" />)
    expect(container.querySelector('.ico')!.getAttribute('style')).toContain('var(--danger)')
  })
})
