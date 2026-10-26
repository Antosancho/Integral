/**
 * Precio de venta calculado con margen y redondeo, y las preferencias de ese cálculo.
 *
 * - `computeSalePrice`: venta = redondear(costo × (1 + margen / 100), paso), en centavos enteros.
 * - Las preferencias (activado, margen, redondeo) se recuerdan en localStorage (`integral.pricing`).
 *   Leer o guardar nunca lanza: sin storage o con datos corruptos se usan los valores por defecto.
 */
import { formatAmountInput, formatInt } from './format'
import { parseDecimal } from './parse'

/** Paso de redondeo en pesos. 0 = sin redondeo (precio al centavo). */
export type RoundingStep = 0 | 10 | 50 | 100 | 500 | 1000

/** Pasos ofrecidos, en el orden del selector "Redondeo". */
export const ROUNDING_STEPS: readonly RoundingStep[] = [0, 10, 50, 100, 500, 1000]

/** Rango válido del margen (%), extremos incluidos. */
export const MARGIN_MIN = 0
export const MARGIN_MAX = 1000

export type PricingPrefs = {
  /** "Calcular con margen" tildado al abrir el alta de producto. */
  enabled: boolean
  /** Recargo sobre el costo, en % (0–1000, hasta 2 decimales). */
  marginPct: number
  roundingStep: RoundingStep
}

export const DEFAULT_PRICING_PREFS: PricingPrefs = { enabled: true, marginPct: 30, roundingStep: 100 }

/** Clave de localStorage (mismo prefijo que `integral.theme`). */
export const PRICING_STORAGE_KEY = 'integral.pricing'

/**
 * x × 100 como entero, sin el ruido binario de los decimales (la mitad exacta sube):
 * 1.005 → 101 (no 100), 0.1 + 0.2 → 30, 12.345 → 1235.
 */
function toHundredths(x: number): number {
  return Math.round(Number((x * 100).toPrecision(15)))
}

/** Margen redondeado a 2 decimales (el `Math.abs` convierte un -0 en 0). */
function roundMargin(n: number): number {
  return Math.abs(toHundredths(n)) / 100
}

/** true si `n` es un margen aceptado: número finito entre 0 y 1000 (inclusive). */
export function isValidMarginPct(n: number): boolean {
  return Number.isFinite(n) && n >= MARGIN_MIN && n <= MARGIN_MAX
}

/** Devuelve el valor como `RoundingStep` si es uno de los pasos ofrecidos; si no, null. */
export function toRoundingStep(value: unknown): RoundingStep | null {
  return typeof value === 'number' && (ROUNDING_STEPS as readonly number[]).includes(value) ? (value as RoundingStep) : null
}

/**
 * Precio de venta = redondear(costo × (1 + margen / 100), paso).
 *
 * - Trabaja en centavos enteros: no hay errores de punto flotante.
 * - Redondea al múltiplo de `step` MÁS CERCANO; la mitad exacta sube (paso 100: 1550 → 1600).
 * - `step` 0 = sin redondeo: el resultado queda al centavo (2 decimales, la mitad sube).
 * - Si el costo (en centavos) es > 0 y el redondeo daría $ 0, devuelve un paso: nunca un precio 0
 *   para algo que tiene costo.
 * - null si el costo no es un número finito ≥ 0, si el margen está fuera de [0, 1000] o si el paso
 *   no es uno de `ROUNDING_STEPS`.
 */
export function computeSalePrice(cost: number, marginPct: number, step: RoundingStep): number | null {
  if (!Number.isFinite(cost) || cost < 0) return null
  if (!isValidMarginPct(marginPct)) return null
  if (toRoundingStep(step) === null) return null
  const costCents = Math.abs(toHundredths(cost)) // Math.abs: -0 → 0
  const marginBasisPoints = toHundredths(marginPct) // 30 % → 3000
  const rawCents = Math.round((costCents * (10000 + marginBasisPoints)) / 10000)
  if (step === 0) return rawCents / 100
  const stepCents = step * 100
  let roundedCents = Math.round(rawCents / stepCents) * stepCents
  if (roundedCents === 0 && rawCents > 0) roundedCents = stepCents // nunca $ 0 para algo que cuesta (P5)
  return roundedCents / 100
}

/** Texto tipeado en "Margen" → número (2 decimales); null si está vacío, es inválido o está fuera de 0–1000. Acepta "%", coma o punto. */
export function parseMarginInput(text: string): number | null {
  const n = parseDecimal(text.replace(/%/g, ''))
  if (n === null || !isValidMarginPct(n)) return null
  return roundMargin(n)
}

/** Margen → texto del input, sin separador de miles: 30 → "30", 32.5 → "32,5", 12.345 → "12,35". */
export function formatMarginInput(n: number): string {
  return String(roundMargin(n)).replace('.', ',')
}

/** Texto de cada opción del selector "Redondeo": 0 → "Sin redondeo", 1000 → "$ 1.000". */
export function roundingStepLabel(step: RoundingStep): string {
  return step === 0 ? 'Sin redondeo' : `$ ${formatInt(step)}`
}

/** Precio de venta calculado como texto de input ("1.600,00"); '' si el costo no es un número ≥ 0. */
export function autoSalePriceText(purchaseText: string, marginPct: number, step: RoundingStep): string {
  const cost = parseDecimal(purchaseText)
  if (cost === null) return ''
  const sale = computeSalePrice(cost, marginPct, step)
  return sale === null ? '' : formatAmountInput(sale)
}

/** Lee las preferencias. Un campo ausente o inválido, JSON corrupto o un storage que lanza → valor por defecto. */
export function loadPricingPrefs(): PricingPrefs {
  const defaults: PricingPrefs = { ...DEFAULT_PRICING_PREFS }
  let raw: string | null
  try {
    raw = localStorage.getItem(PRICING_STORAGE_KEY)
  } catch {
    return defaults
  }
  if (raw === null) return defaults
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return defaults
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return defaults
  const o = data as Record<string, unknown>
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : defaults.enabled,
    marginPct: typeof o.marginPct === 'number' && isValidMarginPct(o.marginPct) ? roundMargin(o.marginPct) : defaults.marginPct,
    roundingStep: toRoundingStep(o.roundingStep) ?? defaults.roundingStep,
  }
}

/**
 * Guarda solo los campos válidos de `partial`, combinados con lo que ya estaba guardado.
 * Nunca lanza: sin storage, el cambio vale solo mientras el modal siga abierto.
 */
export function savePricingPrefs(partial: Partial<PricingPrefs>): void {
  const next = loadPricingPrefs()
  if (typeof partial.enabled === 'boolean') next.enabled = partial.enabled
  if (typeof partial.marginPct === 'number' && isValidMarginPct(partial.marginPct)) next.marginPct = roundMargin(partial.marginPct)
  const step = toRoundingStep(partial.roundingStep)
  if (step !== null) next.roundingStep = step
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Sin storage: solo esta sesión del modal.
  }
}
