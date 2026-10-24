/**
 * electron/license.ts
 *
 * Aceptación de la licencia de uso (EULA) en el primer arranque.
 *
 * Squirrel.Windows no muestra pantallas durante la instalación, así que la
 * licencia se acepta dentro de la app (ver ensureLicenseAccepted en main.ts).
 * La aceptación se guarda en <userData>/license-accepted.json junto con la
 * versión de la licencia: si cambia LICENSE_VERSION, se vuelve a pedir.
 *
 * Funciones puras (sin importar `electron`): se testean con ts-node en
 * backend/__tests__/license.test.ts.
 */

import fs from "fs"
import path from "path"

/** Subir este número cada vez que cambie LICENSE.txt: obliga a todos a aceptar de nuevo. */
export const LICENSE_VERSION = "1"

export type LicenseAcceptance = { licenseVersion: string; acceptedAt: string } // acceptedAt en ISO 8601

/** null si el archivo no existe, no es JSON válido o no tiene la forma esperada (dos strings). Nunca lanza. */
export function readLicenseAcceptance(filePath: string): LicenseAcceptance | null {
  try {
    const data: unknown = JSON.parse(fs.readFileSync(filePath, "utf-8"))
    if (typeof data !== "object" || data === null) return null
    const { licenseVersion, acceptedAt } = data as Record<string, unknown>
    if (typeof licenseVersion !== "string" || typeof acceptedAt !== "string") return null
    return { licenseVersion, acceptedAt }
  } catch {
    return null
  }
}

/** true si hay una aceptación registrada para la versión actual de la licencia. */
export function isLicenseAccepted(acceptance: LicenseAcceptance | null, currentVersion: string): boolean {
  return acceptance !== null && acceptance.licenseVersion === currentVersion
}

/** Crea la carpeta si hace falta, escribe el JSON y devuelve lo escrito. */
export function writeLicenseAcceptance(filePath: string, version: string, now: Date): LicenseAcceptance {
  const acceptance: LicenseAcceptance = { licenseVersion: version, acceptedAt: now.toISOString() }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(acceptance, null, 2))
  return acceptance
}
