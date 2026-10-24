/**
 * electron/smoke.ts
 *
 * Modo de prueba automática del binario empaquetado (lo usa
 * scripts/smoke-packaged.mjs).
 *
 * Solo se activa si existe la variable de entorno INTEGRAL_SMOKE_RESULT con la
 * ruta de un archivo JSON. En ese modo la app arranca normalmente, verifica que
 * el renderer cargó, que `window.api` existe, que Prisma funciona dentro del
 * paquete y que el IPC responde de punta a punta; escribe el resultado en el
 * JSON y se cierra sola (código 0 si todo OK, 1 si no).
 */

import { app, type BrowserWindow } from "electron"
import fs from "fs"
import path from "path"
import { listCategories } from "../backend/repositories"
import type { RunMigrationsResult } from "../backend/db/migrator"

/** Resultado que se escribe en INTEGRAL_SMOKE_RESULT. */
export type SmokeResult = {
  ok: boolean
  /** Etapa en la que terminó la prueba ("done" = llegó al final). */
  stage: "migrations" | "load" | "checks" | "timeout" | "done"
  error?: string
  migrationsApplied?: number
  dbCreated?: boolean
  /** `typeof window.api` en el renderer (esperado: "object"). */
  apiType?: string
  /** Hijos de #root después de montar React (esperado: > 0). */
  rootChildren?: number
  /** Categorías leídas directo desde el main (prueba el motor de Prisma). */
  categoriesDirect?: number
  /** Categorías leídas desde el renderer vía window.api (prueba el IPC). */
  categoriesViaIpc?: number
  isPackaged: boolean
  userDataPath: string
  /** Archivo del main que está corriendo: "main.jsc" en el paquete (bytecode), "main.cjs" en dev. */
  mainFile: string
}

/** Tiempo máximo para que el renderer cargue y respondan los chequeos. */
const SMOKE_TIMEOUT_MS = 45_000

/** Completa los datos del entorno, escribe el JSON y cierra la app. */
export function writeSmokeResultAndExit(
  resultPath: string,
  partial: Omit<SmokeResult, "isPackaged" | "userDataPath" | "mainFile">
): void {
  const result: SmokeResult = {
    ...partial,
    isPackaged: app.isPackaged,
    userDataPath: app.getPath("userData"),
    // smoke.ts se bundlea dentro del main: __filename es el archivo del main en ejecución
    mainFile: path.basename(__filename),
  }
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2))
  app.exit(result.ok ? 0 : 1)
}

/** Engancha los chequeos a la carga de la ventana principal. */
export function runSmokeChecks(win: BrowserWindow, migration: RunMigrationsResult, resultPath: string): void {
  // El resultado se escribe una sola vez, gane el timeout, el error de carga o los chequeos.
  let finished = false
  const finish = (partial: Omit<SmokeResult, "isPackaged" | "userDataPath" | "mainFile">) => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    writeSmokeResultAndExit(resultPath, partial)
  }

  const timer = setTimeout(() => finish({ ok: false, stage: "timeout" }), SMOKE_TIMEOUT_MS)

  win.webContents.once("did-fail-load", (_event, code, description) => {
    finish({ ok: false, stage: "load", error: `${code} ${description}` })
  })

  win.webContents.once("did-finish-load", async () => {
    try {
      const apiType = await win.webContents.executeJavaScript("typeof window.api")
      // Espera breve para que React monte la primera pantalla
      const rootChildren = await win.webContents.executeJavaScript(
        'new Promise(r => setTimeout(() => r(document.getElementById("root")?.childElementCount ?? 0), 1500))'
      )
      const categoriesDirect = (await listCategories()).length
      const categoriesViaIpc = await win.webContents.executeJavaScript("window.api.listCategories().then(x => x.length)")

      finish({
        ok: apiType === "object" && rootChildren > 0 && categoriesDirect === categoriesViaIpc,
        stage: "done",
        migrationsApplied: migration.applied.length,
        dbCreated: migration.dbCreated,
        apiType,
        rootChildren,
        categoriesDirect,
        categoriesViaIpc,
      })
    } catch (error) {
      finish({ ok: false, stage: "checks", error: String(error) })
    }
  })
}
