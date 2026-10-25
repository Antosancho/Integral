import { render, screen } from '@testing-library/react'
import { Banknote } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import StatCard from '../StatCard'

const base = { label: 'Ventas totales', icon: Banknote, value: '$ 50.000,00', comparedTo: 'vs. septiembre' }

describe('StatCard', () => {
  it('muestra etiqueta y valor', () => {
    render(<StatCard {...base} deltaPct={null} />)
    expect(screen.getByText('Ventas totales')).toBeInTheDocument()
    expect(screen.getByText('$ 50.000,00')).toBeInTheDocument()
  })

  it('variación positiva: ig-delta up con "+12,4 %" y la referencia', () => {
    const { container } = render(<StatCard {...base} deltaPct={12.4} />)
    expect(container.querySelector('.ig-delta')).toHaveClass('up')
    expect(screen.getByText('+12,4 %')).toBeInTheDocument()
    expect(screen.getByText('vs. septiembre')).toBeInTheDocument()
    expect(container.querySelector('.lucide-trending-up')).not.toBeNull()
  })

  it('variación negativa: ig-delta down con el menos tipográfico', () => {
    const { container } = render(<StatCard {...base} deltaPct={-2.3} />)
    expect(container.querySelector('.ig-delta')).toHaveClass('down')
    expect(screen.getByText('−2,3 %')).toBeInTheDocument()
    expect(container.querySelector('.lucide-trending-down')).not.toBeNull()
  })

  it('variación cero: ig-delta flat con "0,0 %"', () => {
    const { container } = render(<StatCard {...base} deltaPct={0} />)
    expect(container.querySelector('.ig-delta')).toHaveClass('flat')
    expect(screen.getByText('0,0 %')).toBeInTheDocument()
    expect(container.querySelector('.lucide-minus')).not.toBeNull()
  })

  it('sin período anterior: "Sin datos para comparar"', () => {
    render(<StatCard {...base} deltaPct={null} />)
    expect(screen.getByText('Sin datos para comparar')).toBeInTheDocument()
    expect(screen.queryByText('vs. septiembre')).toBeNull()
  })

  it('empty: valor "—" y sin comparación', () => {
    const { container } = render(<StatCard {...base} deltaPct={10} empty />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('$ 50.000,00')).toBeNull()
    expect(container.querySelector('.ig-delta')).toBeNull()
    expect(screen.queryByText('Sin datos para comparar')).toBeNull()
  })
})
