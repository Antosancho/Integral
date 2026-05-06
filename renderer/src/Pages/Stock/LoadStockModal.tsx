import { useEffect, useRef, useState } from 'react'
import type { ProductFromApi } from '../../electron-api'
import { searchProducts } from '../Sells/searchProducts'
import { parseExpiryInput } from '../../utils/expiry'
import './LoadStockModal.css'

type Step = 'search' | 'confirm'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function LoadStockModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductFromApi[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [selectedProduct, setSelectedProduct] = useState<ProductFromApi | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [quantityError, setQuantityError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryDateError, setExpiryDateError] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setStep('search')
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setLoadingSearch(false)
      setSearchError(null)
      setSelectedProduct(null)
      setQuantity('')
      setNotes('')
      setQuantityError(null)
      setApiError(null)
      setExpiryDate('')
      setExpiryDateError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || step !== 'search') return

    const timer = setTimeout(async () => {
      if (query.trim() === '') {
        setResults([])
        setLoadingSearch(false)
        return
      }

      setLoadingSearch(true)
      setSearchError(null)

      try {
        const data = await searchProducts(query)
        setResults(data)
        setSelectedIndex(0)
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : 'Error en la búsqueda')
        setResults([])
      } finally {
        setLoadingSearch(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query, open, step])

  useEffect(() => {
    if (!open) return

    if (step === 'search') {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    } else if (step === 'confirm') {
      const timer = setTimeout(() => quantityInputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [open, step])

  useEffect(() => {
    if (!open || step !== 'confirm' || submitting) return

    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setStep('search')
        setSelectedProduct(null)
        setQuantityError(null)
        setApiError(null)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [open, step, submitting])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelectProduct(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  function handleSelectProduct(product: ProductFromApi) {
    setSelectedProduct(product)
    setStep('confirm')
    setQuantity('')
    setNotes('')
    setQuantityError(null)
    setApiError(null)
    setExpiryDate('')
    setExpiryDateError(null)
  }

  function validateQuantity(q: string): string | null {
    const trimmed = q.trim()
    if (trimmed === '') return 'La cantidad es obligatoria'
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n === 0) return 'La cantidad debe ser un número entero distinto de 0'
    return null
  }

  async function handleSubmit() {
    const error = validateQuantity(quantity)
    if (error) {
      setQuantityError(error)
      return
    }

    // Validar fecha de vencimiento solo si fue ingresada
    let parsedExpiry: Date | null = null
    if (expiryDate.trim() !== '') {
      parsedExpiry = parseExpiryInput(expiryDate)
      if (!parsedExpiry) {
        setExpiryDateError('Fecha inválida')
        return
      }
    }

    setSubmitting(true)
    setApiError(null)

    try {
      await window.api.createStockMovement({
        productId: selectedProduct!.id,
        type: 'IN',
        quantity: Number(quantity.trim()),
        notes: notes.trim() || undefined,
        expiryDate: parsedExpiry ?? undefined
      })
      onSuccess()
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Error al cargar stock')
      setSubmitting(false)
    }
  }

  function handleBack() {
    setStep('search')
    setSelectedProduct(null)
    setQuantityError(null)
    setApiError(null)
    setExpiryDate('')
    setExpiryDateError(null)
  }

  if (!open) return null

  return (
    <div className="load-stock-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="load-stock-modal">
        <h2 className="load-stock-modal__title">Cargar stock</h2>

        {step === 'search' && (
          <div className="load-stock-search">
            <input
              ref={searchInputRef}
              type="text"
              className="load-stock-modal__input"
              placeholder="Buscar por nombre o código..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {loadingSearch && <p>Buscando...</p>}
            {searchError && <p className="load-stock-modal__api-error">{searchError}</p>}
            {!loadingSearch && !searchError && results.length === 0 && query.trim() !== '' && (
              <p className="load-stock-modal__no-results">Sin resultados.</p>
            )}
            <table className="load-stock-results">
              <thead>
                <tr>
                  <th>Código de barras</th>
                  <th>Nombre</th>
                  <th>Stock actual</th>
                </tr>
              </thead>
              <tbody>
                {results.map((product, i) => (
                  <tr
                    key={product.id}
                    className={i === selectedIndex ? 'load-stock-results__row--selected' : ''}
                    onClick={() => handleSelectProduct(product)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <td>{product.barcode === null ? '-' : product.barcode.toString()}</td>
                    <td>{product.name}</td>
                    <td>{product.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {step === 'confirm' && (
          <>
            <div className="load-stock-modal__field">
              <label className="load-stock-modal__label">Producto</label>
              <p className="load-stock-modal__product-name">{selectedProduct!.name}</p>
            </div>

            <div className="load-stock-modal__field">
              <label className="load-stock-modal__label">Cantidad a agregar (negativo = merma) *</label>
              <input
                ref={quantityInputRef}
                type="text"
                inputMode="numeric"
                className={`load-stock-modal__input${quantityError ? ' load-stock-modal__input--error' : ''}`}
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setQuantityError(null) }}
                placeholder="Ej: 10 (negativo para merma)"
              />
              {quantityError && <p className="load-stock-modal__field-error">{quantityError}</p>}
            </div>

            <div className="load-stock-modal__field">
              <label className="load-stock-modal__label">Notas (opcional)</label>
              <input
                type="text"
                className="load-stock-modal__input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del movimiento"
              />
            </div>

            <div className="load-stock-modal__field">
              <label className="load-stock-modal__label" htmlFor="load-stock-expiry">Vencimiento (opcional)</label>
              <input
                id="load-stock-expiry"
                type="date"
                className={`load-stock-modal__input${expiryDateError ? ' load-stock-modal__input--error' : ''}`}
                value={expiryDate}
                onChange={(e) => { setExpiryDate(e.target.value); setExpiryDateError(null) }}
              />
              {expiryDateError && <p className="load-stock-modal__field-error">{expiryDateError}</p>}
            </div>

            {apiError && <p className="load-stock-modal__api-error">{apiError}</p>}
          </>
        )}

        <div className="load-stock-modal__actions">
          <button className="load-stock-modal__btn-cancel" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          {step === 'confirm' && (
            <>
              <button className="load-stock-modal__btn-back" onClick={handleBack} disabled={submitting}>
                Volver
              </button>
              <button className="load-stock-modal__btn-submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Cargando...' : 'Cargar stock'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}