import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RankingList from '../RankingList'

const ITEMS = [
  { id: 1, name: 'Coca Cola', value: 100 },
  { id: 2, name: 'Yerba', value: 50 },
  { id: 3, name: 'Fideos', value: 25 }
]
const fmt = (v: number) => `${v} u.`

describe('RankingList', () => {
  it('muestra posición, nombre y valor formateado de cada fila', () => {
    render(<RankingList items={ITEMS} format={fmt} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Coca Cola')).toBeInTheDocument()
    expect(screen.getByText('100 u.')).toBeInTheDocument()
    expect(screen.getByText('1', { selector: '.pos' })).toBeInTheDocument()
    expect(screen.getByText('3', { selector: '.pos' })).toBeInTheDocument()
  })

  it('las barras son proporcionales al máximo: la primera ocupa el 100 %', () => {
    render(<RankingList items={ITEMS} format={fmt} />)
    const widths = screen.getAllByTestId('rank-bar').map((b) => (b as HTMLElement).style.width)
    expect(widths).toEqual(['100%', '50%', '25%'])
  })

  it('con onSelect, click en el nombre llama onSelect(id, name)', () => {
    const onSelect = vi.fn()
    render(<RankingList items={ITEMS} format={fmt} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Yerba' }))
    expect(onSelect).toHaveBeenCalledWith(2, 'Yerba')
  })

  it('sin onSelect los nombres no son botones', () => {
    render(<RankingList items={ITEMS} format={fmt} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('vacío: "Sin ventas en este período"', () => {
    render(<RankingList items={[]} format={fmt} />)
    expect(screen.getByText('Sin ventas en este período')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('si todos los valores son 0 las barras quedan en 0 % (sin NaN)', () => {
    render(<RankingList items={[{ id: 1, name: 'A', value: 0 }]} format={fmt} />)
    expect((screen.getByTestId('rank-bar') as HTMLElement).style.width).toBe('0%')
  })
})
