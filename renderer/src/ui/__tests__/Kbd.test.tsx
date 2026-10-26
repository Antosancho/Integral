import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Kbd } from '../Kbd'

describe('Kbd', () => {
  it('renderiza el texto con la clase ig-kbd y aria-hidden', () => {
    const { container } = render(<Kbd>F2</Kbd>)
    const kbd = container.querySelector('kbd')!
    expect(kbd).toHaveTextContent('F2')
    expect(kbd).toHaveClass('ig-kbd')
    expect(kbd).toHaveAttribute('aria-hidden', 'true')
  })
})
