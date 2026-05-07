import { filterByTime, buildApiFilters, getSaleLocalTime } from '../salesHistoryFilters'

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
    it('filtros vacíos → objeto vacío (sin campos undefined)', () => {
      const result = buildApiFilters({
        fromDate: '',
        toDate: '',
        fromTime: '',
        toTime: '',
        minTotal: '',
        maxTotal: '',
        method: ''
      })
      expect(result).toEqual({})
    })

    it('fromDate y toDate → incluye fromDate como inicio del día y toDate como fin del día', () => {
      const result = buildApiFilters({
        fromDate: '2024-03-01',
        toDate: '2024-03-31',
        fromTime: '',
        toTime: '',
        minTotal: '',
        maxTotal: '',
        method: ''
      })
      expect(result.fromDate).toEqual(new Date('2024-03-01T00:00:00'))
      expect(result.toDate).toEqual(new Date('2024-03-31T23:59:59'))
    })

    it('method → incluye method', () => {
      const result = buildApiFilters({
        fromDate: '',
        toDate: '',
        fromTime: '',
        toTime: '',
        minTotal: '',
        maxTotal: '',
        method: 'CASH'
      })
      expect(result.method).toBe('CASH')
    })

    it('minTotal y maxTotal → incluye como string', () => {
      const result = buildApiFilters({
        fromDate: '',
        toDate: '',
        fromTime: '',
        toTime: '',
        minTotal: '500',
        maxTotal: '2000',
        method: ''
      })
      expect(result.minTotal).toBe('500')
      expect(result.maxTotal).toBe('2000')
    })

    it('fromTime y toTime → NO aparecen en el resultado', () => {
      const result = buildApiFilters({
        fromDate: '',
        toDate: '',
        fromTime: '10:00',
        toTime: '18:00',
        minTotal: '',
        maxTotal: '',
        method: ''
      })
      expect(result).not.toHaveProperty('fromTime')
      expect(result).not.toHaveProperty('toTime')
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