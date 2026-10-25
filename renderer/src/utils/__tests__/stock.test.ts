import { describe, expect, it } from 'vitest'
import { hasValidSalePrice, stockTone } from '../stock'

describe('stockTone', () => {
  it.each([
    [{ stock: -3, minStock: 5 }, 'negative'],
    [{ stock: 0, minStock: 0 }, 'low'],
    [{ stock: 6, minStock: 8 }, 'low'],
    [{ stock: 8, minStock: 8 }, 'low'],
    [{ stock: 9, minStock: 8 }, null],
  ])('stockTone(%j) → %j', (input, expected) => {
    expect(stockTone(input)).toBe(expected)
  })
})

describe('hasValidSalePrice', () => {
  it.each([
    ['0', false],
    ['', false],
    ['abc', false],
    ['-5', false],
    ['10', true],
    ['0.5', true],
  ])('hasValidSalePrice(%j) → %s', (salePrice, expected) => {
    expect(hasValidSalePrice({ salePrice })).toBe(expected)
  })
})
