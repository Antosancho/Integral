"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const repoRoot = path_1.default.resolve(__dirname, "..", "..");
const schemaPath = path_1.default.join(repoRoot, "backend", "prisma", "schema.prisma");
const schemaDir = path_1.default.dirname(schemaPath);
const scalarTypes = new Set(["String", "Int", "BigInt", "Decimal", "DateTime", "Boolean", "Float", "Bytes", "Json"]);
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function readDatabaseUrl() {
    const envContent = fs_1.default.readFileSync(path_1.default.join(repoRoot, ".env"), "utf-8");
    const databaseUrlLine = envContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith("DATABASE_URL="));
    assert(databaseUrlLine, ".env must define DATABASE_URL");
    return databaseUrlLine
        .slice("DATABASE_URL=".length)
        .trim()
        .replace(/^"(.*)"$/, "$1");
}
function resolvePrismaSqliteUrl(databaseUrl) {
    assert(databaseUrl.startsWith("file:"), `DATABASE_URL must be a SQLite file URL, got ${databaseUrl}`);
    const filePath = databaseUrl.slice("file:".length);
    const absolutePath = path_1.default.isAbsolute(filePath)
        ? filePath
        : path_1.default.resolve(schemaDir, filePath);
    return `file:${absolutePath.replace(/\\/g, "/")}`;
}
function getStockMovementScalarFields() {
    const schema = fs_1.default.readFileSync(schemaPath, "utf-8");
    const block = schema.match(/model\s+StockMovement\s+\{([\s\S]*?)\n\}/);
    assert(block, "schema.prisma must contain model StockMovement");
    return block[1]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
        .flatMap((line) => {
        const match = line.match(/^(\w+)\s+([A-Za-z][A-Za-z0-9]*)(?:\?)?/);
        if (!match || !scalarTypes.has(match[2]))
            return [];
        return [match[1]];
    });
}
async function main() {
    const databaseUrl = resolvePrismaSqliteUrl(readDatabaseUrl());
    const prisma = new client_1.PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
        const tableInfo = await prisma.$queryRawUnsafe("PRAGMA table_info(StockMovement)");
        const dbColumns = new Set(tableInfo.map((column) => column.name));
        const schemaColumns = getStockMovementScalarFields();
        const missingColumns = schemaColumns.filter((column) => !dbColumns.has(column));
        assert(missingColumns.length === 0, [
            "StockMovement columns declared in schema.prisma are missing from the configured DB.",
            `DATABASE_URL resolves to: ${databaseUrl}`,
            `Missing columns: ${missingColumns.join(", ")}`
        ].join("\n"));
        console.log(`PASS: StockMovement schema columns exist in ${databaseUrl}`);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=schema-db-sync.test.js.map