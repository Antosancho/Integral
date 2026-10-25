import { ChartColumn, Package, ShoppingCart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import logoDark from '../../assets/brand/factor-integral-horizontal-oscuro.png'
import ExpiryAlertWidget from '../ExpiryAlert/ExpiryAlertWidget'
import ThemeToggle from './ThemeToggle'
import type { Section } from '../../navigation'

const NAV: { section: Section; label: string; icon: LucideIcon; shortcut: string }[] = [
  { section: 'stock', label: 'Stock', icon: Package, shortcut: 'Ctrl+1' },
  { section: 'sells', label: 'Ventas', icon: ShoppingCart, shortcut: 'Ctrl+2' },
  { section: 'stats', label: 'Estadísticas', icon: ChartColumn, shortcut: 'Ctrl+3' },
]

/**
 * Header fijo de la app: logo (vuelve a Stock), navegación por secciones,
 * widget de vencimientos y selector de tema.
 */
export default function AppHeader({ section, onNavigate }: { section: Section; onNavigate: (s: Section) => void }) {
  return (
    <header className="ig-header">
      <button type="button" className="ig-brand" aria-label="Factor Integral — ir a Stock" onClick={() => onNavigate('stock')}>
        <img className="ig-logo" src={logoDark} alt="Factor Integral" />
      </button>
      <nav className="ig-nav" aria-label="Secciones">
        {NAV.map(({ section: s, label, icon: Icon, shortcut }) => (
          <button
            key={s}
            type="button"
            aria-current={section === s ? 'page' : undefined}
            title={shortcut}
            onClick={() => onNavigate(s)}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
            {label}
          </button>
        ))}
      </nav>
      <div className="ig-spacer" />
      <ExpiryAlertWidget />
      <ThemeToggle />
    </header>
  )
}
