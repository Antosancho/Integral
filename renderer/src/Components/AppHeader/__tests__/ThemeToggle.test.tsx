import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import ThemeToggle from '../ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('arranca en tema claro ofreciendo activar el oscuro', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Activar tema oscuro' })).toBeInTheDocument()
  })

  it('click pasa a oscuro y un segundo click vuelve a claro', () => {
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Activar tema oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Activar tema claro' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Activar tema claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Activar tema oscuro' })).toBeInTheDocument()
  })

  it('recuerda el tema guardado al montarse', () => {
    localStorage.setItem('integral.theme', 'dark')
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'Activar tema claro' })).toBeInTheDocument()
  })
})
