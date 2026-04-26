import { useEffect, useReducer, useRef, useState } from 'react'
import type { ProductFromApi } from '../../electron-api'
import BarcodeInput, { type BarcodeInputHandle } from './BarcodeInput'
import CartList from './CartList'
import GeneralAmountPopup from './GeneralAmountPopup'
import PaymentPanel from './PaymentPanel'
import SearchPopup from './SearchPopup'
import { cartReducer, initialCart, lineTotal } from './cartReducer'
import { buildSaleItems } from './confirmSaleUtils'
import {
  PAYMENT_METHODS,
  initialPayments,
  autoFillFor,
  formatPaymentAmount,
  parsePaymentAmount,
  type PaymentMethod,
  type PaymentsDraft
} from './payments'
import './Sells.css'

type AlertKind = 'not-found' | 'no-stock' | 'no-price'

export default function Sells() {
  const [cart, dispatch] = useReducer(cartReducer, initialCart)
  const [popupOpen, setPopupOpen] = useState(false)
  const [generalPopupOpen, setGeneralPopupOpen] = useState(false)
  const [alert, setAlert] = useState<{ kind: AlertKind; text: string } | null>(null)
  const [discountPct, setDiscountPct] = useState(0)
  const [payments, setPayments] = useState<PaymentsDraft>(initialPayments)
  const barcodeInputRef = useRef<BarcodeInputHandle | null>(null)
  const cartRef = useRef(cart)
  const prevOpenRef = useRef(false)
  const prevGeneralOpenRef = useRef(false)

  useEffect(() => { cartRef.current = cart }, [cart])

  useEffect(() => {
    if (!alert) return
    const timer = setTimeout(() => setAlert(null), 4000)
    return () => clearTimeout(timer)
  }, [alert])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setPopupOpen(prev => {
          const next = !prev
          if (next) setGeneralPopupOpen(false)
          return next
        })
      } else if (e.key === 'F10') {
        e.preventDefault()
        setGeneralPopupOpen(prev => {
          const next = !prev
          if (next) setPopupOpen(false)
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (prevOpenRef.current && !popupOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 0)
    }
    prevOpenRef.current = popupOpen
  }, [popupOpen])

  useEffect(() => {
    if (prevGeneralOpenRef.current && !generalPopupOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 0)
    }
    prevGeneralOpenRef.current = generalPopupOpen
  }, [generalPopupOpen])

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
    const newLine = nextState.lines.find(
      l => l.kind === 'product' && l.productId === product.id
    )
    cartRef.current = nextState
    dispatch(action)

    if (newLine && newLine.quantity > product.stock) {
      setAlert({
        kind: 'no-stock',
        text: `Sin stock suficiente de "${product.name}" (stock: ${product.stock})`
      })
    }
  }

  function handleConfirmGeneral(amount: string) {
    dispatch({ type: 'ADD_GENERAL', amount })
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

  function handlePaymentChange(method: PaymentMethod, value: string) {
    setPayments(prev => ({ ...prev, [method]: value }))
  }

  function handleAutoFillPayment(method: PaymentMethod) {
    const amount = autoFillFor(payments, method, total)
    setPayments(prev => ({ ...prev, [method]: formatPaymentAmount(amount) }))
  }

  async function handleConfirmSale() {
    // Do not allow confirming an empty cart
    if (cart.lines.length === 0) return

    const items = buildSaleItems(cart.lines)

    const paymentsPayload = PAYMENT_METHODS
      .map(m => ({ method: m, amount: parsePaymentAmount(payments[m]) }))
      .filter(p => p.amount > 0)

     try {
       await window.api.createSale({ items, payments: paymentsPayload, total, discountPct })
       dispatch({ type: 'RESET' })
       setDiscountPct(0)
       setPayments(initialPayments)
       setTimeout(() => barcodeInputRef.current?.focus(), 0)
     } catch (e) {
       setAlert({ kind: 'not-found', text: e instanceof Error ? e.message : 'Error al guardar la venta' })
     }
  }

  const subtotal = cart.lines.reduce((acc, l) => acc + lineTotal(l), 0)
  const total = Math.max(0, subtotal * (1 - discountPct / 100))
  const hasItems = cart.lines.length > 0

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
        onQuantityChange={(id, q) => dispatch({ type: 'SET_QUANTITY', lineId: id, quantity: q })}
        onUnitPriceChange={(id, p) => dispatch({ type: 'SET_UNIT_PRICE', lineId: id, unitPrice: p })}
        onRemove={(id) => dispatch({ type: 'REMOVE', lineId: id })}
      />

      <PaymentPanel
        subtotal={subtotal}
        total={total}
        discountPct={discountPct}
        onDiscountChange={setDiscountPct}
        payments={payments}
        onPaymentChange={handlePaymentChange}
        onAutoFill={handleAutoFillPayment}
        hasItems={hasItems}
        onConfirm={handleConfirmSale}
      />

      <SearchPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        onSelect={handleSelectFromPopup}
      />

      <GeneralAmountPopup
        open={generalPopupOpen}
        onClose={() => setGeneralPopupOpen(false)}
        onConfirm={handleConfirmGeneral}
      />
    </section>
  )
}
