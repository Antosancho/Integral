import { Prisma } from "@prisma/client"

function isPrismaDecimal(value: unknown): value is Prisma.Decimal {
  if (!value || typeof value !== "object") return false

  if (value instanceof Prisma.Decimal) return true

  const decimalCtor = Prisma.Decimal as unknown as { isDecimal?: (input: unknown) => boolean }
  return typeof decimalCtor.isDecimal === "function" && decimalCtor.isDecimal(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function serializeIpcValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || value === undefined) return value

  const valueType = typeof value
  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean" ||
    valueType === "bigint"
  ) {
    return value
  }

  if (isPrismaDecimal(value)) {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeIpcValue(item, seen))
  }

  if (value instanceof Date) {
    return value
  }

  if (valueType !== "object") {
    return value
  }

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return value
  }

  if (!isPlainObject(value)) {
    const plainFromObject = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        serializeIpcValue(item, seen)
      ])
    )
    return plainFromObject
  }

  if (seen.has(value)) {
    return seen.get(value)
  }

  const output: Record<string, unknown> = {}
  seen.set(value, output)

  for (const [key, item] of Object.entries(value)) {
    output[key] = serializeIpcValue(item, seen)
  }

  return output
}

export function toIpcSafe<T>(value: T): T {
  if (!value || typeof value !== "object") return value
  return serializeIpcValue(value, new WeakMap()) as T
}
