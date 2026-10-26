import { describe, expect, it, vi } from 'vitest'
import { isEditableTarget, scrollIntoViewSafe } from '../dom'

describe('isEditableTarget', () => {
  it.each(['input', 'textarea', 'select'])('<%s> es editable', (tag) => {
    expect(isEditableTarget(document.createElement(tag))).toBe(true)
  })

  it.each(['div', 'button'])('<%s> no es editable', (tag) => {
    expect(isEditableTarget(document.createElement(tag))).toBe(false)
  })

  it('null no es editable', () => {
    expect(isEditableTarget(null)).toBe(false)
  })

  it('un elemento contentEditable es editable', () => {
    const el = document.createElement('div')
    // happy-dom no deriva isContentEditable del atributo: se fuerza la propiedad.
    Object.defineProperty(el, 'isContentEditable', { value: true })
    expect(isEditableTarget(el)).toBe(true)
  })
})

describe('scrollIntoViewSafe', () => {
  it('no falla con null', () => {
    expect(() => scrollIntoViewSafe(null)).not.toThrow()
  })

  it('no falla si el elemento no implementa scrollIntoView', () => {
    const el = document.createElement('div') as unknown as { scrollIntoView?: unknown }
    el.scrollIntoView = undefined
    expect(() => scrollIntoViewSafe(el as unknown as Element)).not.toThrow()
  })

  it('llama a scrollIntoView con block "nearest" si existe', () => {
    const el = document.createElement('div')
    const spy = vi.fn()
    el.scrollIntoView = spy
    scrollIntoViewSafe(el)
    expect(spy).toHaveBeenCalledWith({ block: 'nearest' })
  })
})
