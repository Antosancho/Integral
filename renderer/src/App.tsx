import { useCallback, useEffect, useState } from 'react'
import AppHeader from './Components/AppHeader/AppHeader'
import { initialNav } from './navigation'
import type { Navigate, NavState, Section } from './navigation'
import SalesPage from './Pages/Sells/SalesPage'
import Stats from './Pages/Stats/Stats'
import StockPage from './Pages/Stock/StockPage'
import { SalesProvider } from './store/SalesContext'
import { openModalCount } from './ui/modalStack'
import { ToastProvider } from './ui/Toast'

/** Atajos globales Ctrl+1/2/3 → sección. */
const SECTION_SHORTCUTS: Record<string, Section> = { '1': 'stock', '2': 'sells', '3': 'stats' }

/**
 * Raíz de la app: estado de navegación + providers globales (toasts y venta en curso).
 * Arranca en Stock › Productos.
 */
export default function App() {
  const [nav, setNav] = useState<NavState>(initialNav)
  const navigate: Navigate = useCallback((patch) => setNav((n) => ({ ...n, ...patch })), [])

  // Ctrl+1/2/3 → secciones (se ignora si hay un modal abierto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey || openModalCount() > 0) return
      const section = SECTION_SHORTCUTS[e.key]
      if (section) {
        e.preventDefault()
        navigate({ section })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <ToastProvider>
      <SalesProvider>
        <div className="ig-app">
          <AppHeader section={nav.section} onNavigate={(section) => navigate({ section })} />
          <div className="app-body">
            {nav.section === 'stock' && <StockPage nav={nav} navigate={navigate} />}
            {nav.section === 'sells' && <SalesPage nav={nav} navigate={navigate} />}
            {nav.section === 'stats' && <Stats navigate={navigate} />}
          </div>
        </div>
      </SalesProvider>
    </ToastProvider>
  )
}
