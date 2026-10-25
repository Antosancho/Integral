// validateProductForm.ts
// Funciones y tipos para validar el formulario de producto (crear / editar).
// Contiene validación pura (sin dependencias de UI), pensada para tests unitarios.
// Los textos de error son los del design system (guia/03-estados-y-copy.md).

import { parseDecimal, parseInteger } from '../../utils/parse'

export type ProductFormDraft = {
  name: string
  purchasePrice: string
  salePrice: string
  categoryId: number
  supplierId: number
  barcode: string
  stock: string
  minStock: string
}

export type FormErrors = {
  name?: string
  purchasePrice?: string
  salePrice?: string
  categoryId?: string
  supplierId?: string
  barcode?: string
  stock?: string
  minStock?: string
}

/**
 * Orden visual (y de Tab) de los campos del formulario. Se usa para llevar el foco
 * al primer campo con error.
 */
export const FIELD_ORDER = ['name', 'categoryId', 'supplierId', 'purchasePrice', 'salePrice', 'barcode', 'stock', 'minStock'] as const

const PRICE_ERROR = 'Ingresá un precio mayor o igual a 0.'
const INTEGER_ERROR = 'Ingresá un número entero, 0 o mayor.'

/** true si el texto es un precio válido (parsea con convención es-AR y es >= 0). */
function isValidPrice(raw: string): boolean {
  const n = parseDecimal(raw)
  return n !== null && n >= 0
}

/** true si el texto vacío o es un entero >= 0 (los campos de stock son opcionales). */
function isValidOptionalCount(raw: string): boolean {
  if (raw.trim() === '') return true
  const n = parseInteger(raw)
  return n !== null && n >= 0
}

/**
 * Valida el draft. Devuelve `null` si está OK, o un objeto `FormErrors` con
 * únicamente los campos que fallaron.
 */
export function validateProductForm(draft: ProductFormDraft): FormErrors | null {
  const errors: FormErrors = {}

  if (draft.name.trim() === '') errors.name = 'Ingresá el nombre del producto.'
  if (!isValidPrice(draft.purchasePrice)) errors.purchasePrice = PRICE_ERROR
  if (!isValidPrice(draft.salePrice)) errors.salePrice = PRICE_ERROR
  if (draft.categoryId === 0) errors.categoryId = 'Elegí o creá una categoría.'
  if (draft.supplierId === 0) errors.supplierId = 'Elegí o creá un proveedor.'

  // barcode: opcional; si hay texto, solo dígitos y hasta 20. (La unicidad la valida el backend.)
  const bc = draft.barcode.trim()
  if (bc !== '' && (!/^\d+$/.test(bc) || bc.length > 20)) {
    errors.barcode = 'El código solo puede tener números (hasta 20).'
  }

  if (!isValidOptionalCount(draft.stock)) errors.stock = INTEGER_ERROR
  if (!isValidOptionalCount(draft.minStock)) errors.minStock = INTEGER_ERROR

  return Object.keys(errors).length === 0 ? null : errors
}

/**
 * Convierte el texto de un precio (ya validado) al string numérico con punto que viaja al backend.
 * Ej: "1.650,50" → "1650.5". Lanza si no parsea: solo se llama después de `validateProductForm`.
 */
export function priceToPayload(raw: string): string {
  const n = parseDecimal(raw)
  if (n === null) throw new Error(`Precio inválido: "${raw}"`)
  return String(n)
}

/**
 * Margen de ganancia por unidad. `null` si algún precio no parsea o el costo es <= 0
 * (no se puede calcular un porcentaje sobre cero).
 */
export function marginInfo(purchase: string, sale: string): { pct: number; profit: number } | null {
  const p = parseDecimal(purchase)
  const s = parseDecimal(sale)
  if (p === null || s === null || p <= 0) return null
  return { pct: ((s - p) / p) * 100, profit: s - p }
}
