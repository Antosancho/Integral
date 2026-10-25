import { useEffect, useRef, useState } from 'react'
import { Receipt, ScanBarcode, Search } from 'lucide-react'
import type { ProductFromApi } from '../../electron-api'
import { useSales } from '../../store/SalesContext'
import { Button } from '../../ui/Button'
import { openModalCount } from '../../ui/modalStack'
import { ShortcutBar } from '../../ui/ShortcutBar'
import { useToast } from '../../ui/Toast'
import { useFlash } from '../../ui/useFlash'
import { isEditableTarget } from '../../utils/dom'
import { formatMoney } from '../../utils/format'
import { hasValidSalePrice } from '../../utils/stock'
import BarcodeInput, { type BarcodeInputHandle } from './BarcodeInput'
import CartTable, { type CartTableHandle } from './CartTable'
import GeneralAmountPopup from './GeneralAmountPopup'
import PaymentPanel, { type PaymentPanelHandle } from './PaymentPanel'
import SearchPopup from './SearchPopup'
import { cartReducer, lineTotal } from './cartReducer'
import { buildSaleItems } from './confirmSaleUtils'
import {
  PAYMENT_EPSILON,
  PAYMENT_METHODS,
  fillRemaining,
  formatPaymentOnBlur,
  parsePaymentAmount,
  sumPayments,
  type PaymentMethod
} from './payments'

type Props = {
  /** Segmentado Nueva venta | Historial que arma `SalesPage`. */
  viewSwitcher: React.ReactNode
}

/**
 * Ventas › Nueva venta: carrito + panel de pago + confirmación.
 *
 * El estado de la venta (carrito, descuento, pagos) vive en `SalesContext`, así que sobrevive a cambiar
 * de sección. Se opera entera con teclado: el input de código es el "hogar" del foco.
 *
 * Atajos: F2 buscar · F10 ítem general · ↓ ir al carrito · Supr quitar línea · Alt+1…5 completar un medio de
 * pago · F12 aprobar · Esc volver al input de código · un dígito suelto (un escaneo) va al input de código.
 */
