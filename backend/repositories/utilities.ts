import { Prisma } from "@prisma/client"

export type DecimalInput = Prisma.Decimal | number | string
export type BarcodeInput = bigint | number | string
export type StockMovementType = "IN" | "SALE" | "ADJUSTMENT"
export type OptionalString = string | null | undefined

const stockMovementTypes = new Set<StockMovementType>(["IN", "SALE", "ADJUSTMENT"])

export const productInclude = {
  category: true,
  supplier: true
} as const

// Normalizes price-like values so repositories can accept number/string/Decimal.
export function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value
  return new Prisma.Decimal(value)
}

// Converts barcode input to bigint to match Prisma BigInt field.
export function toBigInt(value: BarcodeInput): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("barcode must be an integer")
    }
    return BigInt(value)
  }

  const normalized = value.trim()
  if (!/^-?\d+$/.test(normalized)) {
    throw new Error("barcode must be a valid integer string")
  }
  return BigInt(normalized)
}

// Trims and validates required text fields.
export function normalizeRequiredString(value: string, fieldName: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${fieldName} is required`)
  }
  return normalized
}

// Converts empty strings to null while preserving undefined (no update semantics).
export function normalizeOptionalString(value: OptionalString): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function ensureInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`)
  }
  return value
}

export function ensurePositiveInteger(value: number, fieldName: string): number {
  ensureInteger(value, fieldName)
  if (value <= 0) {
    throw new Error(`${fieldName} must be greater than 0`)
  }
  return value
}

export function ensureNonNegativeInteger(value: number, fieldName: string): number {
  ensureInteger(value, fieldName)
  if (value < 0) {
    throw new Error(`${fieldName} must be greater than or equal to 0`)
  }
  return value
}

export function normalizeStockMovementType(type: string): StockMovementType {
  const normalized = type.toUpperCase() as StockMovementType
  if (!stockMovementTypes.has(normalized)) {
    throw new Error(`Invalid stock movement type: ${type}`)
  }
  return normalized
}

export interface PaginationInput {
  skip?: number
  take?: number
}

// Validates pagination inputs used by list endpoints.
export function normalizePagination(input?: PaginationInput): PaginationInput {
  if (!input) return {}

  const output: PaginationInput = {}

  if (input.skip !== undefined) {
    output.skip = ensureNonNegativeInteger(input.skip, "skip")
  }

  if (input.take !== undefined) {
    output.take = ensurePositiveInteger(input.take, "take")
  }

  return output
}
