/**
 * Manejo del tema visual (claro / oscuro).
 *
 * La elección se guarda en `localStorage` y se aplica como atributo
 * `data-theme` sobre `<html>`; los tokens de `styles/tokens.css` resuelven
 * los colores según ese atributo.
 */
export type Theme = 'light' | 'dark'

/** Clave de `localStorage` donde se recuerda el tema elegido. */
export const THEME_STORAGE_KEY = 'integral.theme'

/**
 * Lee el tema guardado. Cualquier valor desconocido, o un `localStorage`
 * inaccesible (modo privado, storage bloqueado), resuelve al default `'light'`.
 */
export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Aplica el tema al documento (sin persistirlo). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/** Persiste el tema y lo aplica. Si no hay storage, el cambio vale solo para esta sesión. */
export function saveTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* sin storage: solo esta sesión */ }
  applyTheme(theme)
}
