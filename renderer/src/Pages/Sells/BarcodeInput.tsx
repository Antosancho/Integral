import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { CircleCheck, ScanBarcode, TriangleAlert } from 'lucide-react'

type Props = {
  /**
   * Se llama con el código tipeado/escaneado al presionar Enter. Devuelve `true` si el producto se
   * agregó (el input se limpia) o `false` si no (el texto se conserva, seleccionado, para corregirlo).
   */
  onScan: (code: string) => Promise<boolean>
  /** ↓ desde el input: ir a la primera fila del carrito. */
  onArrowDown: () => void
}

export type BarcodeInputHandle = { focus: () => void }

/**
 * Input de código de barras de Ventas: es el "hogar" del foco. El lector actúa como teclado y termina con Enter.
 * Muestra su estado: "Listo para escanear" (con foco) / "Hacé click acá o tocá Esc para escanear" (sin foco).
 */
const BarcodeInput = forwardRef<BarcodeInputHandle, Props>(function BarcodeInput({ onScan, onArrowDown }, ref) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus() {
      inputRef.current?.focus()
    },
  }))

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const code = value.trim()
      if (code === '') return
      const added = await onScan(code)
      if (added) setValue('')
      else inputRef.current?.select()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onArrowDown()
    }
  }

  return (
    <div className={`ig-scan ${focused ? 'is-focus' : 'is-idle'}`}>
      <ScanBarcode size={22} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-lg" />
      <input
        ref={inputRef}
        type="text"
        autoFocus
        aria-label="Código de barras"
        placeholder="Escaneá o escribí un código de barras"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
      />
      <span className="ig-scan-state">
        {focused ? (
          <>
            <CircleCheck size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
            Listo para escanear
          </>
        ) : (
          <>
            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
            Hacé click acá o tocá Esc para escanear
          </>
        )}
      </span>
    </div>
  )
})

export default BarcodeInput
