import { describe, expect, it } from 'vitest'
import { makeProduct } from '../../../test/fixtures'
import { filterProducts, sortProducts } from '../productFilters'

const NONE = { query: '', categoryId: null, onlyLow: false }

const serenisima = makeProduct({ id: 1, name: 'Leche La Serenísima', barcode: 7790080000123n, categoryId: 1, stock: 24, minStock: 10, salePrice: '1450' })
const yerba = makeProduct({ id: 2, name: 'Yerba Playadito', barcode: 7791234500017n, categoryId: 2, stock: 6, minStock: 8, salePrice: '4890' })
const coca = makeProduct({ id: 3, name: 'Coca-Cola 2,25 L', barcode: null, categoryId: 3, stock: -3, minStock: 12, salePrice: '3200' })
const arroz = makeProduct({ id: 4, name: 'Árbol de té', barcode: 7798062540017n, categoryId: 2, stock: 18, minStock: 6, salePrice: '1990' })
const ALL = [serenisima, yerba, coca, arroz]

describe('filterProducts', () => {
  it('sin filtros devuelve todos', () => {
    expect(filterProducts(ALL, NONE)).toHaveLength(4)
  })

  it('la query por nombre ignora tildes y mayúsculas ("serenisima" encuentra "Serenísima")', () => {
    expect(filterProducts(ALL, { ...NONE, query: 'serenisima' }).map((p) => p.id)).toEqual([1])
    expect(filterProducts(ALL, { ...NONE, query: 'ARBOL' }).map((p) => p.id)).toEqual([4])
  })

  it('la query también busca por parte del código de barras', () => {
    expect(filterProducts(ALL, { ...NONE, query: '123450' }).map((p) => p.id)).toEqual([2])
    expect(filterProducts(ALL, { ...NONE, query: '7798062540017' }).map((p) => p.id)).toEqual([4])
  })

  it('un producto sin código no rompe la búsqueda por código', () => {
    expect(filterProducts(ALL, { ...NONE, query: '779' }).map((p) => p.id)).toEqual([1, 2, 4])
  })

  it('filtra por categoría', () => {
    expect(filterProducts(ALL, { ...NONE, categoryId: 2 }).map((p) => p.id)).toEqual([2, 4])
  })

  it('onlyLow incluye bajos y negativos y excluye normales', () => {
    expect(filterProducts(ALL, { ...NONE, onlyLow: true }).map((p) => p.id)).toEqual([2, 3])
  })

  it('combina filtros', () => {
    expect(filterProducts(ALL, { query: 'yerba', categoryId: 2, onlyLow: true }).map((p) => p.id)).toEqual([2])
    expect(filterProducts(ALL, { query: 'yerba', categoryId: 1, onlyLow: false })).toEqual([])
  })

  it('una query de solo espacios no filtra', () => {
    expect(filterProducts(ALL, { ...NONE, query: '   ' })).toHaveLength(4)
  })
})

describe('sortProducts', () => {
  it('ordena por nombre asc/desc considerando tildes ("Árbol" va con la A)', () => {
    expect(sortProducts(ALL, { key: 'name', dir: 'asc' }).map((p) => p.id)).toEqual([4, 3, 1, 2])
    expect(sortProducts(ALL, { key: 'name', dir: 'desc' }).map((p) => p.id)).toEqual([2, 1, 3, 4])
  })

  it('ordena por precio numéricamente (no como texto)', () => {
    expect(sortProducts(ALL, { key: 'salePrice', dir: 'asc' }).map((p) => p.id)).toEqual([1, 4, 3, 2])
  })

  it('ordena por stock', () => {
    expect(sortProducts(ALL, { key: 'stock', dir: 'asc' }).map((p) => p.id)).toEqual([3, 2, 4, 1])
    expect(sortProducts(ALL, { key: 'stock', dir: 'desc' }).map((p) => p.id)).toEqual([1, 4, 2, 3])
  })

  it('no muta el arreglo de entrada', () => {
    const input = [...ALL]
    sortProducts(input, { key: 'stock', dir: 'asc' })
    expect(input.map((p) => p.id)).toEqual([1, 2, 3, 4])
  })
})
