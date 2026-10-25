import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Search, SearchX, TriangleAlert } from 'lucide-react'
import type { ProductFromApi } from '../../electron-api'
import { Button } from '../../ui/Button'
import { DateField } from '../../ui/DateField'
import { EmptyState } from '../../ui/EmptyState'
import { Field } from '../../ui/Field'
import { InlineAlert } from '../../ui/InlineAlert'
import { Modal } from '../../ui/Modal'
import { StepIndicator } from '../../ui/StepIndicator'
import { TableSkeleton } from '../../ui/TableSkeleton'
import { useDelayedFlag } from '../../ui/useDelayedFlag'
import { formatInt } from '../../utils/format'
import { parseDateAR, parseInteger } from '../../utils/parse'
import { splitMatch } from '../../utils/text'
import { stockTone } from '../../utils/stock'
import { searchProducts } from '../Sells/searchProducts'

type Step = 'search' | 'confirm'

type Props = {
  open: boolean
  onClose: () => void
  /** Se llama con el id del producto al que se le cargó stock. */
  onSuccess: (productId: number) => void
  /** Si viene, el modal abre directo en el paso 2 con ese producto. */
  initialProduct?: ProductFromApi
  /** Si viene, el estado "sin resultados" ofrece crear el producto con lo que se buscó. */
  onRequestCreate?: (query: string) => void
}

const QUANTITY_ERROR = 'Ingresá una cantidad distinta de 0, sin decimales.'

/** Celda de stock con el mismo tono/ícono que la tabla de Stock. */
function StockCell({ product }: { product: ProductFromApi }) {
  const tone = stockTone(product)
  if (tone === 'negative') {
    return (
      <td className="r is-negative">
        <span className="ig-stock">
          <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
          {formatInt(product.stock)}
        </span>
      </td>
    )
  }
  if (tone === 'low') {
    return (
      <td className="r is-low">
        <span className="ig-stock">
          <ArrowDown size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
          {formatInt(product.stock)}
        </span>
      </td>
    )
  }
  return <td className="r">{formatInt(product.stock)}</td>
}

/**
 * Modal de 2 pasos para sumar (o restar, con cantidad negativa = merma) stock a un producto existente.
 *
 *  1. Buscar: por nombre o escaneando el código. Un escaneo exacto salta directo al paso 2.
 *  2. Cantidad: cantidad, vencimiento opcional del lote y notas. Muestra una vista previa del stock resultante.
 *
 * Esc en el paso 2 vuelve al 1 y en el paso 1 cierra. Enter confirma en el paso 2.
 */
