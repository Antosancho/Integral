"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ipcContract_1 = require("./ipcContract");
const api = Object.freeze((0, ipcContract_1.buildElectronApi)((channel, payload) => electron_1.ipcRenderer.invoke(channel, payload)));
// Expose only an immutable IPC API surface to the renderer.
electron_1.contextBridge.exposeInMainWorld("api", api);
//# sourceMappingURL=preload.js.map