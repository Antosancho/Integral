import { useEffect, useReducer, useRef, useState } from 'react'
import type { ProductFromApi } from '../../electron-api'
import BarcodeInput, { type BarcodeInputHandle } from './BarcodeInput'
import CartList from './CartList'
import SearchPopup from './SearchPopup'
import { cartReducer, initialCart } from './cartReducer'
import './Sells.css'

type AlertKind = 'not-found' | 'no-stock' | 'no-price'

export default function Sells() {
  const [cart, dispatch] = useReducer(cartReducer, initialCart)
  const [popupOpen, setPopupOpen] = useState(false)
  const [alert, setAlert] = useState<{ kind: AlertKind; text: string } | null>(null)
  const barcodeInputRef = useRef<BarcodeInputHandle | null>(null)
  const cartRef = useRef(cart)
  const prevOpenRef = useRef(false)

  useEffect(() => { cartRef.current = cart }, [cart])

  // Auto-cerrar alerta a los 4 segundos
  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(() => setAlert(null), 4000)
    return () => clearTimeout(timer)
  }, [alert])

  // Toggle F2 global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setPopupOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Devolver foco al barcode al cerrar el popup
  useEffect(() => {
    if (prevOpenRef.current && !popupOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 0)
    }
    prevOpenRef.current = popupOpen
  }, [popupOpen])

  function hasValidPrice(product: ProductFromApi): boolean {
    const raw = product.salePrice
    if (raw === '' || raw == null) return false
    const n = Number(raw)
    return Number.isFinite(n) && n > 0
  }

  function addProduct(product: ProductFromApi) {
    if (!hasValidPrice(product)) {
      setAlert({ kind: 'no-price', text: `"${product.name}" no tiene un precio cargado` })
      return
    }

    const action = { type: 'ADD', product } as const
    const nextState = cartReducer(cartRef.current, action)
    const newLine = nextState.lines.find(l => l.productId === product.id)
    cartRef.current = nextState
    dispatch(action)

    if (newLine && newLine.quantity > product.stock) {
      setAlert({
        kind: 'no-stock',
        text: `Sin stock suficiente de "${product.name}" (stock: ${product.stock})`
      })
    }
  }

  async function handleScan(barcode: string) {
    setAlert(null)
    try {
      const product = await window.api.getProductByBarcode(barcode)
      if (!product) {
        setAlert({ kind: 'not-found', text: `Producto con código ${barcode} no encontrado` })
        return
      }
      addProduct(product)
    } catch {
      setAlert({ kind: 'not-found', text: `Código inválido: ${barcode}` })
    }
  }

  function handleSelectFromPopup(product: ProductFromApi) {
    setPopupOpen(false)
    addProduct(product)
  }

  return (
    <section className="sells">
      <BarcodeInput
        ref={barcodeInputRef}
        onScan={handleScan}
        onRequestSearch={() => setPopupOpen(prev => !prev)}
      />

      {alert && (
        <div className={`alert-banner alert-banner--${alert.kind}`}>
          <span>{alert.text}</span>
          <button type="button" onClick={() => setAlert(null)}>✕</button>
        </div>
      )}

      <CartList
        lines={cart.lines}
        onQuantityChange={(id, q) => dispatch({ type: 'SET_QUANTITY', productId: id, quantity: q })}
        onUnitPriceChange={(id, p) => dispatch({ type: 'SET_UNIT_PRICE', productId: id, unitPrice: p })}
        onRemove={(id) => dispatch({ type: 'REMOVE', productId: id })}
      />

      <SearchPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onSelect={handleSelectFromPopup}
      />
    </section>
  )
}
