/**
 * electron/main.ts
 *
 * Entry point del main process. Vite lo bundlea a .vite/build/main.cjs.
 *
 * Orden de arranque:
 * 1. setupEnv (primer import): DATABASE_URL y motor de Prisma.
 * 2. Squirrel: si la app se lanzó por un evento de instalación, sale.
 * 3. Instancia única: SQLite no se lleva bien con dos procesos escribiendo.
 * 4. bootstrap(): pide aceptar la licencia de uso (primer arranque o versión nueva),
 *    aplica migraciones pendientes, registra el IPC y abre la ventana.
 *
 * En dev la ventana carga el dev server de Vite (MAIN_WINDOW_VITE_DEV_SERVER_URL);
 * en el paquete carga el index.html del renderer con loadFile. Nunca hardcodear
 * la URL del dev server.
 */

import "./setupEnv"                                    // SIEMPRE el primer import
import started from "electron-squirrel-startup"
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron"
import fs from "fs"
import path from "path"
import { registerIpcHandlers } from "./ipcHandlers"
import { runMigrations, type RunMigrationsResult } from "../backend/db/migrator"
import { resolveLicenseFile, resolveMigrationsDir } from "./runtimePaths"
import { runSmokeChecks, writeSmokeResultAndExit } from "./smoke"
import { LICENSE_VERSION, isLicenseAccepted, readLicenseAcceptance, writeLicenseAcceptance } from "./license"

/** Ruta del JSON de resultado si la app corre en modo smoke test (ver electron/smoke.ts). */
const SMOKE_RESULT = process.env.INTEGRAL_SMOKE_RESULT
let mainWindow: BrowserWindow | null = null

/** Crea la ventana principal con la configuración de seguridad recomendada. */
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once("ready-to-show", () => win.show())
  // La app no abre ventanas nuevas ni navega fuera de sí misma
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.on("will-navigate", (event, url) => {
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL || !url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) event.preventDefault()
  })
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
  return win
}

/** Muestra la licencia si no fue aceptada (o cambió de versión). Devuelve true si se puede seguir. */
function ensureLicenseAccepted(): boolean {
  const acceptanceFile = path.join(app.getPath("userData"), "license-accepted.json")
  if (isLicenseAccepted(readLicenseAcceptance(acceptanceFile), LICENSE_VERSION)) return true
  let text: string
  try {
    text = fs.readFileSync(resolveLicenseFile({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, dirname: __dirname }), "utf-8")
  } catch {
    dialog.showErrorBox("Integral", "Falta el archivo de licencia. Reinstalá la aplicación.")
    return false
  }
  const choice = dialog.showMessageBoxSync({
    type: "info",
    title: "Integral — Licencia de uso",
    message: "Para usar Integral tenés que aceptar la licencia de uso.",
    detail: text,
    buttons: ["Acepto", "No acepto"],
    defaultId: 1,   // Enter (o un scanner) no acepta por accidente
    cancelId: 1,
    noLink: true,
  })
  if (choice !== 0) return false
  writeLicenseAcceptance(acceptanceFile, LICENSE_VERSION, new Date())
  return true
}

/** Arranque de la app una vez que Electron está listo. */
async function bootstrap() {
  Menu.setApplicationMenu(null)            // se mantiene: F10 no debe abrir el menú nativo
  // Licencia antes de las migraciones: si no se acepta, no se toca la base.
  // El modo smoke la saltea (el diálogo bloquearía la prueba) y se cierra solo al terminar.
  if (!SMOKE_RESULT && !ensureLicenseAccepted()) {
    app.exit(0)
    return
  }
  let migration: RunMigrationsResult
  try {
    migration = await runMigrations({
      databaseUrl: process.env.DATABASE_URL as string,
      migrationsDir: resolveMigrationsDir({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, dirname: __dirname }),
    })
  } catch (error) {
    // Sin base de datos utilizable la app no puede funcionar: se avisa y se cierra sin tocar nada más.
    const message = error instanceof Error ? error.message : String(error)
    if (SMOKE_RESULT) return writeSmokeResultAndExit(SMOKE_RESULT, { ok: false, stage: "migrations", error: message })
    dialog.showErrorBox("Integral — Error en la base de datos", message)
    app.exit(1)
    return
  }
  registerIpcHandlers(ipcMain)
  mainWindow = createWindow()
  if (SMOKE_RESULT) runSmokeChecks(mainWindow, migration, SMOKE_RESULT)
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow()
  })
}

if (started) {
  app.quit()                               // eventos de instalación/desinstalación de Squirrel
} else if (!app.requestSingleInstanceLock()) {
  app.quit()                               // ya hay otra instancia abierta
} else {
  // Si se intenta abrir una segunda instancia, se enfoca la ventana existente
  app.on("second-instance", () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.whenReady().then(bootstrap)
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}
