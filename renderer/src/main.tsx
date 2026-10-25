import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/bundle.css'
import './styles/app.css'
import { applyTheme, getStoredTheme } from './utils/theme'
import App from './App.tsx'

// Aplica el tema guardado antes del primer render para evitar el "flash" del tema equivocado.
applyTheme(getStoredTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
