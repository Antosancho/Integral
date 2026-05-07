import { useEffect, useRef, useState } from 'react'
import { validateGeneralAmount } from './amount'
import './SearchPopup.css'

type Props = {
  open: boolean
  onClose: () => void
  onConfirm: (amount: string) => void
}

export default function GeneralAmountPopup({ open, onClose, onConfirm }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const result = validateGeneralAmount(value)
      if (result.ok) {
        onConfirm(result.value)
        onClose()
      } else {
        setError(result.error)
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="search-popup__overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="search-popup__container">
        <h2>Monto general</h2>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          placeholder="Monto (ej: 1500,50)"
          value={value}
          onChange={e => {
            setValue(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
        />
        {error && <p className="search-popup__error">{error}</p>}
      </div>
    </div>
  )
}
