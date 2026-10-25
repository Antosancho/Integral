import { useEffect, useRef, useState } from 'react'
import { CircleAlert, ScanBarcode } from 'lucide-react'
import type { ProductFromApi } from '../../electron-api'
import { Button } from '../../ui/Button'
import { DateField } from '../../ui/DateField'
import { Field } from '../../ui/Field'
import { Modal } from '../../ui/Modal'
import { formatAmountInput, formatMoney } from '../../utils/format'
import { parseDateAR, parseDecimal, parseInteger } from '../../utils/parse'
import {
  DEFAULT_PRICING_PREFS,
  ROUNDING_STEPS,
  autoSalePriceText,
  formatMarginInput,
  loadPricingPrefs,
  parseMarginInput,
  roundingStepLabel,
  savePricingPrefs,
  toRoundingStep,
} from '../../utils/pricing'
import type { RoundingStep } from '../../utils/pricing'
import CategoryPicker from './CategoryPicker'
import SupplierPicker from './SupplierPicker'
import { FIELD_ORDER, marginInfo, priceToPayload, validateProductForm } from './validateProductForm'
import type { FormErrors, ProductFormDraft } from './validateProductForm'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (product: ProductFromApi) => void
  /** Si está presente, el modal opera en modo edición; si no, en modo creación. */
  product?: ProductFromApi
  /** Valores con los que arranca el modo creación (ej. el código escaneado que no existía). */
  initialValues?: { name?: string; barcode?: string }
}

/** Campos que pueden recibir foco por validación (los de `FIELD_ORDER` + el vencimiento). */
type FocusableField = (typeof FIELD_ORDER)[number] | 'expiry'

/** Draft para el modo creación, opcionalmente precargado. */
function emptyDraft(initial?: Props['initialValues']): ProductFormDraft {
  return {
    name: initial?.name ?? '',
    purchasePrice: '',
    salePrice: '',
    categoryId: 0,
    supplierId: 0,
    barcode: initial?.barcode ?? '',
    stock: '0',
    minStock: '0',
  }
}

/** Convierte un ProductFromApi al draft editable del formulario (precios formateados es-AR). */
function productToDraft(p: ProductFromApi): ProductFormDraft {
  return {
    name: p.name,
    purchasePrice: formatAmountInput(p.purchasePrice),
    salePrice: formatAmountInput(p.salePrice),
    categoryId: p.categoryId,
    supplierId: p.supplierId,
    barcode: p.barcode !== null ? p.barcode.toString() : '',
    stock: String(p.stock),
    minStock: String(p.minStock),
  }
}

/** Porcentaje con 1 decimal y coma: 44.848 → "44,8". */
function formatMarginPct(pct: number): string {
  return pct.toFixed(1).replace('.', ',')
}

/** Configuración vigente del cálculo automático del precio de venta. */
type PricingConfig = { auto: boolean; margin: number; step: RoundingStep }

/** Si el cálculo está activo, devuelve el draft con el precio de venta recalculado desde el costo. */
function withAutoSale(d: ProductFormDraft, p: PricingConfig): ProductFormDraft {
  return p.auto ? { ...d, salePrice: autoSalePriceText(d.purchasePrice, p.margin, p.step) } : d
}

/**
 * Modal de alta y edición de producto.
 *
 * - Modo creación: stock inicial editable y, si es > 0, vencimiento del lote inicial.
 * - Modo edición (`product`): el stock es solo lectura (se modifica con "Cargar stock").
 * - Ctrl+Enter guarda desde cualquier campo; Esc con cambios pide confirmación antes de descartar.
 * - Al guardar con errores se muestran todos y el foco va al primer campo inválido.
 * - Precio con margen: el checkbox «Calcular con margen» completa el precio de venta con `utils/pricing`; tipear el precio a mano apaga el cálculo solo para ese producto; en alta arranca según la preferencia recordada y en edición apagado.
 */
