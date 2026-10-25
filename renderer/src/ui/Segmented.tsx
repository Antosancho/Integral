import { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'

export type SegmentedOption<V extends string> = { value: V; label: string; icon?: LucideIcon }

type SegmentedProps<V extends string> = {
  options: SegmentedOption<V>[]
  value: V
  onChange: (v: V) => void
  /** Nombre accesible del grupo de pestañas. */
  ariaLabel: string
}

/**
 * Control segmentado (pestañas). Un único tab-stop: el seleccionado. Las flechas ←/→
 * cambian la selección y mueven el foco, como en el patrón ARIA de `tablist`.
 */
export function Segmented<V extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<V>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, dir: -1 | 1) => {
    const next = (from + dir + options.length) % options.length
    onChange(options[next].value)
    buttons.current[next]?.focus()
  }

  return (
    <div className="ig-seg" role="tablist" aria-label={ariaLabel}>
      {options.map((opt, i) => {
        const selected = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault()
                move(i, 1)
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault()
                move(i, -1)
              }
            }}
          >
            {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />}
            {Icon ? ' ' : ''}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
