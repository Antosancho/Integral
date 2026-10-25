import { Field } from './Field'
import { maskDateInput } from '../utils/parse'

type DateFieldProps = {
  id: string
  label: string
  /** Texto con máscara `DD/MM/AAAA` (puede estar incompleto mientras se tipea). */
  value: string
  /** Recibe el texto ya enmascarado. */
  onChange: (masked: string) => void
  error?: string | null
  help?: string
  required?: boolean
  className?: string
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

/**
 * Campo de fecha como texto con máscara `DD/MM/AAAA` (no usa el input de fecha nativo del
 * navegador, por pedido del design system: se opera entero con teclado).
 */
export function DateField({ id, label, value, onChange, error, help, required, className, inputRef, onKeyDown }: DateFieldProps) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined
  return (
    <Field label={label} htmlFor={id} required={required} help={help} error={error} className={className}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        className={error ? 'ig-input is-error' : 'ig-input'}
        value={value}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => onChange(maskDateInput(e.target.value))}
        onKeyDown={onKeyDown}
      />
    </Field>
  )
}
