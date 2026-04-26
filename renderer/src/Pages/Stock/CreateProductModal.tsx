import React, { useEffect, useState } from 'react'
import type { ProductFromApi } from '../../electron-api'
import CategorySelector from './CategorySelector'
import SupplierSelector from './SupplierSelector'
import { validateProductForm, normalizeDecimal } from './validateProductForm'
import type { ProductFormDraft, FormErrors } from './validateProductForm'
import './CreateProductModal.css'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (product: ProductFromApi) => void
}

function emptyDraft(): ProductFormDraft {
  return { name: '', purchasePrice: '', salePrice: '', categoryId: 0, supplierId: 0, barcode: '', stock: '0', minStock: '0' }
}

export default function CreateProductModal({ open, onClose, onSuccess }: Props) {
  const [draft, setDraft] = useState<ProductFormDraft>(emptyDraft())
  const [errors, setErrors] = useState<FormErrors | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setDraft(emptyDraft())
      setErrors(null)
      setSubmitting(false)
      setApiError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, submitting, onClose])

  function updateField(field: keyof ProductFormDraft, value: string | number) {
    setDraft((d) => ({ ...d, [field]: value }))
    setErrors((e) => (e ? { ...e, [field]: undefined } : null))
  }

  async function handleSubmit() {
    const errs = validateProductForm(draft)
    if (errs) {
      setErrors(errs)
      return
    }

    const payload = {
      name: draft.name.trim(),
      purchasePrice: normalizeDecimal(draft.purchasePrice),
      salePrice: normalizeDecimal(draft.salePrice),
      categoryId: draft.categoryId,
      supplierId: draft.supplierId,
      barcode: draft.barcode.trim() || null,
      stock: draft.stock.trim() === '' ? 0 : Number(draft.stock),
      minStock: draft.minStock.trim() === '' ? 0 : Number(draft.minStock)
    }

    setSubmitting(true)
    setApiError(null)
    try {
      const product = await window.api.createProduct(payload)
      onSuccess(product)
      // note: parent closes modal by onSuccess handler
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Error al crear el producto')
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="create-product-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="create-product-modal">
        <h2 className="create-product-modal__title">Nuevo producto</h2>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Nombre *</label>
          <input
            type="text"
            className={`create-product-modal__input${errors?.name ? ' create-product-modal__input--error' : ''}`}
            value={draft.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Nombre del producto"
          />
          {errors?.name && <p className="create-product-modal__field-error">{errors.name}</p>}
        </div>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Precio de compra *</label>
          <input
            type="text"
            inputMode="decimal"
            className={`create-product-modal__input${errors?.purchasePrice ? ' create-product-modal__input--error' : ''}`}
            value={draft.purchasePrice}
            onChange={(e) => updateField('purchasePrice', e.target.value)}
            placeholder="0.00"
          />
          {errors?.purchasePrice && <p className="create-product-modal__field-error">{errors.purchasePrice}</p>}
        </div>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Precio de venta *</label>
          <input
            type="text"
            inputMode="decimal"
            className={`create-product-modal__input${errors?.salePrice ? ' create-product-modal__input--error' : ''}`}
            value={draft.salePrice}
            onChange={(e) => updateField('salePrice', e.target.value)}
            placeholder="0.00"
          />
          {errors?.salePrice && <p className="create-product-modal__field-error">{errors.salePrice}</p>}
        </div>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Categoría *</label>
          <CategorySelector value={draft.categoryId} onChange={(id) => updateField('categoryId', id)} error={errors?.categoryId} />
        </div>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Proveedor *</label>
          <SupplierSelector value={draft.supplierId} onChange={(id) => updateField('supplierId', id)} error={errors?.supplierId} />
        </div>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Código de barras (opcional)</label>
          <input
            type="text"
            inputMode="numeric"
            className={`create-product-modal__input${errors?.barcode ? ' create-product-modal__input--error' : ''}`}
            value={draft.barcode}
            onChange={(e) => updateField('barcode', e.target.value)}
            placeholder="Sólo dígitos"
          />
          {errors?.barcode && <p className="create-product-modal__field-error">{errors.barcode}</p>}
        </div>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Stock inicial (opcional)</label>
          <input
            type="text"
            inputMode="numeric"
            className={`create-product-modal__input${errors?.stock ? ' create-product-modal__input--error' : ''}`}
            value={draft.stock}
            onChange={(e) => updateField('stock', e.target.value)}
            placeholder="0"
          />
          {errors?.stock && <p className="create-product-modal__field-error">{errors.stock}</p>}
        </div>

        <div className="create-product-modal__field">
          <label className="create-product-modal__label">Stock mínimo (opcional)</label>
          <input
            type="text"
            inputMode="numeric"
            className={`create-product-modal__input${errors?.minStock ? ' create-product-modal__input--error' : ''}`}
            value={draft.minStock}
            onChange={(e) => updateField('minStock', e.target.value)}
            placeholder="0"
          />
          {errors?.minStock && <p className="create-product-modal__field-error">{errors.minStock}</p>}
        </div>

        {apiError && <p className="create-product-modal__api-error">{apiError}</p>}

        <div className="create-product-modal__actions">
          <button className="create-product-modal__btn-cancel" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button className="create-product-modal__btn-submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  )
}
