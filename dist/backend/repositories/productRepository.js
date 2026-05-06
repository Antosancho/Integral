"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProduct = createProduct;
exports.listProducts = listProducts;
exports.getProductById = getProductById;
exports.getProductByBarcode = getProductByBarcode;
exports.updateProduct = updateProduct;
exports.updateProductStock = updateProductStock;
exports.changeProductStock = changeProductStock;
exports.deleteProduct = deleteProduct;
const client_1 = __importDefault(require("../db/client"));
const utilities_1 = require("./utilities");
// Builds a reusable where object for product list queries.
function buildProductWhere(filters) {
    if (!filters)
        return {};
    return {
        ...(filters.id !== undefined ? { id: filters.id } : {}),
        ...(filters.barcode !== undefined ? { barcode: (0, utilities_1.toBigInt)(filters.barcode) } : {}),
        ...(filters.categoryId !== undefined ? { categoryId: filters.categoryId } : {}),
        ...(filters.supplierId !== undefined ? { supplierId: filters.supplierId } : {}),
        ...(filters.nameContains
            ? { name: { contains: filters.nameContains } }
            : {})
    };
}
/**
 * Crea un producto y, cuando stock > 0, genera un StockMovement IN inicial
 * en la misma transacción para garantizar trazabilidad del lote.
 * appliedDelta = 0 porque el stock ya quedó persistido en Product.create;
 * el movement solo registra el lote (y opcionalmente su fecha de vencimiento).
 */
async function createProduct(data) {
    const stock = (0, utilities_1.ensureNonNegativeInteger)(data.stock ?? 0, "stock");
    const minStock = (0, utilities_1.ensureNonNegativeInteger)(data.minStock ?? 0, "minStock");
    return client_1.default.$transaction(async (tx) => {
        const product = await tx.product.create({
            data: {
                name: (0, utilities_1.normalizeRequiredString)(data.name, "name"),
                purchasePrice: (0, utilities_1.toDecimal)(data.purchasePrice),
                salePrice: (0, utilities_1.toDecimal)(data.salePrice),
                categoryId: data.categoryId,
                supplierId: data.supplierId,
                barcode: data.barcode !== undefined && data.barcode !== null ? (0, utilities_1.toBigInt)(data.barcode) : null,
                stock,
                minStock
            },
            include: utilities_1.productInclude
        });
        if (stock > 0) {
            await tx.stockMovement.create({
                data: {
                    productId: product.id,
                    type: "IN",
                    quantity: stock,
                    // delta 0: el stock ya quedó en Product.create; este mov solo registra el lote inicial
                    appliedDelta: 0,
                    notes: "Lote inicial al crear producto",
                    ...(data.expiryDate ? { expiryDate: data.expiryDate } : {})
                }
            });
        }
        return product;
    });
}
// Lists products with optional filters and pagination.
async function listProducts(filters) {
    const pagination = (0, utilities_1.normalizePagination)(filters);
    return client_1.default.product.findMany({
        where: buildProductWhere(filters),
        orderBy: { createdAt: "desc" },
        include: utilities_1.productInclude,
        ...pagination
    });
}
// Reads one product by id, including category and supplier.
async function getProductById(id) {
    return client_1.default.product.findUnique({
        where: { id },
        include: utilities_1.productInclude
    });
}
// Reads one product by unique barcode.
async function getProductByBarcode(barcode) {
    return client_1.default.product.findUnique({
        where: { barcode: (0, utilities_1.toBigInt)(barcode) },
        include: utilities_1.productInclude
    });
}
// Updates one product; only provided fields are changed.
async function updateProduct(id, data) {
    const updateData = {
        ...(data.name !== undefined ? { name: (0, utilities_1.normalizeRequiredString)(data.name, "name") } : {}),
        ...(data.purchasePrice !== undefined ? { purchasePrice: (0, utilities_1.toDecimal)(data.purchasePrice) } : {}),
        ...(data.salePrice !== undefined ? { salePrice: (0, utilities_1.toDecimal)(data.salePrice) } : {}),
        ...(data.categoryId !== undefined ? { category: { connect: { id: data.categoryId } } } : {}),
        ...(data.supplierId !== undefined ? { supplier: { connect: { id: data.supplierId } } } : {}),
        ...(data.barcode !== undefined
            ? { barcode: data.barcode === null ? null : (0, utilities_1.toBigInt)(data.barcode) }
            : {}),
        ...(data.stock !== undefined
            ? { stock: (0, utilities_1.ensureNonNegativeInteger)(data.stock, "stock") }
            : {}),
        ...(data.minStock !== undefined
            ? { minStock: (0, utilities_1.ensureNonNegativeInteger)(data.minStock, "minStock") }
            : {})
    };
    return client_1.default.product.update({
        where: { id },
        data: updateData,
        include: utilities_1.productInclude
    });
}
// Sets the absolute stock value after validation.
async function updateProductStock(id, stock) {
    return client_1.default.product.update({
        where: { id },
        data: { stock: (0, utilities_1.ensureNonNegativeInteger)(stock, "stock") },
        include: utilities_1.productInclude
    });
}
// Applies a stock delta atomically (positive or negative).
async function changeProductStock(id, delta) {
    if (!Number.isInteger(delta)) {
        throw new Error("delta must be an integer");
    }
    return client_1.default.$transaction(async (tx) => {
        const existing = await tx.product.findUnique({ where: { id } });
        if (!existing) {
            throw new Error(`Product ${id} not found`);
        }
        const nextStock = existing.stock + delta;
        return tx.product.update({
            where: { id },
            data: { stock: nextStock },
            include: utilities_1.productInclude
        });
    });
}
// Deletes a product by id.
async function deleteProduct(id) {
    return client_1.default.product.delete({
        where: { id }
    });
}
//# sourceMappingURL=productRepository.js.map