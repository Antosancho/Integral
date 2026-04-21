import { useEffect, useRef, useState } from 'react'
import type { ProductFromApi } from '../../electron-api'
import { searchProducts } from './searchProducts'

type Props = {
  open: boolean
  onClose: () => void
  onSelect: (product: ProductFromApi) => void
}

export default function SearchPopup({ open, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductFromApi[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Limpiar al cerrar
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setError(null)
    }
  }, [open])

  // Búsqueda con debounce
  useEffect(() => {
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
  }, [query])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (/^\d+$/.test(query.trim())) break
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex])
          onClose()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  if (!open) return null

  return (
    <div
      className="search-popup__overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="search-popup__container">
        <h2>Buscador</h2>
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar por nombre o código..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {loading && <p>Buscando...</p>}
        {error && <p className="search-popup__error">{error}</p>}
        <table>
          <thead>
            <tr>
              <th>Código de barras</th>
              <th>Nombre</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {results.map((product, i) => (
              <tr
                key={product.id}
                className={i === selectedIndex ? 'search-popup__row--selected' : ''}
                onClick={() => { onSelect(product); onClose() }}
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
    </div>
  )
}
