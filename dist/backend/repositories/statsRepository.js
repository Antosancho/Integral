"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesSummary = getSalesSummary;
exports.getTopProductsByQuantity = getTopProductsByQuantity;
exports.getTopProductsByRevenue = getTopProductsByRevenue;
exports.getSalesByHour = getSalesByHour;
exports.getSalesByWeekday = getSalesByWeekday;
exports.getLowRotationProducts = getLowRotationProducts;
const client_1 = __importDefault(require("../db/client"));
const client_2 = require("@prisma/client");
// ---------------------------------------------------------------------------
// Función 1: resumen de ventas en un período
// ---------------------------------------------------------------------------
/**
 * Retorna totales de revenue, cantidad de ventas, ticket promedio y ganancia.
 * La ganancia solo considera ítems con productId y purchasePriceSnapshot (ventas nuevas).
 */
async function getSalesSummary(from, to) {
    const [aggResult, profitItems] = await Promise.all([
        // Agrega totales de ventas en el rango
        client_1.default.sale.aggregate({
            where: { date: { gte: from, lte: to } },
            _sum: { total: true },
            _count: { id: true }
        }),
        // Trae ítems con snapshot de precio de compra para calcular margen
        client_1.default.saleItem.findMany({
            where: {
                sale: { date: { gte: from, lte: to } },
                productId: { not: null },
                purchasePriceSnapshot: { not: null }
            },
            select: { quantity: true, unitPrice: true, purchasePriceSnapshot: true }
        })
    ]);
    const totalRevenue = aggResult._sum.total?.toString() ?? '0';
    const saleCount = aggResult._count.id;
    // Ganancia = Σ (precioVenta - precioCompra) × cantidad
    let profit = new client_2.Prisma.Decimal(0);
    for (const item of profitItems) {
        const margin = new client_2.Prisma.Decimal(item.unitPrice).sub(item.purchasePriceSnapshot);
        profit = profit.add(margin.mul(item.quantity));
    }
    const averageTicket = saleCount === 0
        ? '0'
        : new client_2.Prisma.Decimal(totalRevenue).div(saleCount).toDecimalPlaces(2).toString();
    return {
        totalRevenue,
        saleCount,
        averageTicket,
        totalProfit: profit.toDecimalPlaces(2).toString()
    };
}
// ---------------------------------------------------------------------------
// Función 2: top productos por unidades vendidas
// ---------------------------------------------------------------------------
/**
 * Retorna los `limit` productos con más unidades vendidas en el período.
 */
async function getTopProductsByQuantity(from, to, limit) {
    const grouped = await client_1.default.saleItem.groupBy({
        by: ['productId'],
        where: {
            sale: { date: { gte: from, lte: to } },
            productId: { not: null }
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: limit
    });
    const productIds = grouped.map((g) => g.productId);
    if (productIds.length === 0)
        return [];
    const products = await client_1.default.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true }
    });
    const nameMap = new Map();
    for (const p of products)
        nameMap.set(p.id, p.name);
    return grouped.map((g) => ({
        productId: g.productId,
        productName: nameMap.get(g.productId) ?? 'Desconocido',
        value: (g._sum.quantity ?? 0).toString()
    }));
}
// ---------------------------------------------------------------------------
// Función 3: top productos por monto facturado
// ---------------------------------------------------------------------------
/**
 * Retorna los `limit` productos con mayor facturación (unitPrice × quantity) en el período.
 * Se agrupa en JS porque Prisma no permite `SUM(unitPrice * quantity)` directamente.
 */
