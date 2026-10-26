import { Fragment } from 'react'
import { Check } from 'lucide-react'

/**
 * Indicador de pasos de un modal multi-paso. `current` es el índice 0-based del paso actual;
 * los anteriores se muestran como completados (con tilde).
 */
export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="ig-steps">
      {steps.map((label, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-current' : ''
        return (
          <Fragment key={label}>
            {i > 0 && <span className="line" aria-hidden="true" />}
            <span className={`step ${state}`.trim()} aria-current={i === current ? 'step' : undefined}>
              <span className="dot">
                {i < current ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              {label}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}
