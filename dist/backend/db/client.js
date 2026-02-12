"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function loadEnv() {
    if (process.env.DATABASE_URL)
        return;
    const candidates = [
        path_1.default.resolve(process.cwd(), ".env"),
        path_1.default.resolve(__dirname, "../../.env"),
        path_1.default.resolve(__dirname, "../../../.env")
    ];
    for (const envPath of candidates) {
        if (fs_1.default.existsSync(envPath)) {
            const content = fs_1.default.readFileSync(envPath, "utf-8");
            for (const line of content.split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith("#"))
                    continue;
                const eq = trimmed.indexOf("=");
                if (eq === -1)
                    continue;
                const key = trimmed.slice(0, eq).trim();
                const rawValue = trimmed.slice(eq + 1).trim();
                const value = rawValue.replace(/^"(.*)"$/, "$1");
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
            break;
        }
    }
}
loadEnv();
const prisma = new client_1.PrismaClient();
exports.default = prisma;
//# sourceMappingURL=client.js.map