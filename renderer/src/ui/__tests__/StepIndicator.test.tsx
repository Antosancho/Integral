import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepIndicator } from '../StepIndicator'

describe('StepIndicator', () => {
  it('con current=1 el primer paso está hecho y el segundo es el actual', () => {
    render(<StepIndicator steps={['Buscar producto', 'Cantidad']} current={1} />)
    expect(screen.getByText('Buscar producto').closest('.step')).toHaveClass('is-done')
    expect(screen.getByText('Cantidad').closest('.step')).toHaveClass('is-current')
  })

  it('con current=0 el primero es actual y el segundo no tiene estado', () => {
    render(<StepIndicator steps={['Buscar producto', 'Cantidad']} current={0} />)
    expect(screen.getByText('Buscar producto').closest('.step')).toHaveClass('is-current')
    expect(screen.getByText('Cantidad').closest('.step')).not.toHaveClass('is-current', 'is-done')
  })
})
