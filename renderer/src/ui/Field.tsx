import { CircleAlert } from 'lucide-react'

type FieldProps = {
  label: string
  /** `id` del control hijo; asocia el `<label>` y deriva los ids de ayuda/error. */
  htmlFor: string
  required?: boolean
  /** Texto de ayuda (se oculta si hay `error`). */
  help?: React.ReactNode
  /** Mensaje de error; reemplaza a la ayuda. */
  error?: string | null
  className?: string
  /**
   * El control hijo (input/select/picker) debe llevar `id={htmlFor}`, `aria-invalid={!!error}`
   * y `aria-describedby` apuntando a `${htmlFor}-error` (si hay error) o `${htmlFor}-help` (si hay ayuda).
   * Esa conexión es responsabilidad de quien usa el `Field`.
   */
  children: React.ReactNode
}

/** Contenedor de un campo de formulario: etiqueta, control, y ayuda o error. */
export function Field({ label, htmlFor, required, help, error, className, children }: FieldProps) {
  return (
    <div className={`ig-field ${className ?? ''}`.trim()}>
      <label className="ig-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
      {error ? (
        <span className="ig-error" id={`${htmlFor}-error`}>
          <CircleAlert size={16} aria-hidden="true" className="ig-icon ig-icon-sm" />
          {error}
        </span>
      ) : help ? (
        <span className="ig-help" id={`${htmlFor}-help`}>
          {help}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Arma el `className` de un `<input>` del design system.
 * Para fuente monoespaciada (códigos) usar `style={{ fontFamily: 'var(--font-mono)' }}` en el input.
 */
export const inputClass = (opts: { error?: boolean; amount?: boolean; lg?: boolean; mono?: boolean }): string =>
  ['ig-input', opts.error ? 'is-error' : '', opts.amount ? 'ig-input-amount' : '', opts.lg ? 'ig-input-lg' : '']
    .filter(Boolean)
    .join(' ')
