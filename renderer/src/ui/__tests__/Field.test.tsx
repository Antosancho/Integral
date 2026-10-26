import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field, inputClass } from '../Field'

describe('Field', () => {
  it('asocia el label con el input hijo', () => {
    render(
      <Field label="Nombre" htmlFor="nombre">
        <input id="nombre" />
      </Field>,
    )
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })

  it('muestra el asterisco cuando es obligatorio', () => {
    render(
      <Field label="Nombre" htmlFor="nombre" required>
        <input id="nombre" />
      </Field>,
    )
    expect(screen.getByText('*')).toHaveClass('req')
  })

  it('muestra la ayuda cuando no hay error', () => {
    render(
      <Field label="Stock" htmlFor="stock" help="Solo enteros">
        <input id="stock" />
      </Field>,
    )
    expect(screen.getByText('Solo enteros')).toHaveAttribute('id', 'stock-help')
  })

  it('el error reemplaza a la ayuda', () => {
    render(
      <Field label="Stock" htmlFor="stock" help="Solo enteros" error="Número inválido">
        <input id="stock" />
      </Field>,
    )
    expect(screen.getByText('Número inválido')).toHaveAttribute('id', 'stock-error')
    expect(screen.queryByText('Solo enteros')).not.toBeInTheDocument()
  })
})

describe('inputClass', () => {
  it('compone las clases según las opciones', () => {
    expect(inputClass({})).toBe('ig-input')
    expect(inputClass({ error: true, amount: true, lg: true })).toBe('ig-input is-error ig-input-amount ig-input-lg')
  })
})
