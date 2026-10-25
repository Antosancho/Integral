import { Field } from './Field'
import { maskTimeInput } from '../utils/time'

type TimeFieldProps = {
  id: string
  label: string
  /** Texto con máscara `HH:MM` (puede estar incompleto mientras se tipea). */
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
 * Campo de hora como texto con máscara `HH:MM` (24 h). No usa `type="time"`: igual que `DateField`,
 * se opera entero con teclado y se ve igual en todas las PCs.
 */
export function TimeField({ id, label, value, onChange, error, help, required, className, inputRef, onKeyDown }: TimeFieldProps) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined
  return (
    <Field label={label} htmlFor={id} required={required} help={help} error={error} className={className}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        maxLength={5}
        className={error ? 'ig-input is-error' : 'ig-input'}
        value={value}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => onChange(maskTimeInput(e.target.value))}
        onKeyDown={onKeyDown}
      />
    </Field>
  )
}
