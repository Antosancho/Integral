/**
 * backend/__tests__/repo-hygiene.test.ts
 *
 * Verifica que el repositorio no versione datos del negocio ni secretos.
 * El repo es público: cualquier `.db`, backup o token que se commitee queda
 * expuesto en el historial.
 *
 * Caso 1 — Ningún `.db` / `.db-journal` versionado
 * Caso 2 — Nada de `backups/` versionado
 * Caso 3 — `.claude/settings.local.json` y `.env` no versionados
 * Caso 4 — Ningún token de GitHub en archivos versionados
 * Caso 5 — Reglas de `.gitignore` activas para las rutas sensibles
 * Caso 6 — `.env.example` versionable y con la DATABASE_URL esperada
 *
 * Usa `git` directamente (sin shell) sobre el índice, por eso el caso 1 solo
 * pasa una vez que los archivos se quitaron del índice con `git rm --cached`.
 */

import fs from "fs"
import path from "path"
import { spawnSync } from "child_process"

// ---------------------------------------------------------------------------
// Rutas base
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "..", "..")

// ---------------------------------------------------------------------------
// Utilidades de assert
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
}

function logStep(step: string) {
  console.log(`  PASS: ${step}`)
}

// ---------------------------------------------------------------------------
// Helpers de git
// ---------------------------------------------------------------------------

/** Corre `git <args>` en la raíz del repo y devuelve status + salida. */
function git(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8" })
  return {
    status: result.status ?? -1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  }
}

/** Lista de archivos versionados (índice de git), con `/` como separador. */
function trackedFiles(): string[] {
  const result = git(["ls-files"])
  assert(result.status === 0, `git ls-files falló: ${result.stderr}`)
  return result.stdout.split(/\r?\n/).filter((line) => line.length > 0)
}

/** `true` si git ignora la ruta (git check-ignore devuelve 0 si está ignorada). */
function isIgnored(relativePath: string): boolean {
  return git(["check-ignore", "-q", relativePath]).status === 0
}

// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== repo-hygiene.test.ts ===")

  const files = trackedFiles()

  // Caso 1 — Ningún .db versionado
  const trackedDbs = files.filter((f) => f.endsWith(".db") || f.endsWith(".db-journal"))
  assert(trackedDbs.length === 0, `hay bases de datos versionadas: ${trackedDbs.join(", ")}`)
  logStep("ningún .db / .db-journal versionado")

  // Caso 2 — Nada de backups/ versionado
  const trackedBackups = files.filter((f) => f.startsWith("backups/"))
  assert(trackedBackups.length === 0, `hay backups versionados: ${trackedBackups.join(", ")}`)
  logStep("nada de backups/ versionado")

  // Caso 3 — Config local no versionada
  for (const localOnly of [".claude/settings.local.json", ".env"]) {
    assert(!files.includes(localOnly), `${localOnly} no debe estar versionado`)
  }
  logStep(".claude/settings.local.json y .env no versionados")

  // Caso 4 — Sin tokens versionados. git grep devuelve 1 cuando no hay matches.
  // Usamos -n para obtener archivo:línea, pero NUNCA mostramos el contenido
  // de la línea (contendría el token completo).
  const tokenSearch = git([
    "grep",
    "-I",
    "-n",
    "-E",
    "ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}",
  ])
  if (tokenSearch.status === 0) {
    // Formato de cada línea: <archivo>:<línea>:<contenido>. Nos quedamos solo
    // con <archivo>:<línea>.
    const locations = tokenSearch.stdout
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => line.split(":").slice(0, 2).join(":"))
    throw new Error(
      `ASSERT FAILED: hay tokens de GitHub en archivos versionados: ${locations.join(", ")}`
    )
  }
  assert(
    tokenSearch.status === 1,
    `git grep debe devolver 1 (sin matches), got ${tokenSearch.status}: ${tokenSearch.stderr}`
  )
  logStep("ningún token de GitHub en archivos versionados")

  // Caso 5 — Reglas de ignore activas (las rutas no necesitan existir)
  for (const sensitivePath of [
    "backend/prisma/dev.db",
    "backups/cualquier.db",
    ".claude/settings.local.json",
    ".env",
    "backend/prisma/test-x.db",
  ]) {
    assert(isIgnored(sensitivePath), `${sensitivePath} debe estar ignorado por .gitignore`)
  }
  logStep("dev.db, backups/, settings.local.json, .env y test*.db están ignorados")

  // Caso 6 — .env.example versionable y correcto
  assert(!isIgnored(".env.example"), ".env.example NO debe estar ignorado")
  const envExamplePath = path.join(repoRoot, ".env.example")
  assert(fs.existsSync(envExamplePath), ".env.example debe existir en la raíz del repo")
  const envExampleLines = fs.readFileSync(envExamplePath, "utf-8").split(/\r?\n/)
  assert(
    envExampleLines.includes('DATABASE_URL="file:./dev.db"'),
    '.env.example debe contener la línea DATABASE_URL="file:./dev.db"'
  )
  logStep(".env.example es versionable y define DATABASE_URL")

  console.log("\nSUCCESS: el repo no versiona datos ni secretos.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
