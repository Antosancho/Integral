import { contextBridge, ipcRenderer } from "electron"
import { buildElectronApi } from "./ipcContract"

const api = Object.freeze(
  buildElectronApi((channel, payload) => ipcRenderer.invoke(channel, payload))
)

// Expose only an immutable IPC API surface to the renderer.
contextBridge.exposeInMainWorld("api", api)
