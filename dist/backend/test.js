"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const client_2 = __importDefault(require("./db/client"));
async function main() {
    const category = await client_2.default.category.create({
        data: {
            name: "Bebidas"
        }
    });
    const supplier = await client_2.default.supplier.create({
        data: {
            name: "Distribuidora Central"
        }
    });
    const product = await client_2.default.product.create({
        data: {
            name: "Coca Cola 500ml",
            purchasePrice: new client_1.Prisma.Decimal(500),
            salePrice: new client_1.Prisma.Decimal(750),
            categoryId: category.id,
            supplierId: supplier.id
        }
    });
    console.log("Producto creado:", product);
}
main();
//# sourceMappingURL=test.js.map