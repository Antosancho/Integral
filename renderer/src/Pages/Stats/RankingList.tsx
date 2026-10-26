import { ChartColumn } from 'lucide-react'
import { EmptyState } from '../../ui/EmptyState'

type Item = { id: number; name: string; value: number }

type Props = {
  items: Item[]
  /** Formatea el valor de cada fila ("12 u.", "$ 1.234,00"). */
  format: (value: number) => string
  /** Si viene, el nombre es un enlace (ej. para abrir los movimientos del producto). */
  onSelect?: (id: number, name: string) => void
}

/**
 * Ranking de productos con barra proporcional: la primera fila (el máximo) ocupa el 100 % del ancho.
 */
export default function RankingList({ items, format, onSelect }: Props) {
  if (items.length === 0) {
    return <EmptyState icon={ChartColumn} title="Sin ventas en este período" />
  }

  const max = Math.max(...items.map((i) => i.value), 0)

  return (
    <ol className="ig-rank">
      {items.map((item, i) => (
        <li key={item.id}>
          <span className="pos">{i + 1}</span>
          {onSelect ? (
            <button
              type="button"
              className="ig-link"
              style={{ textDecoration: 'none', color: 'var(--ink)', textAlign: 'left' }}
              onClick={() => onSelect(item.id, item.name)}
            >
              {item.name}
            </button>
          ) : (
            <span>{item.name}</span>
          )}
          <span className="val">{format(item.value)}</span>
          <span className="bar">
            <i data-testid="rank-bar" style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }} />
          </span>
        </li>
      ))}
    </ol>
  )
}