export default function Sells({ viewSwitcher }: Props) {
  const toast = useToast()
  const { cart, dispatchCart, discountPct, setDiscountPct, payments, setPayments, resetSale } = useSales()

  const [popupOpen, setPopupOpen] = useState(false)
  const [generalOpen, setGeneralOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flashLineId, flash] = useFlash<string>()

  const barcodeRef = useRef<BarcodeInputHandle | null>(null)
  const cartTableRef = useRef<CartTableHandle | null>(null)
  const payRef = useRef<PaymentPanelHandle | null>(null)
  /** Carrito más reciente: permite escanear varias veces seguidas antes de que React re-renderice. */
  const cartRef = useRef(cart)
  const prevPopupOpen = useRef(false)
  const prevGeneralOpen = useRef(false)

  // ── Totales ──────────────────────────────────────────────────────────────
  const subtotal = cart.lines.reduce((acc, l) => acc + lineTotal(l), 0)
  const total = Math.max(0, subtotal * (1 - discountPct / 100))
  const paid = sumPayments(payments)

  /** Por qué no se puede aprobar (null = se puede). Las líneas General sí se aprueban. */
  const disabledReason: string | null =
    cart.lines.length === 0
      ? 'Agregá al menos un producto'
      : paid < total - PAYMENT_EPSILON
        ? `Falta cubrir ${formatMoney(total - paid)}`
        : null
  const canApprove = disabledReason === null

  const focusBarcode = () => barcodeRef.current?.focus()

  // ── Agregar al carrito ───────────────────────────────────────────────────
  /** Agrega un producto. Devuelve false si no se pudo (sin precio). Stock insuficiente avisa pero agrega. */
  function addProduct(product: ProductFromApi): boolean {
    if (!hasValidSalePrice(product)) {
      toast.show({
        tone: 'danger',
        title: 'El producto no tiene un precio cargado',
        detail: `«${product.name}» — no se agregó`
      })
      return false
    }

    const action = { type: 'ADD', product } as const
    const next = cartReducer(cartRef.current, action)
    const line = next.lines.find((l) => l.kind === 'product' && l.productId === product.id)
    cartRef.current = next
    dispatchCart(action)

    if (line) {
      flash(line.lineId)
      if (line.quantity > product.stock) {
        toast.show({ tone: 'warning', title: 'Sin stock suficiente', detail: `«${product.name}» se agregó igual` })
      }
    }
    return true
  }

  async function handleScan(code: string): Promise<boolean> {
    try {
      const product = await window.api.getProductByBarcode(code)
      if (!product) {
        toast.show({ tone: 'danger', title: 'Producto no encontrado', detail: `Código ${code}` })
        return false
      }
      return addProduct(product)
    } catch {
      toast.show({ tone: 'danger', title: 'Producto no encontrado', detail: `Código ${code}` })
      return false
    }
  }

  function handleConfirmGeneral(amount: string) {
    const action = { type: 'ADD_GENERAL', amount } as const
    const next = cartReducer(cartRef.current, action)
    cartRef.current = next
    dispatchCart(action)
    const added = next.lines[next.lines.length - 1]
    if (added) flash(added.lineId)
  }

  // ── Pagos ────────────────────────────────────────────────────────────────
  function handlePaymentChange(method: PaymentMethod, value: string) {
    setPayments((prev) => ({ ...prev, [method]: value }))
  }

  function handlePaymentBlur(method: PaymentMethod) {
    setPayments((prev) => ({ ...prev, [method]: formatPaymentOnBlur(prev[method]) }))
  }

  function handleFillRemaining(method: PaymentMethod) {
    setPayments((prev) => fillRemaining(prev, method, total))
  }

  // ── Confirmación ─────────────────────────────────────────────────────────
  async function handleApprove() {
    if (!canApprove || saving) return
    setSaving(true)
    try {
      await window.api.createSale({
        items: buildSaleItems(cart.lines),
        payments: PAYMENT_METHODS.map((m) => ({ method: m, amount: parsePaymentAmount(payments[m]) })).filter(
          (p) => p.amount > 0
        ),
        total: Math.round(total * 100) / 100,
        discountPct
      })
      resetSale()
      setTimeout(focusBarcode, 0)
    } catch (e) {
      console.error(e)
      toast.show({ tone: 'danger', title: 'No se pudo guardar la venta. Probá de nuevo.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Efectos ──────────────────────────────────────────────────────────────
  useEffect(() => {
    cartRef.current = cart
  }, [cart])

  // Los handlers del listener global se leen de un ref actualizado en cada render (evita closures viejas).
  const latest = useRef({
    approve: () => {},
    fillMethod: ((): void => {}) as (m: PaymentMethod) => void,
    hasLines: false,
    popupOpen: false,
    generalOpen: false
  })
  useEffect(() => {
    latest.current = {
      approve: handleApprove,
      fillMethod: (m) => {
        handleFillRemaining(m)
        setTimeout(() => payRef.current?.focusMethod(m), 0)
      },
      hasLines: cart.lines.length > 0,
      popupOpen,
      generalOpen
    }
  })

  // Al cerrar F2 / F10 el foco vuelve al input de código.
  useEffect(() => {
    if (prevPopupOpen.current && !popupOpen) setTimeout(focusBarcode, 0)
    prevPopupOpen.current = popupOpen
  }, [popupOpen])
  useEffect(() => {
    if (prevGeneralOpen.current && !generalOpen) setTimeout(focusBarcode, 0)
    prevGeneralOpen.current = generalOpen
  }, [generalOpen])

  // Atajos globales de la pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = latest.current

      // F2 / F10: se alternan entre sí y con su propio popup; con un modal de otra pantalla encima no hacen nada.
      if (e.key === 'F2' || e.key === 'F10') {
        e.preventDefault()
        if (openModalCount() > (h.popupOpen || h.generalOpen ? 1 : 0)) return
        if (e.key === 'F2') {
          setPopupOpen(!h.popupOpen)
          setGeneralOpen(false)
        } else {
          setGeneralOpen(!h.generalOpen)
          setPopupOpen(false)
        }
        return
      }

      if (openModalCount() > 0) return

      if (e.key === 'F12') {
        e.preventDefault()
        h.approve()
        return
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault()
        if (h.hasLines) h.fillMethod(PAYMENT_METHODS[Number(e.key) - 1])
        return
      }

      if (e.key === 'Escape' && !e.defaultPrevented) {
        focusBarcode()
        return
      }

      // Un dígito suelto fuera de un campo es un escaneo: va al input de código antes de procesarse.
      if (/^\d$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey && !isEditableTarget(e.target)) {
        focusBarcode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <main className="ig-page" style={{ paddingBottom: 16, gap: 12 }}>
        <div className="ig-page-head">
          <h1>Ventas</h1>
          {viewSwitcher}
          <div className="ig-spacer" />
          <Button size="sm" icon={Search} shortcut="F2" onClick={() => { setPopupOpen((v) => !v); setGeneralOpen(false) }}>
            Buscar
          </Button>
          <Button size="sm" icon={Receipt} shortcut="F10" onClick={() => { setGeneralOpen((v) => !v); setPopupOpen(false) }}>
            Ítem general
          </Button>
        </div>

        <BarcodeInput ref={barcodeRef} onScan={handleScan} onArrowDown={() => cartTableRef.current?.focusFirstRow()} />

        <ShortcutBar
          items={[
            { keys: ['F2'], label: 'Buscar producto' },
            { keys: ['F10'], label: 'Ítem general' },
            { keys: ['↓'], label: 'Ir al carrito' },
            { keys: ['Supr'], label: 'Quitar línea' },
            { keys: ['F12'], label: 'Aprobar venta' }
          ]}
        />

        {cart.lines.length === 0 ? (
          <div className="ig-card">
            <div className="ig-cart-empty">
              <div className="ig-empty">
                <div className="ico">
                  <ScanBarcode size={22} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-lg" />
                </div>
              </div>
              <h3>Escaneá un producto para empezar</h3>
              <ShortcutBar
                items={[
                  { keys: ['F2'], label: 'Buscar por nombre' },
                  { keys: ['F10'], label: 'Monto suelto' }
                ]}
              />
            </div>
          </div>
        ) : (
          <CartTable
            ref={cartTableRef}
            lines={cart.lines}
            flashLineId={flashLineId}
            onQuantityChange={(id, q) => dispatchCart({ type: 'SET_QUANTITY', lineId: id, quantity: q })}
            onUnitPriceChange={(id, price) => dispatchCart({ type: 'SET_UNIT_PRICE', lineId: id, unitPrice: price })}
            onRemove={(id) => dispatchCart({ type: 'REMOVE', lineId: id })}
            onExit={focusBarcode}
          />
        )}
      </main>

      {cart.lines.length > 0 && (
        <PaymentPanel
          ref={payRef}
          subtotal={subtotal}
          total={total}
          discountPct={discountPct}
          onDiscountChange={setDiscountPct}
          payments={payments}
          onPaymentChange={handlePaymentChange}
          onPaymentBlur={handlePaymentBlur}
          onFillRemaining={handleFillRemaining}
          canApprove={canApprove}
          disabledReason={disabledReason}
          onApprove={handleApprove}
          saving={saving}
        />
      )}

      <SearchPopup open={popupOpen} warnMissingPrice onClose={() => setPopupOpen(false)} onSelect={addProduct} />

      <GeneralAmountPopup open={generalOpen} onClose={() => setGeneralOpen(false)} onConfirm={handleConfirmGeneral} />
    </>
  )
}
