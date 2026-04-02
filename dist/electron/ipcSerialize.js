"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIpcSafe = toIpcSafe;
const client_1 = require("@prisma/client");
function isPrismaDecimal(value) {
    if (!value || typeof value !== "object")
        return false;
    if (value instanceof client_1.Prisma.Decimal)
        return true;
    const decimalCtor = client_1.Prisma.Decimal;
    return typeof decimalCtor.isDecimal === "function" && decimalCtor.isDecimal(value);
}
function isPlainObject(value) {
    if (!value || typeof value !== "object")
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function serializeIpcValue(value, seen) {
    if (value === null || value === undefined)
        return value;
    const valueType = typeof value;
    if (valueType === "string" ||
        valueType === "number" ||
        valueType === "boolean" ||
        valueType === "bigint") {
        return value;
    }
    if (isPrismaDecimal(value)) {
        return value.toString();
    }
    if (Array.isArray(value)) {
        return value.map((item) => serializeIpcValue(item, seen));
    }
    if (value instanceof Date) {
        return value;
    }
    if (valueType !== "object") {
        return value;
    }
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return value;
    }
    if (!isPlainObject(value)) {
        const plainFromObject = Object.fromEntries(Object.entries(value).map(([key, item]) => [
            key,
            serializeIpcValue(item, seen)
        ]));
        return plainFromObject;
    }
    if (seen.has(value)) {
        return seen.get(value);
    }
    const output = {};
    seen.set(value, output);
    for (const [key, item] of Object.entries(value)) {
        output[key] = serializeIpcValue(item, seen);
    }
    return output;
}
function toIpcSafe(value) {
    if (!value || typeof value !== "object")
        return value;
    return serializeIpcValue(value, new WeakMap());
}
//# sourceMappingURL=ipcSerialize.js.map