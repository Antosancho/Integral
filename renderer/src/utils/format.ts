export function formatMoney(value: string | number): string {
  const asNumber = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(asNumber)) return String(value)

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(asNumber)
}
