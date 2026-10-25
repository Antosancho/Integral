import {
  filterByTime,
  buildApiFilters,
  getSaleLocalTime,
  defaultFilters,
  hasActiveFilters,
  lastSevenDaysFilters,
  filterSalesClientSide,
  formatMethods,
  type SalesHistoryFilters
} from '../salesHistoryFilters'
import { makeProduct } from '../../../test/fixtures'
import type { SaleFromApi } from '../../../electron-api'

// Helper para crear un SaleFromApi mínimo con una fecha
function makeSale(isoDate: string): any {
  return {
    id: 1,
    date: new Date(isoDate),
    total: '100',
    discountPct: '0',
    items: [],
    payments: []
  }
}

describe('salesHistoryFilters', () => {
  describe('filterByTime', () => {
    it('sin filtros → devuelve todo', () => {
      const sale1 = makeSale('2024-03-15T10:00:00')
      const sale2 = makeSale('2024-03-15T15:00:00')
      const result = filterByTime([sale1, sale2], '', '')
      expect(result).toHaveLength(2)
      expect(result).toContainEqual(sale1)
      expect(result).toContainEqual(sale2)
    })

    it('solo fromTime: excluye ventas anteriores', () => {
      const sale1 = makeSale('2024-03-15T10:00:00')
      const sale2 = makeSale('2024-03-15T15:00:00')
      const result = filterByTime([sale1, sale2], '12:00', '')
      expect(result).toHaveLength(1)
      expect(result).toContainEqual(sale2)
      expect(result).not.toContainEqual(sale1)
    })

    it('solo toTime: excluye ventas posteriores', () => {
      const sale1 = makeSale('2024-03-15T10:00:00')
      const sale2 = makeSale('2024-03-15T15:00:00')
      const result = filterByTime([sale1, sale2], '', '12:00')
      expect(result).toHaveLength(1)
      expect(result).toContainEqual(sale1)
      expect(result).not.toContainEqual(sale2)
    })

    it('rango normal: incluye ventas dentro del rango', () => {
      const sale1 = makeSale('2024-03-15T09:00:00')
      const sale2 = makeSale('2024-03-15T14:00:00')
      const sale3 = makeSale('2024-03-15T20:00:00')
      const result = filterByTime([sale1, sale2, sale3], '12:00', '16:00')
      expect(result).toHaveLength(1)
      expect(result).toContainEqual(sale2)
      expect(result).not.toContainEqual(sale1)
      expect(result).not.toContainEqual(sale3)
    })

    it('fromTime == toTime: solo venta exacta', () => {
      const sale1 = makeSale('2024-03-15T14:00:00')
      const sale2 = makeSale('2024-03-15T15:00:00')
      const result = filterByTime([sale1, sale2], '14:00', '14:00')
      expect(result).toHaveLength(1)
      expect(result).toContainEqual(sale1)
      expect(result).not.toContainEqual(sale2)
    })

    it('fromTime > toTime (cruce de medianoche): sin filtro', () => {
      const sale1 = makeSale('2024-03-15T10:00:00')
      const sale2 = makeSale('2024-03-15T15:00:00')
      const result = filterByTime([sale1, sale2], '22:00', '02:00')
      expect(result).toHaveLength(2)
      expect(result).toContainEqual(sale1)
      expect(result).toContainEqual(sale2)
    })

    it('lista vacía → devuelve lista vacía', () => {
      const result = filterByTime([], '10:00', '20:00')
      expect(result).toHaveLength(0)
    })
  })

  describe('buildApiFilters', () => {
    const empty: SalesHistoryFilters = { ...defaultFilters(new Date(2026, 9, 24)), fromDate: '', toDate: '' }

    it('filtros vacíos → objeto vacío (sin campos undefined)', () => {
      expect(buildApiFilters(empty)).toEqual({})
    })

    it('fromDate y toDate → inicio del día y fin del día (DD/MM/AAAA)', () => {
      const result = buildApiFilters({ ...empty, fromDate: '01/03/2024', toDate: '31/03/2024' })
      expect(result.fromDate).toEqual(new Date(2024, 2, 1, 0, 0, 0, 0))
      expect(result.toDate).toEqual(new Date(2024, 2, 31, 23, 59, 59, 999))
    })

    it('una fecha inválida o incompleta no se envía', () => {
      expect(buildApiFilters({ ...empty, fromDate: '31/02/2026', toDate: '24/10' })).toEqual({})
    })

    it('method simple → se envía', () => {
      expect(buildApiFilters({ ...empty, method: 'CASH' }).method).toBe('CASH')
    })

    it('method MIXED (Combinado) → NO se envía a la API', () => {
      expect(buildApiFilters({ ...empty, method: 'MIXED' })).not.toHaveProperty('method')
    })

    it('minTotal y maxTotal se parsean es-AR a número', () => {
      const result = buildApiFilters({ ...empty, minTotal: '1.000,50', maxTotal: '2000' })
      expect(result.minTotal).toBe(1000.5)
      expect(result.maxTotal).toBe(2000)
    })

    it('fromTime, toTime y product → NO aparecen en el resultado', () => {
      const result = buildApiFilters({ ...empty, fromTime: '10:00', toTime: '18:00', product: 'yerba' })
      expect(result).not.toHaveProperty('fromTime')
      expect(result).not.toHaveProperty('toTime')
      expect(result).not.toHaveProperty('product')
    })
  })

  describe('defaultFilters / lastSevenDaysFilters / hasActiveFilters', () => {
    const now = new Date(2026, 9, 24, 15)

    it('el default es hoy-hoy con el resto vacío', () => {
      expect(defaultFilters(now)).toEqual({
        fromDate: '24/10/2026',
        toDate: '24/10/2026',
        product: '',
        method: '',
        fromTime: '',
        toTime: '',
        minTotal: '',
        maxTotal: ''
      })
    })

    it('últimos 7 días: desde hoy-6 hasta hoy', () => {
      const f = lastSevenDaysFilters(now)
      expect(f.fromDate).toBe('18/10/2026')
      expect(f.toDate).toBe('24/10/2026')
    })

    it('los filtros por defecto no cuentan como activos', () => {
      expect(hasActiveFilters(defaultFilters(now), now)).toBe(false)
    })

    it.each([
      ['fromDate', '01/10/2026'],
      ['toDate', '25/10/2026'],
      ['product', 'yerba'],
      ['method', 'CASH'],
      ['fromTime', '10:00'],
      ['minTotal', '100']
    ] as const)('cambiar %s lo vuelve activo', (key, value) => {
      expect(hasActiveFilters({ ...defaultFilters(now), [key]: value }, now)).toBe(true)
    })
  })

  describe('filterSalesClientSide', () => {
    const yerba = makeProduct({ id: 1, name: 'Yerba Playadito', barcode: 7791234500017n })
    const leche = makeProduct({ id: 2, name: 'Leche Serenísima', barcode: 7790080000123n })

    const sale = (id: number, productos: ReturnType<typeof makeProduct>[], methods: string[]): SaleFromApi => ({
      id,
      date: new Date('2024-03-15T14:00:00'),
      total: '100',
      discountPct: '0',
      items: productos.map((p, i) => ({ id: i, saleId: id, productId: p.id, quantity: 1, unitPrice: '100', product: p })),
      payments: methods.map((m, i) => ({ id: i, saleId: id, method: m, amount: '50' }))
    })
    const generalSale: SaleFromApi = { ...sale(9, [], ['CASH']), items: [{ id: 1, saleId: 9, productId: null, quantity: 1, unitPrice: '10', product: null }] }
    const all = [sale(1, [yerba], ['CASH']), sale(2, [leche], ['CASH', 'TRANSFER']), generalSale]
    const base = defaultFilters()

    it('sin filtros del cliente devuelve todas', () => {
      expect(filterSalesClientSide(all, base)).toHaveLength(3)
    })

    it('producto por nombre, ignorando tildes y mayúsculas', () => {
      expect(filterSalesClientSide(all, { ...base, product: 'SERENISIMA' }).map((s) => s.id)).toEqual([2])
      expect(filterSalesClientSide(all, { ...base, product: 'yerba' }).map((s) => s.id)).toEqual([1])
    })

    it('producto por parte del código de barras', () => {
      expect(filterSalesClientSide(all, { ...base, product: '7790080' }).map((s) => s.id)).toEqual([2])
    })

    it('una búsqueda por producto excluye las ventas de solo líneas General', () => {
      expect(filterSalesClientSide(all, { ...base, product: 'a' }).map((s) => s.id)).not.toContain(9)
    })

    it('Combinado deja solo las ventas con más de un pago', () => {
      expect(filterSalesClientSide(all, { ...base, method: 'MIXED' }).map((s) => s.id)).toEqual([2])
    })

    it('aplica el filtro de hora', () => {
      expect(filterSalesClientSide(all, { ...base, fromTime: '23:00' })).toHaveLength(0)
    })
  })

  describe('formatMethods', () => {
    const pay = (...methods: string[]): SaleFromApi['payments'] => methods.map((m, i) => ({ id: i, saleId: 1, method: m, amount: '1' }))

    it('un medio → su nombre', () => {
      expect(formatMethods(pay('CASH'))).toBe('Efectivo')
    })

    it('varios medios se unen con " + "', () => {
      expect(formatMethods(pay('CASH', 'TRANSFER'))).toBe('Efectivo + Transferencia')
    })

    it('un medio repetido aparece una sola vez', () => {
      expect(formatMethods(pay('CASH', 'CASH'))).toBe('Efectivo')
    })

    it('sin pagos → "—"', () => {
      expect(formatMethods([])).toBe('—')
    })

    it('un medio desconocido se muestra tal cual', () => {
      expect(formatMethods(pay('CRIPTO'))).toBe('CRIPTO')
    })
  })

  describe('getSaleLocalTime', () => {
    it('devuelve hora en formato HH:MM en zona horaria de Argentina', () => {
      // Argentina está en UTC-3 (sin considerar horario de verano)
      const date = new Date('2024-03-15T20:00:00Z') // 20:00 UTC
      const result = getSaleLocalTime(date)
      // En Argentina sería 17:00 (20:00 - 3h)
      expect(result).toBe('17:00')
    })
  })
})