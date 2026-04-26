// validateProductForm.ts
// Funciones y tipos para validar el formulario de creación de productos.
// El archivo contiene validación pura (sin dependencias de UI) y está
// pensado para ser probado con unit tests.

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

// Normaliza un decimal en formato local: trim + reemplaza coma por punto.
export function normalizeDecimal(raw: string): string {
  return raw.trim().replace(/,/g, '.')
}

// Valida el draft y retorna null si está OK, o un objeto FormErrors con
// únicamente los campos que fallaron.
export function validateProductForm(draft: ProductFormDraft): FormErrors | null {
  const errors: FormErrors = {}

  // name
  if (draft.name.trim() === '') {
    errors.name = 'El nombre es obligatorio'
  }

  // purchasePrice
  const npRaw = normalizeDecimal(draft.purchasePrice)
  if (npRaw === '') {
    errors.purchasePrice = 'El precio de compra es obligatorio'
  } else {
    const n = Number(npRaw)
    if (!Number.isFinite(n) || n < 0) {
      errors.purchasePrice = 'Ingresá un precio válido (>= 0)'
    }
  }

  // salePrice
  const nsRaw = normalizeDecimal(draft.salePrice)
  if (nsRaw === '') {
    errors.salePrice = 'El precio de venta es obligatorio'
  } else {
    const n = Number(nsRaw)
    if (!Number.isFinite(n) || n < 0) {
      errors.salePrice = 'Ingresá un precio válido (>= 0)'
    }
  }

  // categoryId
  if (draft.categoryId === 0) {
    errors.categoryId = 'Seleccioná una categoría'
  }

  // supplierId
  if (draft.supplierId === 0) {
    errors.supplierId = 'Seleccioná un proveedor'
  }

  // barcode: opcional, si no vacío validamos solo dígitos y longitud
  const bc = draft.barcode.trim()
  if (bc !== '') {
    if (!/^\d+$/.test(bc)) {
      errors.barcode = 'El código de barras solo puede contener dígitos'
    } else if (bc.length > 20) {
      errors.barcode = 'Código de barras demasiado largo'
    }
  }

  // stock: opcional, si no vacío debe ser entero >= 0
  const st = draft.stock.trim()
  if (st !== '') {
    const n = Number(st)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      errors.stock = 'El stock debe ser un entero >= 0'
    }
  }

  // minStock: mismas reglas que stock
  const ms = draft.minStock.trim()
  if (ms !== '') {
    const n = Number(ms)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      errors.minStock = 'El stock mínimo debe ser un entero >= 0'
    }
  }

  return Object.keys(errors).length === 0 ? null : errors
}
