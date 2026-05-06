"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productInclude = void 0;
exports.toDecimal = toDecimal;
exports.toBigInt = toBigInt;
exports.normalizeRequiredString = normalizeRequiredString;
exports.normalizeOptionalString = normalizeOptionalString;
exports.ensureInteger = ensureInteger;
exports.ensurePositiveInteger = ensurePositiveInteger;
exports.ensureNonNegativeInteger = ensureNonNegativeInteger;
exports.ensureNonZeroInteger = ensureNonZeroInteger;
exports.normalizeStockMovementType = normalizeStockMovementType;
exports.normalizePagination = normalizePagination;
exports.normalizeSalePaymentMethod = normalizeSalePaymentMethod;
const client_1 = require("@prisma/client");
const stockMovementTypes = new Set(["IN", "SALE", "ADJUSTMENT"]);
const salePaymentMethods = new Set([
    "CASH",
    "TRANSFER",
    "DEBIT",
    "CREDIT",
    "OTHER"
]);
exports.productInclude = {
    category: true,
    supplier: true
};
// Normalizes price-like values so repositories can accept number/string/Decimal.
function toDecimal(value) {
    if (value instanceof client_1.Prisma.Decimal)
        return value;
    return new client_1.Prisma.Decimal(value);
}
// Converts barcode input to bigint to match Prisma BigInt field.
function toBigInt(value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number") {
        if (!Number.isInteger(value)) {
            throw new Error("barcode must be an integer");
        }
        return BigInt(value);
    }
    const normalized = value.trim();
    if (!/^-?\d+$/.test(normalized)) {
        throw new Error("barcode must be a valid integer string");
    }
    return BigInt(normalized);
}
// Trims and validates required text fields.
function normalizeRequiredString(value, fieldName) {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${fieldName} is required`);
    }
    return normalized;
}
// Converts empty strings to null while preserving undefined (no update semantics).
function normalizeOptionalString(value) {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
function ensureInteger(value, fieldName) {
    if (!Number.isInteger(value)) {
        throw new Error(`${fieldName} must be an integer`);
    }
    return value;
}
function ensurePositiveInteger(value, fieldName) {
    ensureInteger(value, fieldName);
    if (value <= 0) {
        throw new Error(`${fieldName} must be greater than 0`);
    }
    return value;
}
function ensureNonNegativeInteger(value, fieldName) {
    ensureInteger(value, fieldName);
    if (value < 0) {
        throw new Error(`${fieldName} must be greater than or equal to 0`);
    }
    return value;
}
/** Acepta cualquier entero distinto de cero (positivo o negativo). Usado para mermas en tipo IN. */
function ensureNonZeroInteger(value, fieldName) {
    ensureInteger(value, fieldName);
    if (value === 0)
        throw new Error(`${fieldName} must not be zero`);
    return value;
}
function normalizeStockMovementType(type) {
    const normalized = type.toUpperCase();
    if (!stockMovementTypes.has(normalized)) {
        throw new Error(`Invalid stock movement type: ${type}`);
    }
    return normalized;
}
// Validates pagination inputs used by list endpoints.
function normalizePagination(input) {
    if (!input)
        return {};
    const output = {};
    if (input.skip !== undefined) {
        output.skip = ensureNonNegativeInteger(input.skip, "skip");
    }
    if (input.take !== undefined) {
        output.take = ensurePositiveInteger(input.take, "take");
    }
    return output;
}
function normalizeSalePaymentMethod(method) {
    const normalized = method.toUpperCase();
    if (!salePaymentMethods.has(normalized)) {
        throw new Error(`Invalid sale payment method: ${method}`);
    }
    return normalized;
}
//# sourceMappingURL=utilities.js.map