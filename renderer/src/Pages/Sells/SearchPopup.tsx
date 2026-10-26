import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Search, TriangleAlert } from 'lucide-react'
import LotsList from '../../Components/LotsList/LotsList'
import type { ProductFromApi, StockMovementFromApi } from '../../electron-api'
import { Badge } from '../../ui/Badge'
import { InlineAlert } from '../../ui/InlineAlert'
import { Modal } from '../../ui/Modal'
import { ShortcutBar } from '../../ui/ShortcutBar'
import { TableSkeleton } from '../../ui/TableSkeleton'
import { useDelayedFlag } from '../../ui/useDelayedFlag'
import { scrollIntoViewSafe } from '../../utils/dom'
import { formatInt } from '../../utils/format'
import { groupLotsByProduct } from '../../utils/lots'
import { hasValidSalePrice, stockTone } from '../../utils/stock'
import { splitMatch } from '../../utils/text'
import { searchProducts } from './searchProducts'

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (product: ProductFromApi) => void
  /** Permite agregar con Enter aunque la búsqueda sea solo dígitos (Stock). En Ventas queda en false. */
  allowNumericEnter?: boolean
  /** Agrega la columna de vencimientos de lotes (Stock). */
  showExpiry?: boolean
  /** Ventas: marca con "Sin precio" los productos que no se pueden vender por no tener precio cargado. */
  warnMissingPrice?: boolean
}

/**
 * Buscador de productos (F2), compartido por Ventas y Stock. Busca por nombre y por código de barras a la vez.
 *
 * Regla del escáner: en Ventas, con una búsqueda de solo dígitos (típico del lector) Enter NO agrega
 * al carrito — el producto queda listado y se elige con click —, para que el Enter que manda el
 * lector al final del código no agregue algo que solo se estaba buscando.
 */
export default function SearchPopup({
  open,
  onClose,
  onSelect,
  allowNumericEnter = false,
  showExpiry = false,
  warnMissingPrice = false
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductFromApi[]>([])
  const [lotsByProduct, setLotsByProduct] = useState<Map<number, StockMovementFromApi[]>>(new Map())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const showSkeleton = useDelayedFlag(loading)

  // Limpiar al cerrar
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setLotsByProduct(new Map())
      setSelectedIndex(0)
      setError(null)
      setLoading(false)
    }
  }, [open])

  // Búsqueda con debounce
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await searchProducts(query)
        if (!cancelled) {
          setResults(data)
          setSelectedIndex(0)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al buscar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open])

  // Carga los lotes visibles solo cuando la columna de vencimientos está activa.
  useEffect(() => {
    let cancelled = false

    async function loadLots() {
      if (!showExpiry || results.length === 0) {
        setLotsByProduct(new Map())
        return
      }

      try {
        const lots = await window.api.listLotsByProductIds(results.map((product) => product.id))
        if (!cancelled) setLotsByProduct(groupLotsByProduct(lots))
      } catch {
        if (!cancelled) setLotsByProduct(new Map())
      }
    }

    loadLots()

    return () => {
      cancelled = true
    }
  }, [showExpiry, results])

  function moveSelection(next: number) {
    setSelectedIndex(next)
    scrollIntoViewSafe(document.getElementById(`search-popup-row-${next}`))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveSelection(Math.min(selectedIndex + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        moveSelection(Math.max(selectedIndex - 1, 0))
        break
      case 'Enter':
        if (!allowNumericEnter && /^\d+$/.test(query.trim())) break
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex])
          onClose()
        }
        break
      // Escape lo maneja Modal.
    }
  }

  const trimmed = query.trim()
  const showNumericHint = !allowNumericEnter && /^\d+$/.test(trimmed)
  const noResults = trimmed !== '' && !loading && !error && results.length === 0
  const columnCount = showExpiry ? 4 : 3

  return (
    <Modal
      open={open}
      title="Buscar producto"
      subtitle="Por nombre o por código de barras."
      size="lg"
      closeOnOverlay
      onClose={onClose}
      initialFocusRef={inputRef}
      headerExtra={<ShortcutBar items={[{ keys: ['F2'], label: 'cierra' }]} />}
      shortcuts={[
        { keys: ['↑', '↓'], label: 'Elegir' },
        { keys: ['Enter'], label: allowNumericEnter ? 'Abrir' : 'Agregar al carrito' },
        { keys: ['Esc'], label: 'Cerrar' }
      ]}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="ig-input-wrap">
          <Search size={18} strokeWidth={2} aria-hidden="true" className="ig-icon" />
          <input
            ref={inputRef}
            type="text"
            className="ig-input ig-input-lg"
            aria-label="Buscar producto"
            placeholder="Buscá por nombre o código de barras"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {error && <InlineAlert tone="danger" title="No pudimos buscar. Probá de nuevo.">{error}</InlineAlert>}

        {showSkeleton && results.length === 0 && <TableSkeleton rows={3} cols={columnCount} label="Buscando…" />}

        {(results.length > 0 || noResults) && (
          <div className="ig-table-wrap" style={{ boxShadow: 'none' }}>
            <table className="ig-table">
              <thead>
                <tr>
                  <th>Código de barras</th>
                  <th>Nombre</th>
                  <th className="r">Stock</th>
                  {showExpiry && <th>Vencimientos</th>}
                </tr>
              </thead>
              <tbody>
                {noResults && (
                  <tr>
                    <td colSpan={columnCount} className="c ig-muted">
                      No encontramos «{trimmed}»
                    </td>
                  </tr>
                )}
                {results.map((product, i) => {
                  const tone = stockTone(product)
                  return (
                    // El teclado se maneja en el input de búsqueda (↑/↓/Enter); la fila solo acepta click.
                    <tr
                      key={product.id}
                      id={`search-popup-row-${i}`}
                      className={i === selectedIndex ? 'is-selected' : undefined}
                      onClick={() => {
                        onSelect(product)
                        onClose()
                      }}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <td className="code">{product.barcode === null ? '—' : product.barcode.toString()}</td>
                      <td className="name">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span>
                            {splitMatch(product.name, query).map((part, k) =>
                              part.match ? <b key={k}>{part.text}</b> : part.text
                            )}
                          </span>
                          {warnMissingPrice && !hasValidSalePrice(product) && <Badge tone="danger">Sin precio</Badge>}
                        </span>
                      </td>
                      {tone === 'negative' ? (
                        <td className="r is-negative">
                          <span className="ig-stock">
                            <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                            {formatInt(product.stock)}
                          </span>
                        </td>
                      ) : tone === 'low' ? (
                        <td className="r is-low">
                          <span className="ig-stock">
                            <ArrowDown size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                            {formatInt(product.stock)}
                          </span>
                        </td>
                      ) : (
                        <td className="r">{formatInt(product.stock)}</td>
                      )}
                      {showExpiry && (
                        <td>
                          <LotsList lots={lotsByProduct.get(product.id) ?? []} />
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {showNumericHint && (
          <InlineAlert tone="info">
            Si buscás solo números se busca el código exacto: hacé click en el producto para agregarlo.
          </InlineAlert>
        )}
      </div>
    </Modal>
  )
}
