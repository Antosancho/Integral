"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
function resolveDbPath() {
    if (electron_1.app.isPackaged) {
        return path_1.default.join(electron_1.app.getPath("userData"), "integral.db");
    }
    return path_1.default.join(__dirname, "..", "..", "backend", "prisma", "dev.db");
}
if (!process.env.DATABASE_URL) {
    const dbPath = resolveDbPath().replace(/\\/g, "/");
    process.env.DATABASE_URL = `file:${dbPath}`;
}
//# sourceMappingURL=setupEnv.js.map