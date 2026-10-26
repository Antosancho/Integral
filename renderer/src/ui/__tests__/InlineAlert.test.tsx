import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InlineAlert } from '../InlineAlert'

describe('InlineAlert', () => {
  it('renderiza título, texto y acción', () => {
    render(
      <InlineAlert tone="danger" title="Hay 1 producto con stock negativo" action={<button>Cargar stock</button>}>
        Revisá las ventas.
      </InlineAlert>,
    )
    expect(screen.getByRole('status')).toHaveClass('ig-alert', 'ig-alert-danger')
    expect(screen.getByText('Hay 1 producto con stock negativo')).toBeInTheDocument()
    expect(screen.getByText('Revisá las ventas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargar stock' })).toBeInTheDocument()
  })

  it.each(['danger', 'warning', 'info', 'success'] as const)('tono %s con ícono decorativo', (tone) => {
    const { container } = render(<InlineAlert tone={tone} title="T" />)
    expect(container.querySelector('.ig-alert')).toHaveClass(`ig-alert-${tone}`)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
