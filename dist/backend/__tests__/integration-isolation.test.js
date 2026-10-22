"use strict";
/**
 * backend/__tests__/integration-isolation.test.ts
 *
 * Verifica que los scripts de integración (`backend/test.ts` y
 * `backend/testIpcBridge.ts`) corren sobre una DB temporal aislada y **nunca**
 * modifican `backend/prisma/dev.db`.
 *
 * Detecta, por ejemplo, que `useIsolatedDb` deje de ser el primer import y
 * el Prisma client singleton termine conectado a dev.db.
 *
 * Paso 1 — dev.db existe (si no, hay que correr `npm run prisma:deploy`)
 * Paso 2 — Huella (SHA-256 + tamaño) de dev.db antes
 * Paso 3 — `npm run test:backend-db` termina en verde
 * Paso 4 — `npm run test:ipc-bridge` termina en verde
 * Paso 5 — Huella de dev.db después == antes
 * Paso 6 — No quedan archivos `test-integration.*` en backend/prisma/
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------
const repoRoot = path_1.default.resolve(__dirname, "..", "..");
const prismaDir = path_1.default.join(repoRoot, "backend", "prisma");
const devDbPath = path_1.default.join(prismaDir, "dev.db");
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
/** Huella del archivo: SHA-256 del contenido + tamaño en bytes. */
function fingerprint(filePath) {
    const content = fs_1.default.readFileSync(filePath);
    return {
        sha256: crypto_1.default.createHash("sha256").update(content).digest("hex"),
        size: content.length,
    };
}
/**
 * Corre un script npm desde la raíz del repo y falla mostrando su salida si
 * no termina con status 0.
 */
function runNpmScript(scriptName) {
    // shell: true es necesario en Windows para resolver npm desde PATH
    const result = (0, child_process_1.spawnSync)(`npm run ${scriptName}`, [], {
        cwd: repoRoot,
        shell: true,
        encoding: "utf-8",
        // Timeout generoso: incluye migrar la DB temporal y compilar con ts-node
        timeout: 300000,
    });
    assert(result.status === 0, `npm run ${scriptName} debe terminar con status 0, got ${result.status}\n` +
        `stdout: ${result.stdout || ""}\nstderr: ${result.stderr || ""}`);
}
// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------
async function main() {
    console.log("=== integration-isolation.test.ts ===");
    // Paso 1 — Precondición
    assert(fs_1.default.existsSync(devDbPath), `No existe ${devDbPath}. Corré \`npm run prisma:deploy\` primero.`);
    // Paso 2 — Huella antes
    const before = fingerprint(devDbPath);
    // Pasos 3 y 4 — Scripts de integración en verde
    runNpmScript("test:backend-db");
    logStep("npm run test:backend-db termina en verde");
    runNpmScript("test:ipc-bridge");
    logStep("npm run test:ipc-bridge termina en verde");
    // Paso 5 — dev.db intacta
    const after = fingerprint(devDbPath);
    assert(after.sha256 === before.sha256 && after.size === before.size, `dev.db fue modificada por los tests de integración ` +
        `(antes ${before.size} bytes / ${before.sha256}, después ${after.size} bytes / ${after.sha256})`);
    logStep("dev.db queda intacta (SHA-256 y tamaño iguales)");
    // Paso 6 — Sin DBs temporales huérfanas
    const leftovers = fs_1.default.readdirSync(prismaDir).filter((f) => f.startsWith("test-integration."));
    assert(leftovers.length === 0, `quedaron DBs temporales sin borrar en backend/prisma/: ${leftovers.join(", ")}`);
    logStep("no quedan archivos test-integration.* en backend/prisma/");
    console.log("\nSUCCESS: los tests de integración están aislados de dev.db.");
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=integration-isolation.test.js.map