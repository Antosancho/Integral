"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose a minimal, safe API surface for the renderer.
electron_1.contextBridge.exposeInMainWorld("api", {
// add IPC methods here when needed
});
//# sourceMappingURL=preload.js.map