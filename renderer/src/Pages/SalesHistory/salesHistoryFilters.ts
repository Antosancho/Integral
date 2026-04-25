export interface SalesHistoryFilters {
  fromDate: string      // "YYYY-MM-DD" o vacío
  toDate: string        // "YYYY-MM-DD" o vacío
  fromTime: string      // "HH:MM" o vacío
  toTime: string        // "HH:MM" o vacío
  minTotal: string      // número como string o vacío
  maxTotal: string      // número como string o vacío
  method: string        // PaymentMethod o '' para "todas"
}

export const initialFilters: SalesHistoryFilters = {
  fromDate: '',
  toDate: '',
  fromTime: '',
  toTime: '',
  minTotal: '',
  maxTotal: '',
  method: ''
}

/**
 * Devuelve la hora local en formato "HH:MM" usando la zona horaria de Argentina.
 */
export function getSaleLocalTime(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

/**
 * Filtra ventas por rango de hora (formato "HH:MM").
 * Si ambos parámetros están vacíos, devuelve todas las ventas.
 * Si solo fromTime está definido, incluye ventas con hora >= fromTime.
 * Si solo toTime está definido, incluye ventas con hora <= toTime.
 * Si ambos están definidos, incluye ventas con hora entre fromTime y toTime (inclusive).
 * Si fromTime > toTime (caso de cruce de medianoche), devuelve todas las ventas sin filtrar.
 */
export function filterByTime(sales: any[], fromTime: string, toTime: string): any[] {
  if (!fromTime && !toTime) {
    return sales
  }

  if (fromTime && toTime && fromTime > toTime) {
    return sales
  }

  return sales.filter(sale => {
    const saleTime = getSaleLocalTime(new Date(sale.date))
    
    if (fromTime && toTime) {
      return saleTime >= fromTime && saleTime <= toTime
    }
    
    if (fromTime) {
      return saleTime >= fromTime
    }
    
    if (toTime) {
      return saleTime <= toTime
    }
    
    return true
  })
}

/**
 * Convierte los filtros de la UI al formato esperado por el backend.
 * Los filtros de hora (fromTime, toTime) se aplican en el cliente y no se envían al backend.
 */
export function buildApiFilters(filters: SalesHistoryFilters) {
  const apiFilters: any = {}
  
  if (filters.fromDate) {
    apiFilters.fromDate = new Date(filters.fromDate + 'T00:00:00')
  }
  
  if (filters.toDate) {
    apiFilters.toDate = new Date(filters.toDate + 'T23:59:59')
  }
  
  if (filters.method) {
    apiFilters.method = filters.method
  }
  
  if (filters.minTotal) {
    apiFilters.minTotal = filters.minTotal
  }
  
  if (filters.maxTotal) {
    apiFilters.maxTotal = filters.maxTotal
  }
  
  return apiFilters
}