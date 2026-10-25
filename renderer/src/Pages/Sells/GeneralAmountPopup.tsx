import { useEffect, useRef, useState } from 'react'
import { Field } from '../../ui/Field'
import { Modal } from '../../ui/Modal'
import { validateGeneralAmount } from './amount'

type Props = {
  open: boolean
  onClose: () => void
  /** Recibe el monto validado en formato máquina (punto decimal, ej. "1500.5"). */
  onConfirm: (amount: string) => void
}

/**
 * Popup F10 "Ítem general": un monto libre sin producto asociado.
 * Enter valida y agrega (monto > 0, coma o punto decimal); si es inválido muestra el error sin cerrar.
 */
export default function GeneralAmountPopup({ open, onClose, onConfirm }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setError(null)
    }
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const result = validateGeneralAmount(value)
    if (result.ok) {
      onConfirm(result.value)
      onClose()
    } else {
      setError(result.error)
    }
  }

  return (
    <Modal
      open={open}
      title="Ítem general"
      size="sm"
      closeOnOverlay
      onClose={onClose}
      initialFocusRef={inputRef}
      shortcuts={[
        { keys: ['Enter'], label: 'Agregar' },
        { keys: ['Esc'], label: 'Cancelar' }
      ]}
    >
      <Field label="Monto" htmlFor="general-amount" help="Mayor a 0. Podés usar coma o punto." error={error}>
        <div className="ig-input-wrap">
          <span className="ig-prefix">$</span>
          <input
            id="general-amount"
            ref={inputRef}
            type="text"
            className={`ig-input ig-input-amount ig-input-lg${error ? ' is-error' : ''}`}
            inputMode="decimal"
            aria-invalid={!!error}
            aria-describedby={error ? 'general-amount-error' : 'general-amount-help'}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
      </Field>
    </Modal>
  )
}
