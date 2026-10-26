import { render, screen } from '@testing-library/react'
import { Check } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { Badge } from '../Badge'

describe('Badge', () => {
  it.each(['neutral', 'danger', 'warning', 'success', 'info'] as const)('tono %s', (tone) => {
    render(<Badge tone={tone}>Texto</Badge>)
    expect(screen.getByText('Texto')).toHaveClass('ig-badge', `ig-badge-${tone}`)
  })

  it('muestra el ícono decorativo y el title', () => {
    const { container } = render(
      <Badge tone="success" icon={Check} title="Ayuda">
        Pagada
      </Badge>,
    )
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTitle('Ayuda')).toBeInTheDocument()
  })
})
