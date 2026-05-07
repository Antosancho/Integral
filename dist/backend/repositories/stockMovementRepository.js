"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStockMovement = createStockMovement;
exports.listStockMovements = listStockMovements;
exports.listLotsByProductIds = listLotsByProductIds;
exports.getStockMovementById = getStockMovementById;
exports.listExpiringStockMovements = listExpiringStockMovements;
exports.dismissStockMovementExpiry = dismissStockMovementExpiry;
exports.deleteStockMovement = deleteStockMovement;
const client_1 = __importDefault(require("../db/client"));
const utilities_1 = require("./utilities");
// Converts movement semantics into stock delta.
function resolveStockDelta(type, quantity, currentStock) {
    switch (type) {
        case "IN":
            return quantity;
        case "SALE":
            return -quantity;
        case "ADJUSTMENT":
            return quantity - currentStock;
        default:
            throw new Error(`Unknown stock movement type: ${type}`);
    }
}
// Builds movement filters for reporting/history endpoints.
function buildStockMovementWhere(filters) {
    if (!filters)
        return {};
    return {
        ...(filters.productId !== undefined ? { productId: filters.productId } : {}),
        ...(filters.type !== undefined
            ? { type: (0, utilities_1.normalizeStockMovementType)(filters.type) }
            : {}),
        ...((filters.fromDate || filters.toDate)
            ? {
                date: {
                    ...(filters.fromDate ? { gte: filters.fromDate } : {}),
                    ...(filters.toDate ? { lte: filters.toDate } : {})
                }
            }
            : {})
    };
}
// Creates a stock movement and optionally updates product stock in the same transaction.
async function createStockMovement(data) {
    const type = (0, utilities_1.normalizeStockMovementType)(data.type);
    const applyToStock = data.applyToStock ?? true;
    // IN acepta negativos (merma/baja); SALE solo positivos; ADJUSTMENT cualquier entero
    const quantity = type === "ADJUSTMENT"
        ? (0, utilities_1.ensureInteger)(data.quantity, "quantity")
        : type === "IN"
            ? (0, utilities_1.ensureNonZeroInteger)(data.quantity, "quantity")
            : (0, utilities_1.ensurePositiveInteger)(data.quantity, "quantity");
    return client_1.default.$transaction(async (tx) => {
        let appliedDelta;
        if (applyToStock) {
            const product = await tx.product.findUnique({ where: { id: data.productId } });
            if (!product) {
                throw new Error(`Product ${data.productId} not found`);
            }
            const delta = resolveStockDelta(type, quantity, product.stock);
            appliedDelta = delta;
            const nextStock = product.stock + delta;
            await tx.product.update({
                where: { id: data.productId },
                data: { stock: nextStock }
            });
        }
        return tx.stockMovement.create({
            data: {
                productId: data.productId,
                type,
                quantity,
                notes: (0, utilities_1.normalizeOptionalString)(data.notes),
                ...(data.date ? { date: data.date } : {}),
                ...(appliedDelta !== undefined ? { appliedDelta } : {}),
                // expiryDismissedAt siempre null al crear; solo se setea con dismissStockMovementExpiry
                ...(data.expiryDate !== undefined ? { expiryDate: data.expiryDate } : {})
            },
            include: {
                product: true
            }
        });
    });
}
// Lists movement history with optional date/type/product filters.
async function listStockMovements(filters) {
    const pagination = (0, utilities_1.normalizePagination)(filters);
    return client_1.default.stockMovement.findMany({
        where: buildStockMovementWhere(filters),
        orderBy: { date: "desc" },
        include: {
            product: true
        },
        ...pagination
    });
}
/**
 * Lista los lotes vivos para un conjunto de productos en una sola consulta.
 * Solo incluye entradas de stock positivas, no descartadas por vencimiento.
 */
async function listLotsByProductIds(productIds) {
    if (productIds.length === 0)
        return [];
    return client_1.default.stockMovement.findMany({
        where: {
            productId: { in: productIds },
            type: "IN",
            expiryDismissedAt: null,
            quantity: { gt: 0 }
        },
        orderBy: { expiryDate: "asc" },
        include: {
            product: true
        }
    });
}
// Reads one stock movement by id.
async function getStockMovementById(id) {
    return client_1.default.stockMovement.findUnique({
        where: { id },
        include: {
            product: true
        }
    });
}
/**
 * Lista los lotes con vencimiento pendiente de descarte:
 * expiryDate <= fin de hoy (hora local) y expiryDismissedAt IS NULL.
 * La clasificación "vencido" vs "vence hoy" se hace en el renderer
 * para mantener el repo simple y evitar duplicar lógica de zona horaria.
 */
async function listExpiringStockMovements() {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return client_1.default.stockMovement.findMany({
        where: {
            type: "IN",
            expiryDate: { not: null, lte: endOfToday },
            expiryDismissedAt: null
        },
        orderBy: { expiryDate: "asc" },
        include: { product: true }
    });
}
/**
 * Marca un lote como descartado de forma permanente (no reaparecerá al recargar la app).
 * No modifica el stock; solo setea expiryDismissedAt con timestamp actual.
 */
async function dismissStockMovementExpiry(id) {
    return client_1.default.stockMovement.update({
        where: { id },
        data: { expiryDismissedAt: new Date() },
        include: { product: true }
    });
}
// Deletes a movement and can optionally revert its stock impact.
async function deleteStockMovement(id, revertStock = false) {
    return client_1.default.$transaction(async (tx) => {
        const movement = await tx.stockMovement.findUnique({
            where: { id }
        });
        if (!movement) {
            throw new Error(`Stock movement ${id} not found`);
        }
        if (revertStock) {
            const movementType = (0, utilities_1.normalizeStockMovementType)(movement.type);
            const product = await tx.product.findUnique({
                where: { id: movement.productId }
            });
            if (!product) {
                throw new Error(`Product ${movement.productId} not found`);
            }
            let inverseDelta;
            if (movementType === "ADJUSTMENT") {
                if (movement.appliedDelta === null) {
                    throw new Error("Cannot revert this ADJUSTMENT: missing appliedDelta (record created before bug fix)");
                }
                inverseDelta = -movement.appliedDelta;
            }
            else {
                inverseDelta = -resolveStockDelta(movementType, movement.quantity, product.stock);
            }
            const nextStock = product.stock + inverseDelta;
            await tx.product.update({
                where: { id: movement.productId },
                data: { stock: nextStock }
            });
        }
        return tx.stockMovement.delete({
            where: { id }
        });
    });
}
//# sourceMappingURL=stockMovementRepository.js.map