export default function LoadStockModal({ open, onClose, onSuccess, initialProduct, onRequestCreate }: Props) {
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
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryError, setExpiryError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const expiryInputRef = useRef<HTMLInputElement>(null)

  const showSkeleton = useDelayedFlag(loadingSearch)

  /** Restablece el paso 2 (cantidad, notas, vencimiento y errores). */
  function resetConfirmFields() {
    setQuantity('')
    setNotes('')
    setQuantityError(null)
    setExpiryDate('')
    setExpiryError(null)
    setSaveFailed(false)
  }

  // Al abrir (o cambiar el producto inicial) se arma el estado de partida; al cerrar se limpia todo.
  useEffect(() => {
    setQuery('')
    setResults([])
    setSelectedIndex(0)
    setLoadingSearch(false)
    setSearchError(null)
    setSubmitting(false)
    resetConfirmFields()
    if (open && initialProduct) {
      setSelectedProduct(initialProduct)
      setStep('confirm')
    } else {
      setSelectedProduct(null)
      setStep('search')
    }
  }, [open, initialProduct])

  // Búsqueda con debounce de 250 ms (solo en el paso 1).
  useEffect(() => {
    if (!open || step !== 'search') return

    let cancelled = false
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
        if (!cancelled) {
          setResults(data)
          setSelectedIndex(0)
        }
      } catch (e) {
        if (!cancelled) {
          setSearchError(e instanceof Error ? e.message : 'Error en la búsqueda')
          setResults([])
        }
      } finally {
        if (!cancelled) setLoadingSearch(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open, step])

  // El foco va al campo principal de cada paso.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      if (step === 'search') searchInputRef.current?.focus()
      else quantityInputRef.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [open, step])

  function handleSelectProduct(product: ProductFromApi) {
    setSelectedProduct(product)
    resetConfirmFields()
    setStep('confirm')
  }

  function handleBack() {
    if (submitting) return
    setStep('search')
    setSelectedProduct(null)
    resetConfirmFields()
  }

  /** Esc: en el paso 2 vuelve al 1; en el paso 1 cierra el modal. */
  function handleEscape() {
    if (step === 'confirm') handleBack()
    else onClose()
  }

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const q = query.trim()
      // Escaneo: un código exacto salta directo al paso 2 sin esperar la lista.
      if (/^\d+$/.test(q)) {
        try {
          const scanned = await window.api.getProductByBarcode(q)
          if (scanned) {
            handleSelectProduct(scanned)
            return
          }
        } catch {
          // Código inválido para el backend: se sigue con la lógica normal.
        }
      }
      if (results[selectedIndex]) handleSelectProduct(results[selectedIndex])
    }
  }

  async function handleSubmit() {
    if (!selectedProduct || submitting) return

    const n = parseInteger(quantity)
    if (n === null || n === 0) {
      setQuantityError(QUANTITY_ERROR)
      quantityInputRef.current?.focus()
      return
    }

    let parsedExpiry: Date | null = null
    if (expiryDate.trim() !== '') {
      parsedExpiry = parseDateAR(expiryDate)
      if (!parsedExpiry) {
        setExpiryError('Revisá la fecha (DD/MM/AAAA).')
        expiryInputRef.current?.focus()
        return
      }
    }

    setSubmitting(true)
    setSaveFailed(false)
    try {
      await window.api.createStockMovement({
        productId: selectedProduct.id,
        type: 'IN',
        quantity: n,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(parsedExpiry ? { expiryDate: parsedExpiry } : {}),
      })
      onSuccess(selectedProduct.id)
    } catch (e) {
      console.error(e)
      setSaveFailed(true)
      setSubmitting(false)
    }
  }

  // ── Vista previa del stock resultante (paso 2) ───────────────────────────
  const delta = parseInteger(quantity)
  const resulting = selectedProduct && delta !== null && delta !== 0 ? selectedProduct.stock + delta : null
  let preview: React.ReactNode = undefined
  if (resulting !== null && delta !== null) {
    if (resulting < 0) {
      preview = (
        <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" className="ig-icon" />
          El stock quedará en {formatInt(resulting)}
        </span>
      )
    } else if (delta < 0) {
      preview = (
        <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ArrowDown size={14} strokeWidth={2} aria-hidden="true" className="ig-icon" />
          Merma: el stock queda en {formatInt(resulting)}
        </span>
      )
    } else {
      preview = (
        <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ArrowUp size={14} strokeWidth={2} aria-hidden="true" className="ig-icon" />
          Reposición: el stock queda en {formatInt(resulting)}
        </span>
      )
    }
  }
  const trimmedQuery = query.trim()
  const noResults = trimmedQuery !== '' && !loadingSearch && !searchError && results.length === 0

  return (
    <Modal
      open={open}
      title="Cargar stock"
      size="md"
      closeOnOverlay={false}
      onClose={onClose}
      onEscape={handleEscape}
      headerExtra={<StepIndicator steps={['Buscar producto', 'Cantidad']} current={step === 'search' ? 0 : 1} />}
      shortcuts={
        step === 'search'
          ? [
              { keys: ['↑', '↓'], label: 'Elegir' },
              { keys: ['Enter'], label: 'Continuar' },
              { keys: ['Esc'], label: 'Cerrar' },
            ]
          : [
              { keys: ['Esc'], label: 'Volver' },
              { keys: ['Enter'], label: 'Confirmar' },
            ]
      }
      footer={
        step === 'confirm' ? (
          <>
            <Button variant="secondary" icon={ArrowLeft} onClick={handleBack} disabled={submitting}>
              Volver
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Cargando…' : 'Cargar stock'}
            </Button>
          </>
        ) : undefined
      }
    >
      {step === 'search' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="ig-input-wrap">
            <Search size={18} strokeWidth={2} aria-hidden="true" className="ig-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="ig-input ig-input-lg"
              aria-label="Buscar producto"
              placeholder="Buscá por nombre o escaneá el código"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {searchError && <InlineAlert tone="danger" title="No pudimos buscar. Probá de nuevo.">{searchError}</InlineAlert>}

          {showSkeleton && <TableSkeleton rows={3} cols={3} label="Buscando…" />}

          {noResults && (
            <EmptyState
              icon={SearchX}
              title={`No encontramos «${trimmedQuery}»`}
              description="¿Es un producto nuevo?"
              action={
                onRequestCreate && (
                  <Button variant="primary" icon={Plus} onClick={() => onRequestCreate(trimmedQuery)}>
                    Crear producto
                  </Button>
                )
              }
            />
          )}

          {results.length > 0 && (
            <div className="ig-table-wrap" style={{ boxShadow: 'none' }}>
              <table className="ig-table">
                <thead>
                  <tr>
                    <th>Código de barras</th>
                    <th>Nombre</th>
                    <th className="r">Stock actual</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((product, i) => (
                    // El teclado se maneja en el input de búsqueda (↑/↓/Enter); la fila solo acepta click.
                    <tr
                      key={product.id}
                      className={i === selectedIndex ? 'is-selected' : undefined}
                      onClick={() => handleSelectProduct(product)}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <td className="code">{product.barcode === null ? '—' : product.barcode.toString()}</td>
                      <td className="name">
                        {splitMatch(product.name, query).map((part, k) => (part.match ? <b key={k}>{part.text}</b> : part.text))}
                      </td>
                      <StockCell product={product} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {step === 'confirm' && selectedProduct && (
        // Enter en cualquier campo confirma; el wrapper solo captura la tecla, no es interactivo.
        <div
          style={{ display: 'grid', gap: 16 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        >
          <div className="ig-form-grid">
            <Field label="Producto" htmlFor="ls-product" className="span-2">
              <input
                id="ls-product"
                className="ig-input is-readonly"
                readOnly
                value={`${selectedProduct.name} · stock actual ${selectedProduct.stock}`}
              />
            </Field>

            <Field
              label="Cantidad a agregar (negativo = merma)"
              htmlFor="ls-quantity"
              required
              className="span-2"
              error={quantityError}
              help={preview}
            >
              <input
                id="ls-quantity"
                ref={quantityInputRef}
                className={`ig-input ig-input-amount ig-input-lg${quantityError ? ' is-error' : ''}`}
                style={delta !== null && delta < 0 && resulting !== null && resulting >= 0 ? { color: 'var(--warning)' } : undefined}
                inputMode="numeric"
                placeholder="Ej: 10 (negativo para merma)"
                aria-invalid={!!quantityError}
                aria-describedby={quantityError ? 'ls-quantity-error' : preview ? 'ls-quantity-help' : undefined}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value)
                  setQuantityError(null)
                }}
              />
            </Field>

            <DateField
              id="ls-expiry"
              label="Vencimiento del lote"
              value={expiryDate}
              onChange={(v) => {
                setExpiryDate(v)
                setExpiryError(null)
              }}
              error={expiryError}
              help="Opcional"
              inputRef={expiryInputRef}
            />

            <Field label="Notas" htmlFor="ls-notes">
              <input
                id="ls-notes"
                className="ig-input"
                placeholder="Opcional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>

          {saveFailed && <InlineAlert tone="danger" title="No se pudo cargar el stock. Probá de nuevo." />}
        </div>
      )}
    </Modal>
  )
}
