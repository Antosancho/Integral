"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStockMovementById = exports.getProductByBarcode = exports.getProductById = exports.getSupplierById = exports.getCategoryById = void 0;
var categoryRepository_1 = require("./categoryRepository");
Object.defineProperty(exports, "getCategoryById", { enumerable: true, get: function () { return categoryRepository_1.getCategoryById; } });
var supplierRepository_1 = require("./supplierRepository");
Object.defineProperty(exports, "getSupplierById", { enumerable: true, get: function () { return supplierRepository_1.getSupplierById; } });
var productRepository_1 = require("./productRepository");
Object.defineProperty(exports, "getProductById", { enumerable: true, get: function () { return productRepository_1.getProductById; } });
Object.defineProperty(exports, "getProductByBarcode", { enumerable: true, get: function () { return productRepository_1.getProductByBarcode; } });
var stockMovementRepository_1 = require("./stockMovementRepository");
Object.defineProperty(exports, "getStockMovementById", { enumerable: true, get: function () { return stockMovementRepository_1.getStockMovementById; } });
//# sourceMappingURL=id.js.map