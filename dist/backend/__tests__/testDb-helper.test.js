"use strict";
/**
 * backend/__tests__/testDb-helper.test.ts
 *
 * Tests del helper backend/__tests__/helpers/testDb.ts (createMigratedTestDb).
 * Es la base de todos los demás tests de DB, por eso corre primero en
 * `npm run test:backend`.
 *
 * Caso 1 — Crea el archivo
 * Caso 2 — Aplica todas las migraciones
 * Caso 3 — La DB nace vacía (7 tablas de negocio en 0 filas)
 * Caso 4 — No toca dev.db (SHA-256 igual antes y después)
 * Caso 5 — El archivo está ignorado por git
 * Caso 6 — cleanup() borra el archivo
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
const client_1 = require("@prisma/client");
const testDb_1 = require("./helpers/testDb");
// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------
const repoRoot = path_1.default.resolve(__dirname, "..", "..");
const devDbPath = path_1.default.join(repoRoot, "backend", "prisma", "dev.db");
const migrationsDir = path_1.default.join(repoRoot, "backend", "prisma", "migrations");
// ---------------------------------------------------------------------------
// Utilidades de assert
// ---------------------------------------------------------------------------
function assert(condition, message) {
    if (!condition)
        throw new Error(`ASSERT FAILED: ${message}`);
}
function logStep(step) {
    console.log(`  PASS: ${step}`);
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/**
 * SHA-256 de un archivo, o `null` si no existe (en una instalación nueva
 * dev.db puede no haberse creado todavía).
 */
function hashFileIfExists(filePath) {
    if (!fs_1.default.existsSync(filePath))
        return null;
    return crypto_1.default.createHash("sha256").update(fs_1.default.readFileSync(filePath)).digest("hex");
}
/**
 * Cantidad de migraciones esperadas = cantidad de carpetas en
 * backend/prisma/migrations/ (migration_lock.toml es un archivo y no cuenta).
 */
function countMigrationFolders() {
    return fs_1.default.readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
        .length;
}
// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------
async function main() {
    console.log("=== testDb-helper.test.ts ===");
    const devDbHashBefore = hashFileIfExists(devDbPath);
    const testDb = (0, testDb_1.createMigratedTestDb)("helper");
    const devDbHashAfter = hashFileIfExists(devDbPath);
    const prisma = new client_1.PrismaClient({ datasources: { db: { url: testDb.databaseUrl } } });
    let disconnected = false;
    try {
        // Caso 1 — Crea el archivo
        assert(fs_1.default.existsSync(testDb.dbPath), `la DB de test debe existir en ${testDb.dbPath}`);
        logStep("crea el archivo de la DB de test");
        // Caso 2 — Migraciones aplicadas (solo cuentan las que terminaron bien)
        const expectedMigrations = countMigrationFolders();
        const migrationRows = await prisma.$queryRawUnsafe("SELECT COUNT(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL");
        const appliedMigrations = Number(migrationRows[0].n);
        assert(appliedMigrations === expectedMigrations, `migraciones aplicadas debe ser ${expectedMigrations}, got ${appliedMigrations}`);
        logStep(`aplica las ${expectedMigrations} migraciones`);
        // Caso 3 — Vacía
        const counts = {
            category: await prisma.category.count(),
            supplier: await prisma.supplier.count(),
            product: await prisma.product.count(),
            stockMovement: await prisma.stockMovement.count(),
            sale: await prisma.sale.count(),
            saleItem: await prisma.saleItem.count(),
            salePayment: await prisma.salePayment.count(),
        };
        for (const [table, count] of Object.entries(counts)) {
            assert(count === 0, `${table} debe tener 0 filas, got ${count}`);
        }
        logStep("las 7 tablas de negocio arrancan en 0 filas");
        // Caso 4 — No toca dev.db
        assert(devDbHashBefore === devDbHashAfter, "crear la DB de test no debe modificar dev.db");
        logStep(devDbHashBefore === null
            ? "no crea dev.db (no existía)"
            : "dev.db queda intacta (SHA-256 igual)");
        // Caso 5 — Ignorada por git (status 0 = la ruta está ignorada)
        const checkIgnore = (0, child_process_1.spawnSync)("git", ["check-ignore", "-q", testDb.dbPath], {
            cwd: repoRoot,
            encoding: "utf-8",
        });
        assert(checkIgnore.status === 0, `la DB de test debe estar ignorada por git, git check-ignore devolvió ${checkIgnore.status}`);
        logStep("la DB de test está ignorada por git");
        // Caso 6 — Cleanup (hay que desconectar antes: en Windows el archivo
        // abierto no se puede borrar)
        await prisma.$disconnect();
        disconnected = true;
        testDb.cleanup();
        assert(!fs_1.default.existsSync(testDb.dbPath), "cleanup() debe borrar el archivo de la DB");
        logStep("cleanup() borra el archivo");
    }
    finally {
        // Si algún assert falló antes del caso 6, igual liberamos y borramos.
        if (!disconnected) {
            await prisma.$disconnect();
            testDb.cleanup();
        }
    }
    console.log("\nSUCCESS: todos los tests del helper de DB pasaron.");
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=testDb-helper.test.js.map