async function getTopProductsByRevenue(from, to, limit) {
    const items = await client_1.default.saleItem.findMany({
        where: {
            sale: { date: { gte: from, lte: to } },
            productId: { not: null }
        },
        select: { productId: true, quantity: true, unitPrice: true }
    });
    // Acumular revenue por producto
    const revenueMap = new Map();
    for (const item of items) {
        const id = item.productId;
        const itemRevenue = new client_2.Prisma.Decimal(item.unitPrice).mul(item.quantity);
        revenueMap.set(id, (revenueMap.get(id) ?? new client_2.Prisma.Decimal(0)).add(itemRevenue));
    }
    if (revenueMap.size === 0)
        return [];
    // Ordenar por revenue DESC y tomar los primeros `limit`
    const sorted = Array.from(revenueMap.entries())
        .sort(([, a], [, b]) => (b.greaterThan(a) ? 1 : b.lessThan(a) ? -1 : 0))
        .slice(0, limit);
    const topIds = sorted.map(([id]) => id);
    const products = await client_1.default.product.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true }
    });
    const nameMap = new Map();
    for (const p of products)
        nameMap.set(p.id, p.name);
    return sorted.map(([productId, revenue]) => ({
        productId,
        productName: nameMap.get(productId) ?? 'Desconocido',
        value: revenue.toDecimalPlaces(2).toString()
    }));
}
// ---------------------------------------------------------------------------
// Función 4: ventas agrupadas por hora del día
// ---------------------------------------------------------------------------
/**
 * Retorna cantidad de ventas y total facturado por cada hora (0–23) del período.
 * Solo aparecen las horas que tuvieron al menos una venta.
 */
async function getSalesByHour(from, to) {
    const sales = await client_1.default.sale.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, total: true }
    });
    const byHour = new Map();
    for (const sale of sales) {
        const h = sale.date.getHours();
        const prev = byHour.get(h) ?? { count: 0, total: new client_2.Prisma.Decimal(0) };
        byHour.set(h, { count: prev.count + 1, total: prev.total.add(sale.total) });
    }
    return Array.from(byHour.entries())
        .sort(([a], [b]) => a - b)
        .map(([hour, data]) => ({
        label: hour.toString().padStart(2, '0'),
        saleCount: data.count,
        totalRevenue: data.total.toDecimalPlaces(2).toString()
    }));
}
// ---------------------------------------------------------------------------
// Función 5: ventas agrupadas por día de semana
// ---------------------------------------------------------------------------
/**
 * Retorna cantidad de ventas y total facturado por día de semana (0=Dom, 6=Sáb).
 * Solo aparecen los días que tuvieron al menos una venta.
 */
async function getSalesByWeekday(from, to) {
    const sales = await client_1.default.sale.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, total: true }
    });
    const byWeekday = new Map();
    for (const sale of sales) {
        const d = sale.date.getDay();
        const prev = byWeekday.get(d) ?? { count: 0, total: new client_2.Prisma.Decimal(0) };
        byWeekday.set(d, { count: prev.count + 1, total: prev.total.add(sale.total) });
    }
    return Array.from(byWeekday.entries())
        .sort(([a], [b]) => a - b)
        .map(([weekday, data]) => ({
        label: weekday.toString(),
        saleCount: data.count,
        totalRevenue: data.total.toDecimalPlaces(2).toString()
    }));
}
// ---------------------------------------------------------------------------
// Función 6: productos con menor rotación en el período
// ---------------------------------------------------------------------------
/**
 * Retorna los `limit` productos con menos unidades vendidas en el período.
 * Los productos sin ventas aparecen con totalQuantity = 0.
 */
async function getLowRotationProducts(from, to, limit) {
    const [allProducts, soldGroups] = await Promise.all([
        client_1.default.product.findMany({ select: { id: true, name: true } }),
        client_1.default.saleItem.groupBy({
            by: ['productId'],
            where: {
                sale: { date: { gte: from, lte: to } },
                productId: { not: null }
            },
            _sum: { quantity: true }
        })
    ]);
    const soldMap = new Map();
    for (const g of soldGroups) {
        soldMap.set(g.productId, g._sum.quantity ?? 0);
    }
    const results = allProducts.map((p) => ({
        productId: p.id,
        productName: p.name,
        totalQuantity: soldMap.get(p.id) ?? 0
    }));
    // Menor rotación primero (ASC)
    results.sort((a, b) => a.totalQuantity - b.totalQuantity);
    return results.slice(0, limit);
}
//# sourceMappingURL=statsRepository.js.map