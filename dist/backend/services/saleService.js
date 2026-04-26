"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSale = createSale;
exports.listSales = listSales;
exports.getSaleById = getSaleById;
const client_1 = require("@prisma/client");
const client_2 = __importDefault(require("../db/client"));
const utilities_1 = require("../repositories/utilities");
const saleInclude = {
    items: { include: { product: true } },
    payments: true
};
// Tolerance for monetary equality checks (1 centavo ARS).
// Absorbs FP noise from clients sending `number` without masking real errors,
// which in ARS are always >= 0.01 pesos.
const MONEY_EPSILON = new client_1.Prisma.Decimal("0.01");
function buildSaleWhere(filters) {
    if (!filters)
        return {};
    return {
        ...((filters.fromDate || filters.toDate)
            ? {
                date: {
                    ...(filters.fromDate ? { gte: filters.fromDate } : {}),
                    ...(filters.toDate ? { lte: filters.toDate } : {})
                }
            }
            : {}),
        ...(filters.method !== undefined
            ? { payments: { some: { method: (0, utilities_1.normalizeSalePaymentMethod)(filters.method) } } }
            : {}),
        ...(filters.productId !== undefined
            ? { items: { some: { productId: filters.productId } } }
            : {}),
        ...((filters.minTotal !== undefined || filters.maxTotal !== undefined) ? {
            total: {
                ...(filters.minTotal !== undefined ? { gte: (0, utilities_1.toDecimal)(filters.minTotal) } : {}),
                ...(filters.maxTotal !== undefined ? { lte: (0, utilities_1.toDecimal)(filters.maxTotal) } : {})
            }
        } : {})
    };
}
// Creates a sale atomically: header, items, payments, stock updates and SALE stock movements.
// Does NOT call createStockMovement from the repository: that would double-update stock.
async function createSale(data) {
    if (!Array.isArray(data.items) || data.items.length === 0) {
        throw new Error("Sale must contain at least one item");
    }
    if (!Array.isArray(data.payments) || data.payments.length === 0) {
        throw new Error("Sale must contain at least one payment");
    }
    const normalizedItems = data.items.map((item, index) => {
        const unitPrice = (0, utilities_1.toDecimal)(item.unitPrice);
        if (unitPrice.lt(0)) {
            throw new Error(`items[${index}].unitPrice must be >= 0`);
        }
        return {
            // preserve productId as-is (may be undefined/null for general lines)
            productId: item.productId,
            quantity: (0, utilities_1.ensurePositiveInteger)(item.quantity, `items[${index}].quantity`),
            unitPrice
        };
    });
    const normalizedPayments = data.payments.map((payment, index) => {
        const amount = (0, utilities_1.toDecimal)(payment.amount);
        if (amount.lte(0)) {
            throw new Error(`payments[${index}].amount must be > 0`);
        }
        return {
            method: (0, utilities_1.normalizeSalePaymentMethod)(payment.method),
            amount
        };
    });
    const calculatedSubtotal = normalizedItems.reduce((acc, item) => acc.add(item.unitPrice.mul(item.quantity)), new client_1.Prisma.Decimal(0));
    // Parse discountPct
    const discountPct = data.discountPct !== undefined
        ? (0, utilities_1.toDecimal)(data.discountPct)
        : new client_1.Prisma.Decimal(0);
    if (discountPct.abs().gt(new client_1.Prisma.Decimal(200))) {
        throw new Error("discountPct must be in [-200, 200]");
    }
    // Calculate expected total with discount
    const factor = new client_1.Prisma.Decimal(1).sub(discountPct.div(new client_1.Prisma.Decimal(100)));
    const raw = calculatedSubtotal.mul(factor);
    const expectedTotal = raw.lt(0) ? new client_1.Prisma.Decimal(0) : raw;
    const clientTotal = (0, utilities_1.toDecimal)(data.total);
    if (clientTotal.sub(expectedTotal).abs().gt(MONEY_EPSILON)) {
        throw new Error(`Client-provided total (${clientTotal.toString()}) does not match expected total (${expectedTotal.toString()})`);
    }
    // Canonical value: persist the server's recalculation, not the client's input.
    const total = expectedTotal;
    const paymentsSum = normalizedPayments.reduce((acc, payment) => acc.add(payment.amount), new client_1.Prisma.Decimal(0));
    if (total.sub(paymentsSum).gt(MONEY_EPSILON)) {
        throw new Error(`Payments sum (${paymentsSum.toString()}) is less than sale total (${total.toString()})`);
    }
    return client_2.default.$transaction(async (tx) => {
        // Mapa vacío por default; se llena solo cuando hay ítems con productId
        const purchasePriceMap = new Map();
        // Validate that all items that reference a product actually exist.
        // Skip validation when there are no product-linked items.
        const productIds = Array.from(new Set(normalizedItems
            .map((item) => item.productId)
            .filter((id) => id != null)));
        if (productIds.length > 0) {
            const existingProducts = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, purchasePrice: true }
            });
            if (existingProducts.length !== productIds.length) {
                const foundIds = new Set(existingProducts.map((p) => p.id));
                const missingId = productIds.find((id) => !foundIds.has(id));
                throw new Error(`Product ${missingId} not found`);
            }
            // Mapa productId → precio de compra para guardar el snapshot en cada SaleItem
            for (const p of existingProducts) {
                purchasePriceMap.set(p.id, p.purchasePrice);
            }
        }
        const sale = await tx.sale.create({
            data: {
                total,
                discountPct,
                ...(data.date ? { date: data.date } : {}),
                items: {
                    create: normalizedItems.map((item) => ({
                        // Persist productId as null when absent so DB stores general items with productId = NULL
                        productId: item.productId ?? null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        // Capturar precio de compra del momento de la venta para calcular ganancia en stats
                        purchasePriceSnapshot: item.productId != null
                            ? purchasePriceMap.get(item.productId) ?? null
                            : null
                    }))
                },
                payments: {
                    create: normalizedPayments.map((payment) => ({
                        method: payment.method,
                        amount: payment.amount
                    }))
                }
            },
            include: saleInclude
        });
        for (const item of normalizedItems) {
            // Items without a productId are "general" and must not touch stock nor create movements
            if (item.productId == null)
                continue;
            await tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } }
            });
            await tx.stockMovement.create({
                data: {
                    productId: item.productId,
                    type: "SALE",
                    quantity: item.quantity,
                    appliedDelta: -item.quantity,
                    saleId: sale.id,
                    notes: `Sale #${sale.id}`
                }
            });
        }
        return sale;
    });
}
// Lists sales with filters by date range, payment method and product.
async function listSales(filters) {
    const pagination = (0, utilities_1.normalizePagination)(filters);
    return client_2.default.sale.findMany({
        where: buildSaleWhere(filters),
        orderBy: { date: "desc" },
        include: saleInclude,
        ...pagination
    });
}
// Reads one sale by id with items (and product) and payments included.
async function getSaleById(id) {
    return client_2.default.sale.findUnique({
        where: { id },
        include: saleInclude
    });
}
//# sourceMappingURL=saleService.js.map