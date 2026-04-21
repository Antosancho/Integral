import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

type Props = {
  onScan: (barcode: string) => void
  onRequestSearch: () => void
}

export type BarcodeInputHandle = { focus: () => void }

const BarcodeInput = forwardRef<BarcodeInputHandle, Props>(function BarcodeInput(
  { onScan, onRequestSearch },
  ref
) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus()
    }
  }))

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && value.trim() !== '') {
      onScan(value.trim())
      setValue('')
    }
  }

  return (
    <div className="barcode-input">
      <input
        ref={inputRef}
        type="text"
        autoFocus
        placeholder="Código de barras"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button type="button" onClick={onRequestSearch}>F2</button>
    </div>
  )
})

export default BarcodeInput
