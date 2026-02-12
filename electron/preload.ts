import { contextBridge } from "electron"

// Expose a minimal, safe API surface for the renderer.
contextBridge.exposeInMainWorld("api", {
  // add IPC methods here when needed
})