export default function ProductFormModal({ open, onClose, onSuccess, product, initialValues }: Props) {
  const isEdit = !!product

  const [draft, setDraft] = useState<ProductFormDraft>(emptyDraft())
  const [errors, setErrors] = useState<FormErrors | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  /** Error de código de barras duplicado, detectado recién al guardar (lo informa el backend). */
  const [barcodeTakenError, setBarcodeTakenError] = useState<string | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [expiryError, setExpiryError] = useState<string | null>(null)
  const [showDiscard, setShowDiscard] = useState(false)
  /** Cálculo automático del precio de venta (preferencias en utils/pricing). */
  const [autoPrice, setAutoPrice] = useState(false)
  const [marginPct, setMarginPct] = useState(DEFAULT_PRICING_PREFS.marginPct)
  const [marginInput, setMarginInput] = useState(formatMarginInput(DEFAULT_PRICING_PREFS.marginPct))
  const [roundingStep, setRoundingStep] = useState<RoundingStep>(DEFAULT_PRICING_PREFS.roundingStep)

  /** JSON del draft inicial: sirve para saber si el usuario cambió algo (`dirty`). */
  const [baseline, setBaseline] = useState('')
  const fieldRefs = useRef<Partial<Record<FocusableField, HTMLElement | null>>>({})
  const nameRef = useRef<HTMLInputElement>(null)
  const discardKeepRef = useRef<HTMLButtonElement>(null)

  const initialName = initialValues?.name
  const initialBarcode = initialValues?.barcode

  /** Precarga o limpia el formulario al abrir, o al cambiar el producto en edición. */
  useEffect(() => {
    const base = product ? productToDraft(product) : emptyDraft({ name: initialName, barcode: initialBarcode })
    setDraft(base)
    setBaseline(JSON.stringify(base))
    setErrors(null)
    setSubmitting(false)
    setSaveFailed(false)
    setBarcodeTakenError(null)
    setExpiryDate('')
    setExpiryError(null)
    setShowDiscard(false)
    const prefs = loadPricingPrefs()
    setAutoPrice(product ? false : prefs.enabled) // en edición siempre arranca apagado: no pisa el precio guardado
    setMarginPct(prefs.marginPct)
    setMarginInput(formatMarginInput(prefs.marginPct))
    setRoundingStep(prefs.roundingStep)
  }, [open, product, initialName, initialBarcode])

  const stockCount = parseInteger(draft.stock) ?? 0
  const showExpiry = !isEdit && stockCount > 0
  const dirty = baseline !== '' && (JSON.stringify(draft) !== baseline || expiryDate !== '')
  const margin = marginInfo(draft.purchasePrice, draft.salePrice)

  function setRef(field: FocusableField) {
    return (el: HTMLElement | null) => {
      fieldRefs.current[field] = el
    }
  }

  const pricing: PricingConfig = { auto: autoPrice, margin: marginPct, step: roundingStep }

  function updateField(field: keyof ProductFormDraft, value: string | number) {
    setDraft((d) => {
      const next: ProductFormDraft = { ...d, [field]: value }
      // Con el cálculo activo, el precio de venta sigue al costo.
      return field === 'purchasePrice' ? withAutoSale(next, pricing) : next
    })
    setErrors((e) => {
      if (!e) return null
      const cleared: FormErrors = { ...e, [field]: undefined }
      if (field === 'purchasePrice' && autoPrice) cleared.salePrice = undefined
      return cleared
    })
    if (field === 'barcode') setBarcodeTakenError(null)
  }

  /** Reformatea un precio al salir del campo (solo si parsea: si no, se deja para que lo corrija). */
  function formatPriceOnBlur(field: 'purchasePrice' | 'salePrice') {
    const n = parseDecimal(draft[field])
    if (n !== null) updateField(field, formatAmountInput(n))
  }

  /** Tildar/destildar "Calcular con margen". Tildar recalcula ya; destildar deja el último valor (editable). */
  function handleAutoPriceChange(next: boolean) {
    setAutoPrice(next)
    if (!isEdit) savePricingPrefs({ enabled: next }) // en edición no cambia cómo arranca el alta
    if (next) {
      setDraft((d) => withAutoSale(d, { ...pricing, auto: true }))
      setErrors((e) => (e ? { ...e, salePrice: undefined } : null))
    }
  }

  /** Margen tipeado: si es válido se aplica y se recuerda en el momento; si no, se ignora hasta salir del campo. */
  function handleMarginInputChange(text: string) {
    setMarginInput(text)
    const n = parseMarginInput(text)
    if (n === null) return
    setMarginPct(n)
    savePricingPrefs({ marginPct: n })
    setDraft((d) => withAutoSale(d, { ...pricing, margin: n }))
  }

  /** Al salir del margen (blur o Enter) se muestra el último margen válido, normalizado ("30,50" → "30,5"). */
  function normalizeMarginInput() {
    setMarginInput(formatMarginInput(marginPct))
  }

  function handleRoundingChange(step: RoundingStep) {
    setRoundingStep(step)
    savePricingPrefs({ roundingStep: step })
    setDraft((d) => withAutoSale(d, { ...pricing, step }))
  }

  /** Tipear el precio de venta con el cálculo activo lo apaga SOLO para este producto (no se guarda la preferencia). */
  function handleSaleInputChange(text: string) {
    if (autoPrice) setAutoPrice(false)
    updateField('salePrice', text)
  }

  /** Cierre pedido por el usuario (Cancelar, X, Esc): con cambios, pide confirmación. */
  function requestClose() {
    if (submitting) return
    if (dirty) setShowDiscard(true)
    else onClose()
  }

  function focusField(field: FocusableField) {
    fieldRefs.current[field]?.focus()
  }

  async function handleSubmit() {
    if (submitting) return

    const errs = validateProductForm(draft)

    // Vencimiento: solo en creación con stock inicial > 0 y fecha tipeada.
    let parsedExpiry: Date | null = null
    let expiryErr: string | null = null
    if (showExpiry && expiryDate.trim() !== '') {
      parsedExpiry = parseDateAR(expiryDate)
      if (!parsedExpiry) expiryErr = 'Revisá la fecha (DD/MM/AAAA).'
    }

    if (errs || expiryErr) {
      setErrors(errs)
      setExpiryError(expiryErr)
      const first: FocusableField | undefined = FIELD_ORDER.find((f) => errs?.[f]) ?? (expiryErr ? 'expiry' : undefined)
      if (first) focusField(first)
      return
    }

    /**
     * Payload base sin `stock`: en edición el stock se gestiona exclusivamente
     * mediante "Cargar stock", no desde este formulario.
     */
    const payload = {
      name: draft.name.trim(),
      purchasePrice: priceToPayload(draft.purchasePrice),
      salePrice: priceToPayload(draft.salePrice),
      categoryId: draft.categoryId,
      supplierId: draft.supplierId,
      barcode: draft.barcode.trim() || null,
      minStock: parseInteger(draft.minStock) ?? 0,
    }

    setSubmitting(true)
    setSaveFailed(false)
    try {
      const result = isEdit
        ? await window.api.updateProduct(product!.id, payload)
        : await window.api.createProduct({
            ...payload,
            stock: parseInteger(draft.stock) ?? 0,
            ...(parsedExpiry ? { expiryDate: parsedExpiry } : {}),
          })
      onSuccess(result)
      // El componente padre cierra el modal a través del callback onSuccess.
    } catch (e) {
      setSubmitting(false)
      const message = e instanceof Error ? e.message : ''
      const barcode = draft.barcode.trim()
      // Código duplicado: se busca quién lo usa para decírselo al usuario.
      if (barcode !== '' && /unique|barcode/i.test(message)) {
        try {
          const other = await window.api.getProductByBarcode(barcode)
          if (other && other.id !== product?.id) {
            setBarcodeTakenError(`Ese código ya lo usa «${other.name}». Usá otro o dejalo vacío.`)
            focusField('barcode')
            return
          }
        } catch {
          // Si la consulta falla, se cae al error genérico de abajo.
        }
      }
      console.error(e)
      setSaveFailed(true)
    }
  }

  const barcodeError = errors?.barcode ?? barcodeTakenError
  const lossMaking = margin !== null && margin.profit < 0

  /** Ayuda bajo "Precio de venta": falta el costo (cálculo activo) · venta bajo costo · margen real. */
  function saleHelpContent(): React.ReactNode {
    if (autoPrice && autoSalePriceText(draft.purchasePrice, marginPct, roundingStep) === '') {
      return 'Completá el precio de compra para calcularlo.'
    }
    if (!margin) return undefined
    if (lossMaking) return <span style={{ color: 'var(--warning)' }}>Estás vendiendo por debajo del costo.</span>
    return `Margen: ${formatMarginPct(margin.pct)} % · ganancia ${formatMoney(margin.profit)} por unidad`
  }
  const saleHelp = saleHelpContent()

  return (
    <>
      <Modal
        open={open}
        title={isEdit ? 'Editar producto' : 'Nuevo producto'}
        subtitle={isEdit ? product!.name : 'Los campos con * son obligatorios.'}
        size="md"
        className="pf-modal"
        closeOnOverlay={false}
        initialFocusRef={nameRef}
        onClose={requestClose}
        onEscape={requestClose}
        shortcuts={[
          { keys: ['Esc'], label: 'Cancelar' },
          { keys: ['Ctrl', 'Enter'], label: 'Guardar' },
        ]}
        footer={
          <>
            {saveFailed && (
              <span className="ig-error" role="alert">
                <CircleAlert size={16} aria-hidden="true" className="ig-icon ig-icon-sm" />
                No se pudo guardar el producto. Probá de nuevo.
              </span>
            )}
            <Button variant="ghost" onClick={requestClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar producto'}
            </Button>
          </>
        }
      >
        {/* Ctrl+Enter guarda desde cualquier campo; el div solo captura el atajo, no es interactivo. */}
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
        >
          <div className="pf-grid">
            <Field label="Nombre" htmlFor="pf-name" required error={errors?.name} className="span-2">
              <input
                id="pf-name"
                ref={(el) => {
                  nameRef.current = el
                  setRef('name')(el)
                }}
                className={errors?.name ? 'ig-input is-error' : 'ig-input'}
                aria-invalid={!!errors?.name}
                aria-describedby={errors?.name ? 'pf-name-error' : undefined}
                value={draft.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </Field>

            <CategoryPicker
              id="pf-category"
              valueId={draft.categoryId}
              onChange={(id) => updateField('categoryId', id)}
              error={errors?.categoryId}
              triggerRef={setRef('categoryId')}
            />
            <SupplierPicker
              id="pf-supplier"
              valueId={draft.supplierId}
              onChange={(id) => updateField('supplierId', id)}
              error={errors?.supplierId}
              triggerRef={setRef('supplierId')}
            />

            <Field label="Precio de compra" htmlFor="pf-purchase" required error={errors?.purchasePrice}>
              <div className="ig-input-wrap">
                <span className="ig-prefix">$</span>
                <input
                  id="pf-purchase"
                  ref={setRef('purchasePrice')}
                  className={`ig-input ig-input-amount${errors?.purchasePrice ? ' is-error' : ''}`}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-invalid={!!errors?.purchasePrice}
                  aria-describedby={errors?.purchasePrice ? 'pf-purchase-error' : undefined}
                  value={draft.purchasePrice}
                  onChange={(e) => updateField('purchasePrice', e.target.value)}
                  onBlur={() => formatPriceOnBlur('purchasePrice')}
                />
              </div>
            </Field>

            {/* Calcular con margen + Margen (%): el checkbox hace de label del campo */}
            <div className="ig-field">
              <label className="pf-auto">
                <input id="pf-auto-price" type="checkbox" checked={autoPrice} onChange={(e) => handleAutoPriceChange(e.target.checked)} />
                Calcular con margen
              </label>
              <div className="ig-input-wrap">
                <input
                  id="pf-margin"
                  className="ig-input ig-input-amount pf-margin-input"
                  inputMode="decimal"
                  aria-label="Margen (%)"
                  aria-describedby="pf-margin-help"
                  disabled={!autoPrice}
                  value={marginInput}
                  onChange={(e) => handleMarginInputChange(e.target.value)}
                  onBlur={normalizeMarginInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault()
                      normalizeMarginInput()
                    }
                  }}
                />
                <span className="ig-suffix" aria-hidden="true">%</span>
              </div>
              <span className="ig-help" id="pf-margin-help">Sobre el precio de compra.</span>
            </div>

            <Field label="Redondeo" htmlFor="pf-rounding" help="Al más cercano.">
              <select
                id="pf-rounding"
                className="ig-input"
                aria-describedby="pf-rounding-help"
                disabled={!autoPrice}
                value={String(roundingStep)}
                onChange={(e) => {
                  const step = toRoundingStep(Number(e.target.value))
                  if (step !== null) handleRoundingChange(step)
                }}
              >
                {ROUNDING_STEPS.map((s) => (
                  <option key={s} value={String(s)}>
                    {roundingStepLabel(s)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Precio de venta" htmlFor="pf-sale" required error={errors?.salePrice} help={saleHelp}>
              <div className="ig-input-wrap">
                <span className="ig-prefix">$</span>
                <input
                  id="pf-sale"
                  ref={setRef('salePrice')}
                  className={`ig-input ig-input-amount${errors?.salePrice ? ' is-error' : ''}`}
                  inputMode="decimal"
                  placeholder="0,00"
                  aria-invalid={!!errors?.salePrice}
                  aria-describedby={errors?.salePrice ? 'pf-sale-error' : saleHelp ? 'pf-sale-help' : undefined}
                  value={draft.salePrice}
                  onChange={(e) => handleSaleInputChange(e.target.value)}
                  onBlur={() => formatPriceOnBlur('salePrice')}
                />
              </div>
            </Field>

            <Field
              label="Código de barras"
              htmlFor="pf-barcode"
              className="span-2"
              error={barcodeError}
              help="Podés escanearlo con el lector. Solo números, hasta 20."
            >
              <div className="ig-input-wrap">
                <ScanBarcode size={18} strokeWidth={2} aria-hidden="true" className="ig-icon" />
                <input
                  id="pf-barcode"
                  ref={setRef('barcode')}
                  className={barcodeError ? 'ig-input is-error' : 'ig-input'}
                  style={{ fontFamily: 'var(--font-mono)' }}
                  inputMode="numeric"
                  aria-invalid={!!barcodeError}
                  aria-describedby={barcodeError ? 'pf-barcode-error' : 'pf-barcode-help'}
                  value={draft.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  onKeyDown={(e) => {
                    // El Enter del lector no guarda el formulario: pasa al siguiente campo.
                    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                      e.preventDefault()
                      focusField(isEdit ? 'minStock' : 'stock')
                    }
                  }}
                />
              </div>
            </Field>

            {isEdit ? (
              <Field label="Stock" htmlFor="pf-stock" help="Para modificar el stock usá «Cargar stock».">
                <input
                  id="pf-stock"
                  className="ig-input is-readonly"
                  readOnly
                  aria-describedby="pf-stock-help"
                  value={String(product!.stock)}
                />
              </Field>
            ) : (
              <Field label="Stock inicial" htmlFor="pf-stock" error={errors?.stock}>
                <input
                  id="pf-stock"
                  ref={setRef('stock')}
                  className={errors?.stock ? 'ig-input is-error' : 'ig-input'}
                  inputMode="numeric"
                  placeholder="0"
                  aria-invalid={!!errors?.stock}
                  aria-describedby={errors?.stock ? 'pf-stock-error' : undefined}
                  value={draft.stock}
                  onChange={(e) => updateField('stock', e.target.value)}
                />
              </Field>
            )}

            <Field
              label="Stock mínimo"
              htmlFor="pf-minstock"
              error={errors?.minStock}
              help="Avisamos cuando quede igual o menos."
            >
              <input
                id="pf-minstock"
                ref={setRef('minStock')}
                className={errors?.minStock ? 'ig-input is-error' : 'ig-input'}
                inputMode="numeric"
                placeholder="0"
                aria-invalid={!!errors?.minStock}
                aria-describedby={errors?.minStock ? 'pf-minstock-error' : 'pf-minstock-help'}
                value={draft.minStock}
                onChange={(e) => updateField('minStock', e.target.value)}
              />
            </Field>

            {showExpiry && (
              <DateField
                id="pf-expiry"
                label="Vencimiento del lote"
                className="pf-expiry"
                value={expiryDate}
                onChange={(v) => {
                  setExpiryDate(v)
                  setExpiryError(null)
                }}
                error={expiryError}
                help="Opcional. Aparece porque cargaste stock inicial."
                inputRef={setRef('expiry')}
              />
            )}
          </div>

        </div>
      </Modal>

      <Modal
        open={open && showDiscard}
        title="¿Descartar los cambios?"
        subtitle="Lo que tipeaste se va a perder."
        size="sm"
        hideCloseButton
        initialFocusRef={discardKeepRef}
        onClose={() => setShowDiscard(false)}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowDiscard(false)
                onClose()
              }}
            >
              Descartar
            </Button>
            <Button ref={discardKeepRef} variant="primary" onClick={() => setShowDiscard(false)}>
              Seguir editando
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    </>
  )
}
