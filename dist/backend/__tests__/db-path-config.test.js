"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const repoRoot = path_1.default.resolve(__dirname, "..", "..");
const schemaDir = path_1.default.join(repoRoot, "backend", "prisma");
function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
function normalizePath(value) {
    return path_1.default.resolve(value).replace(/\\/g, "/").toLowerCase();
}
function readRootDatabaseUrl() {
    const envPath = path_1.default.join(repoRoot, ".env");
    const envContent = fs_1.default.readFileSync(envPath, "utf-8");
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
    // Prisma resolves relative SQLite URLs from the schema directory, not from process.cwd().
    return path_1.default.isAbsolute(filePath)
        ? filePath
        : path_1.default.resolve(schemaDir, filePath);
}
function resolveElectronDevDbPath() {
    const setupEnvPath = path_1.default.join(repoRoot, "electron", "setupEnv.ts");
    const setupEnvSource = fs_1.default.readFileSync(setupEnvPath, "utf-8");
    const joinCall = setupEnvSource.match(/return\s+path\.join\(([^)]*"dev\.db"[^)]*)\)/);
    assert(joinCall, "electron/setupEnv.ts must build the development DB path with path.join(..., \"dev.db\")");
    const args = Array.from(joinCall[1].matchAll(/__dirname|"([^"]+)"/g)).map((match) => (match[0] === "__dirname" ? "__dirname" : match[1]));
    assert(args[0] === "__dirname", "electron/setupEnv.ts DB path must start from __dirname");
    // setupEnv.ts is compiled to dist/electron/setupEnv.js; runtime __dirname points there.
    const runtimeDirname = path_1.default.join(repoRoot, "dist", "electron");
    const pathSegments = args.slice(1);
    return path_1.default.join(runtimeDirname, ...pathSegments);
}
function main() {
    const prismaDbPath = normalizePath(resolvePrismaSqliteUrl(readRootDatabaseUrl()));
    const electronDbPath = normalizePath(resolveElectronDevDbPath());
    assert(prismaDbPath === electronDbPath, [
        "DATABASE_URL and Electron runtime DB path must resolve to the same file.",
        `Prisma CLI path: ${prismaDbPath}`,
        `Electron path: ${electronDbPath}`,
        "Use DATABASE_URL=\"file:./dev.db\" in the root .env for this project."
    ].join("\n"));
    console.log(`PASS: Prisma CLI and Electron use ${prismaDbPath}`);
}
main();
//# sourceMappingURL=db-path-config.test.js.map