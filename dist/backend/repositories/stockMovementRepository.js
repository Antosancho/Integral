"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStockMovement = createStockMovement;
exports.listStockMovements = listStockMovements;
exports.getStockMovementById = getStockMovementById;
exports.deleteStockMovement = deleteStockMovement;
const client_1 = __importDefault(require("../db/client"));
const utilities_1 = require("./utilities");
// Converts movement semantics into stock delta.
function resolveStockDelta(type, quantity) {
    switch (type) {
        case "IN":
            return quantity;
        case "SALE":
            return -quantity;
        case "ADJUSTMENT":
            return quantity;
        default:
            return quantity;
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
    const quantity = type === "ADJUSTMENT"
        ? (0, utilities_1.ensureInteger)(data.quantity, "quantity")
        : (0, utilities_1.ensurePositiveInteger)(data.quantity, "quantity");
    return client_1.default.$transaction(async (tx) => {
        if (applyToStock) {
            const product = await tx.product.findUnique({ where: { id: data.productId } });
            if (!product) {
                throw new Error(`Product ${data.productId} not found`);
            }
            const delta = resolveStockDelta(type, quantity);
            const nextStock = product.stock + delta;
            if (nextStock < 0) {
                throw new Error("Stock cannot be negative");
            }
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
                ...(data.date ? { date: data.date } : {})
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
// Reads one stock movement by id.
async function getStockMovementById(id) {
    return client_1.default.stockMovement.findUnique({
        where: { id },
        include: {
            product: true
        }
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
            const inverseDelta = -resolveStockDelta(movementType, movement.quantity);
            const product = await tx.product.findUnique({
                where: { id: movement.productId }
            });
            if (!product) {
                throw new Error(`Product ${movement.productId} not found`);
            }
            const nextStock = product.stock + inverseDelta;
            if (nextStock < 0) {
                throw new Error("Stock cannot be negative after reverting movement");
            }
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