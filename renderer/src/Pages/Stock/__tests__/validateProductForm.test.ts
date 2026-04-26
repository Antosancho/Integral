import { describe, it, expect } from 'vitest'
import { validateProductForm, type ProductFormDraft } from '../validateProductForm'

/** Draft completamente válido para usar como base en cada test. */
function validDraft(): ProductFormDraft {
  return {
    name: 'Producto Test',
    purchasePrice: '50',
    salePrice: '100',
    categoryId: 1,
    supplierId: 1,
    barcode: '',
    stock: '0',
    minStock: '0'
  }
}

describe('validateProductForm', () => {
  it('Draft válido mínimo retorna null', () => {
    expect(validateProductForm(validDraft())).toBeNull()
  })

  it('Draft válido con barcode numérico retorna null', () => {
    expect(validateProductForm({ ...validDraft(), barcode: '7790001234567' })).toBeNull()
  })

  it('name vacío retorna error en name', () => {
    const result = validateProductForm({ ...validDraft(), name: '' })
    expect(result).not.toBeNull()
    expect(result?.name).toBeDefined()
  })

  it('name solo espacios retorna error en name', () => {
    const result = validateProductForm({ ...validDraft(), name: '   ' })
    expect(result).not.toBeNull()
    expect(result?.name).toBeDefined()
  })

  it('purchasePrice vacío retorna error en purchasePrice', () => {
    const result = validateProductForm({ ...validDraft(), purchasePrice: '' })
    expect(result).not.toBeNull()
    expect(result?.purchasePrice).toBeDefined()
  })

  it('purchasePrice con texto retorna error en purchasePrice', () => {
    const result = validateProductForm({ ...validDraft(), purchasePrice: 'abc' })
    expect(result).not.toBeNull()
    expect(result?.purchasePrice).toBeDefined()
  })

  it('purchasePrice negativo retorna error en purchasePrice', () => {
    const result = validateProductForm({ ...validDraft(), purchasePrice: '-5' })
    expect(result).not.toBeNull()
    expect(result?.purchasePrice).toBeDefined()
  })

  it('purchasePrice con coma decimal retorna null (normalización es-AR)', () => {
    expect(validateProductForm({ ...validDraft(), purchasePrice: '10,50' })).toBeNull()
  })

  it('purchasePrice = "0" retorna null (cero es válido)', () => {
    expect(validateProductForm({ ...validDraft(), purchasePrice: '0' })).toBeNull()
  })

  it('salePrice vacío retorna error en salePrice', () => {
    const result = validateProductForm({ ...validDraft(), salePrice: '' })
    expect(result).not.toBeNull()
    expect(result?.salePrice).toBeDefined()
  })

  it('categoryId = 0 retorna error en categoryId', () => {
    const result = validateProductForm({ ...validDraft(), categoryId: 0 })
    expect(result).not.toBeNull()
    expect(result?.categoryId).toBeDefined()
  })

  it('supplierId = 0 retorna error en supplierId', () => {
    const result = validateProductForm({ ...validDraft(), supplierId: 0 })
    expect(result).not.toBeNull()
    expect(result?.supplierId).toBeDefined()
  })

  it('barcode con letras retorna error en barcode', () => {
    const result = validateProductForm({ ...validDraft(), barcode: 'abc123' })
    expect(result).not.toBeNull()
    expect(result?.barcode).toBeDefined()
  })

  it('barcode solo dígitos retorna null', () => {
    expect(validateProductForm({ ...validDraft(), barcode: '1234567890' })).toBeNull()
  })

  it('barcode con 21 dígitos retorna error en barcode (demasiado largo)', () => {
    const result = validateProductForm({ ...validDraft(), barcode: '123456789012345678901' })
    expect(result).not.toBeNull()
    expect(result?.barcode).toBeDefined()
  })

  it('stock no entero retorna error en stock', () => {
    const result = validateProductForm({ ...validDraft(), stock: '1.5' })
    expect(result).not.toBeNull()
    expect(result?.stock).toBeDefined()
  })

  it('stock negativo retorna error en stock', () => {
    const result = validateProductForm({ ...validDraft(), stock: '-1' })
    expect(result).not.toBeNull()
    expect(result?.stock).toBeDefined()
  })

  it('stock vacío retorna null (es opcional)', () => {
    expect(validateProductForm({ ...validDraft(), stock: '' })).toBeNull()
  })

  it('stock = "0" retorna null', () => {
    expect(validateProductForm({ ...validDraft(), stock: '0' })).toBeNull()
  })

  it('minStock no entero retorna error en minStock', () => {
    const result = validateProductForm({ ...validDraft(), minStock: '2.7' })
    expect(result).not.toBeNull()
    expect(result?.minStock).toBeDefined()
  })

  it('Múltiples errores simultáneos — name y categoryId reportados', () => {
    const result = validateProductForm({ ...validDraft(), name: '', categoryId: 0 })
    expect(result).not.toBeNull()
    expect(result?.name).toBeDefined()
    expect(result?.categoryId).toBeDefined()
  })

  it('Solo los campos erróneos están en el objeto retornado', () => {
    const result = validateProductForm({ ...validDraft(), salePrice: '' })
    expect(result).not.toBeNull()
    expect(result?.salePrice).toBeDefined()
    // El resto de los campos no debe estar en el objeto
    expect(result?.name).toBeUndefined()
    expect(result?.purchasePrice).toBeUndefined()
    expect(result?.categoryId).toBeUndefined()
    expect(result?.supplierId).toBeUndefined()
    expect(result?.barcode).toBeUndefined()
    expect(result?.stock).toBeUndefined()
    expect(result?.minStock).toBeUndefined()
  })
})
