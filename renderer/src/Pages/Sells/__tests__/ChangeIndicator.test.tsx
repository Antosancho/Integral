import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChangeIndicator from '../ChangeIndicator'

const block = (container: HTMLElement) => container.querySelector('.ig-change') as HTMLElement

describe('ChangeIndicator', () => {
  it('sin pagos y total 100 → "Falta cubrir $ 100,00" (is-due)', () => {
    const { container } = render(<ChangeIndicator paid={0} total={100} />)
    expect(block(container)).toHaveClass('is-due')
    expect(block(container).textContent?.replace(/\u00a0/g, ' ')).toBe('Falta cubrir$ 100,00')
  })

  it('pago exacto → is-exact con $ 0,00', () => {
    const { container } = render(<ChangeIndicator paid={1500} total={1500} />)
    expect(block(container)).toHaveClass('is-exact')
    expect(screen.getAllByText('Pago exacto').length).toBeGreaterThan(0)
    expect(screen.getByText('$ 0,00')).toBeInTheDocument()
  })

  it('pagó de más → is-return con el vuelto', () => {
    const { container } = render(<ChangeIndicator paid={20000} total={1500} />)
    expect(block(container)).toHaveClass('is-return')
    expect(screen.getByText('$ 18.500,00')).toBeInTheDocument()
  })

  it('cada estado lleva su ícono (decorativo)', () => {
    const { container, rerender } = render(<ChangeIndicator paid={0} total={100} />)
    expect(container.querySelector('.lucide-circle-alert')).not.toBeNull()
    rerender(<ChangeIndicator paid={100} total={100} />)
    expect(container.querySelector('.lucide-equal')).not.toBeNull()
    rerender(<ChangeIndicator paid={200} total={100} />)
    expect(container.querySelector('.lucide-hand-coins')).not.toBeNull()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('el bloque visible no es aria-live; el texto aparte para lectores solo trae la etiqueta', () => {
    const { container } = render(<ChangeIndicator paid={0} total={100} />)
    expect(block(container)).not.toHaveAttribute('aria-live')
    const sr = container.querySelector('.ig-sr') as HTMLElement
    expect(sr).toHaveAttribute('aria-live', 'polite')
    expect(sr.textContent).toBe('Falta cubrir')
  })

  it('una diferencia de medio centavo o menos cuenta como pago exacto', () => {
    const { container } = render(<ChangeIndicator paid={99.996} total={100} />)
    expect(block(container)).toHaveClass('is-exact')
  })
})
