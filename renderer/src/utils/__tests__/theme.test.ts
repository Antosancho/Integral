import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, getStoredTheme, saveTheme, THEME_STORAGE_KEY } from '../theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getStoredTheme() devuelve "light" sin nada guardado', () => {
    expect(getStoredTheme()).toBe('light')
  })

  it('devuelve "dark" cuando está guardado', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(getStoredTheme()).toBe('dark')
  })

  it('un valor desconocido cae al default "light"', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'azul')
    expect(getStoredTheme()).toBe('light')
  })

  it('si localStorage lanza, devuelve "light"', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin storage')
    })
    expect(getStoredTheme()).toBe('light')
  })

  it('applyTheme() solo setea el atributo, sin guardar', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('saveTheme("dark") aplica el atributo y guarda en storage', () => {
    saveTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('saveTheme() no rompe si setItem lanza y igual aplica el tema', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota')
    })
    expect(() => saveTheme('dark')).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
