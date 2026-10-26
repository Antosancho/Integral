import { render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { SalesProvider } from '../store/SalesContext'
import { ToastProvider } from '../ui/Toast'

/**
 * `render` con los providers globales de la app (toasts + venta en curso).
 * Las pantallas llaman a `useToast()` y `useSales()`, que lanzan fuera de su provider.
 */
export function renderWithProviders(ui: React.ReactElement): RenderResult {
  return render(
    <ToastProvider>
      <SalesProvider>{ui}</SalesProvider>
    </ToastProvider>,
  )
}
