import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '../../ui/Button'
import { getStoredTheme, saveTheme } from '../../utils/theme'
import type { Theme } from '../../utils/theme'

/**
 * Botón del header que alterna entre tema claro y oscuro.
 * La elección se persiste en `localStorage` (ver `utils/theme.ts`).
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    saveTheme(next)
    setTheme(next)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      className="ig-theme-toggle"
      icon={theme === 'light' ? Moon : Sun}
      aria-label={theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'}
      onClick={toggle}
    />
  )
}
