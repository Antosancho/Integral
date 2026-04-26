// ---------------------------------------------------------------------------
// Utility functions for computing cash register summary from sales data
// ---------------------------------------------------------------------------

import type { SaleFromApi } from '../../electron-api'
import { PAYMENT_LABELS } from '../Sells/payments'
import type { PaymentMethod } from '../Sells/payments'

/**
 * Result of computing the cash register summary
 */
export interface CajaResult {
  total: number
  byMethod: { method: string; label: string; amount: number }[]
}

/**
 * Computes the cash register summary for a list of sales
 * @param sales Array of sales from the API
 * @returns Object containing total sold and breakdown by payment method
 */
export function computeCaja(sales: SaleFromApi[]): CajaResult {
  // Handle empty sales array
  if (sales.length === 0) {
    return { total: 0, byMethod: [] }
  }

  // Calculate total: sum of sale.total for all sales
  const total = sales.reduce((sum, sale) => sum + Number(sale.total), 0)

  // Accumulate amounts by payment method
  const methodTotals = new Map<string, number>()
   
  // Iterate through all payments in all sales
  for (const sale of sales) {
    for (const payment of sale.payments) {
      const amount = Number(payment.amount)
      const current = methodTotals.get(payment.method) ?? 0
      methodTotals.set(payment.method, current + amount)
    }
  }

  // Build result array following the order of PAYMENT_LABELS
  const byMethod: { method: string; label: string; amount: number }[] = []
   
  // First, process known payment methods in the fixed order (excluding OTHER which uses fallback)
  for (const method of Object.keys(PAYMENT_LABELS) as PaymentMethod[]) {
    // Skip OTHER as it should use fallback label
    if (method === 'OTHER') {
      continue
    }
    
    const amount = methodTotals.get(method) ?? 0
    if (amount > 0) {
      byMethod.push({
        method,
        label: PAYMENT_LABELS[method],
        amount
      })
    }
  }
   
  // Then, handle any unexpected payment methods (including OTHER as fallback)
  for (const [method, amount] of methodTotals.entries()) {
    if (amount > 0 && !PAYMENT_LABELS.hasOwnProperty(method as PaymentMethod)) {
      byMethod.push({
        method,
        label: method, // fallback to method name as label
        amount
      })
    }
    // Special case: OTHER always uses fallback label
    else if (method === 'OTHER' && amount > 0) {
      byMethod.push({
        method,
        label: method, // fallback to method name as label
        amount
      })
    }
  }

  return { total, byMethod }
}