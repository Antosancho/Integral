# Plan — Empaquetado de Integral con Electron Forge (v8 + Vite + Squirrel)

> **Para quién es este plan:** un agente de IA que lo va a ejecutar paso a paso. Seguí las fases **en orden**. No saltees verificaciones. Cada paso es chico a propósito: hacé uno, verificá, seguí. Si un paso falla y la causa no es obvia, consultá la sección **"Troubleshooting"** al final antes de improvisar.
>
> **Reglas generales para el ejecutor:**
> - No modifiques archivos que este plan no menciona (salvo para arreglar un error que el plan anticipa).
> - **No toques** `CLAUDE.md` hasta la Fase 13, ni `backend/prisma/dev.db` nunca (tiene datos del negocio).
> - El working tree arranca con `CONTEXT.md` y `ENTREGA.md` borrados y `CLAUDE.md` sin trackear: **es intencional, no lo "arregles"**.
> - Versiones **exactas** (sin `^` ni `~`) para todo lo que se instala en este plan.
> - Commits: proponé un commit al final de cada fase, pero hacelo solo si el usuario lo autoriza.
> - Todos los comandos se corren desde la raíz del repo: `H:\anton\Proyectos\Integral`.
> - Las Fases 1 a 11 dejan el empaquetado **funcionando**. Las Fases 11A, 11B y 11C agregan las **capas de protección** (bytecode, ofuscación, licencia) sobre algo que ya anda: no las adelantes.
> - Nunca cambies la visibilidad del repo de GitHub ni ninguna configuración remota: eso lo hace el usuario (Fase P).

---

## 0. Resumen del problema y decisiones tomadas

### Estado actual (relevado)

| Aspecto | Hoy | Problema para empaquetar |
|---|---|---|
| Main/preload | `tsc` → `dist/electron/*.js`; `package.json#main = dist/electron/main.js` | Forge+Vite necesita `main` apuntando a `.vite/build/main.cjs` |
| Carga del renderer | `mainWindow.loadURL("http://localhost:5173")` **siempre** | En producción no hay dev server → pantalla en blanco |
| Preload | `path.join(__dirname, "preload.js")`, `sandbox: false` | En Forge v8 el preload sale como `preload.cjs`; conviene `sandbox: true` |
| Renderer | workspace npm `renderer/` con Vite 7.3.2 + React 19 (sin router) | Hay que decirle a Forge que el root del renderer es `renderer/` |
| Prisma 5.22 | motor nativo `node_modules/.prisma/client/query_engine-windows.dll.node` | No se puede bundlear ni cargar desde dentro del `.asar` |
| Migraciones en prod | **no existen** (CLAUDE.md lo marca como pendiente) | La app instalada arrancaría con una DB sin tablas |
| DB en prod | `setupEnv.ts` ya resuelve `<userData>/integral.db` cuando `app.isPackaged` | OK, se reutiliza |
| `dist/` | **versionado en git** (60 archivos) | Queda obsoleto; se saca del repo |
| Entorno de la terminal | `ELECTRON_RUN_AS_NODE=1` seteado (heredado de VS Code) | `npm start` lanzaría Electron como Node → no abre ventana |
| Node | v22.17.1 | OK para Forge v8 (requiere ≥ 22.13) |

### Decisiones (confirmadas con el usuario)

1. **Forge v8.0.1 + plugin de Vite.** Main y preload se bundlean y minifican con Vite. Esto también ayuda al requisito de "no exponer el código fuente": dentro del paquete solo va JS bundleado/minificado, sin `.ts`, sin `.map` y sin carpetas `backend/` ni `electron/`.
2. **Prisma como "runtime external".** `@prisma/client` y `.prisma/client` no se bundlean: un hook de Forge (`packageAfterPrune`) los copia a `node_modules` dentro del paquete. El `.node` del motor se desempaqueta del asar (`asar.unpack: "*.node"`) y `setupEnv.ts` setea `PRISMA_QUERY_ENGINE_LIBRARY` apuntando a `app.asar.unpacked`.
3. **Migrador propio** (`backend/db/migrator.ts`). Al iniciar la app, aplica los `migration.sql` pendientes (que viajan en el instalador como `resources/migrations/`) y los registra en `_prisma_migrations` con **el mismo formato que Prisma CLI**. Así es compatible con una `dev.db` ya migrada por `prisma migrate deploy` y el CLI de Prisma sigue funcionando sobre una DB migrada por la app. Antes de aplicar migraciones sobre una DB con datos, hace backup con `VACUUM INTO`.
4. **Datos del cliente actual:** copia manual documentada de `backend\prisma\dev.db` a `%APPDATA%\Integral\integral.db` (Fase 13).
5. **Instalador:** solo **Squirrel.Windows** (`Setup.exe`, por usuario, sin admin).
6. **Ícono y firma:** no hay por ahora. El ícono se toma de `assets/icons/icon.ico` **solo si existe**. La firma se activa **solo** si está definida la variable de entorno `WINDOWS_CERTIFICATE_FILE`.
7. **Seguridad:** `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, CSP en el HTML de producción, navegación y ventanas nuevas bloqueadas, fuses de Electron activados, una sola instancia de la app (SQLite no se lleva bien con dos procesos escribiendo).
8. **Protección del código — main process en bytecode de V8 (Fase 11A).** Toda la lógica de negocio (repositorios, ventas, estadísticas, migrador) corre en el main. Al empaquetar, `main.cjs` se compila a `main.jsc` con **bytenode 1.7.0**, usando **el mismo binario de Electron** del proyecto (el bytecode solo sirve para la versión exacta de V8 con la que se generó), y `main.cjs` se reemplaza por un cargador de 3 líneas. En desarrollo (`npm start`) no hay bytecode. El preload **no** se compila: corre en sandbox (no puede cargar `.jsc`) y solo tiene nombres de canales IPC.
9. **Protección del código — renderer ofuscado (Fase 11B).** Plugin de Vite propio, solo en build, con `javascript-obfuscator 5.9.0` y `target: "browser-no-eval"` (compatible con la CSP). React y demás librerías van a un chunk `vendor` que **no** se ofusca (no aporta nada y empeora el rendimiento).
10. **Licencia de uso (EULA) (Fase 11C).** Squirrel no muestra pantallas durante la instalación, así que la licencia se acepta **en la app**, en el primer arranque, con un diálogo nativo ("Acepto" / "No acepto"). La aceptación se guarda en `%APPDATA%\Integral\license-accepted.json` con la versión de la licencia: si el texto cambia y se sube `LICENSE_VERSION`, se vuelve a pedir. El texto vive en `LICENSE.txt` (raíz) y viaja como `resources/LICENSE.txt`. **Es un borrador: lo tiene que revisar un abogado antes de distribuir.**
11. **Repo de GitHub público (Fase P).** Verificado: `https://api.github.com/repos/Antosancho/Integral` responde 200 sin autenticación. Mientras siga público, cualquiera puede leer el código completo con comentarios, y las fases de protección pierden sentido. Hacerlo privado es una acción **del usuario**.

> **Límite de la protección (dejarlo claro en el reporte final):** nada que corra en la máquina del cliente es 100% inextraíble. Con estas capas, extraer el `app.asar` ya no da código legible del main (solo bytecode y textos sueltos) y el renderer queda ofuscado. Siguen visibles `schema.prisma`, los `migration.sql`, el preload y la base `integral.db` (SQLite). La protección real frente a un cliente es la licencia + el contrato.

### Hechos verificados en los que se apoya el migrador (no los re-investigues)

- La tabla `_prisma_migrations` en SQLite tiene exactamente este DDL (copiado de `dev.db`):
  ```sql
  CREATE TABLE "_prisma_migrations" (
      "id"                    TEXT PRIMARY KEY NOT NULL,
      "checksum"              TEXT NOT NULL,
      "finished_at"           DATETIME,
      "migration_name"        TEXT NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        DATETIME,
      "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
  )
  ```
- `started_at` y `finished_at` se guardan como **INTEGER = epoch en milisegundos** (`typeof(...) = 'integer'`). Hay que guardar `Date.now()`, **no** un `Date` ni un string.
- `checksum` = `sha256(bytes crudos del migration.sql)` en hex, **incluyendo el BOM** si lo hay. Verificado: `20260210182056_init_stock_schema` → `704d76ae990e6a2829952f13344c050cc1aac831f5e88bf76164caf2e08e85a5`.
- `20260213143709_barcode_to_bigint/migration.sql` **empieza con BOM UTF-8** (`\uFEFF`). El splitter de SQL lo tiene que quitar antes de ejecutar (pero el checksum se calcula sobre los bytes originales).
- Varias migraciones usan `PRAGMA foreign_keys=OFF` y `DROP TABLE` de tablas con hijos en `ON DELETE CASCADE` (por ejemplo `Sale` → `SaleItem`). `PRAGMA foreign_keys` es **por conexión**: si las sentencias corren en conexiones distintas del pool, el `DROP TABLE "Sale"` borra en cascada los `SaleItem` (**pérdida de datos**). Por eso el migrador usa **`connection_limit=1`** y **no** envuelve las sentencias en una transacción (dentro de una transacción `PRAGMA foreign_keys` no tiene efecto).
- `$executeRawUnsafe` de Prisma sobre SQLite ejecuta **una sola sentencia por llamada** → hay que dividir cada `migration.sql` en sentencias.
- Cantidad de sentencias esperada por migración (cada `;` cierra una sentencia y ninguna aparece dentro de comentarios o strings): `init_stock_schema` 10, `change_barcode_to_int` 12, `barcode_to_bigint` 12, `add_applied_delta_to_stock_movement` 1, `add_sales` 17, `add_sale_discount_pct` 9, `allow_null_product_in_sale_item` 10, `add_purchase_price_snapshot` 1, `add_expiry_to_stock_movement` 3.
- `@prisma/client@5.22.0` **no tiene `dependencies`** en runtime: copiar `node_modules/@prisma/client` + `node_modules/.prisma/client` alcanza.
- Vite instalado (hoisted en la raíz): `7.3.2`. `@vitejs/plugin-react`: `5.2.0`. `@electron-forge/plugin-vite@8.0.1` **no** trae Vite como dependencia: usa el del proyecto.
- Versiones a instalar (verificadas en npm): `@electron-forge/*` `8.0.1`, `@electron/fuses` `2.1.3`, `@electron/asar` `4.3.1`, `electron-squirrel-startup` `1.0.1`.
- `window.api.listCategories()` existe (`electron/ipcContract.ts:205`, canal `category:list`) y devuelve un array.

### Arquitectura final

```
DESARROLLO (npm start = electron-forge start)
  electron/main.ts    ──Vite──► .vite/build/main.cjs      (package.json#main)
  electron/preload.ts ──Vite──► .vite/build/preload.cjs
  renderer/ (root)    ──Vite dev server──► MAIN_WINDOW_VITE_DEV_SERVER_URL
  DB: backend/prisma/dev.db · migraciones: backend/prisma/migrations

PRODUCCIÓN (npm run make)
  out/Integral-win32-x64/
    Integral.exe
    resources/
      app.asar                → package.json,
                                .vite/build/main.cjs (cargador) + main.jsc (bytecode, Fase 11A) + preload.cjs,
                                .vite/renderer/main_window/** (app ofuscada + vendor, Fase 11B),
                                node_modules/@prisma/client/**, node_modules/.prisma/client/**, node_modules/bytenode/**
      app.asar.unpacked/node_modules/.prisma/client/query_engine-windows.dll.node
      migrations/<timestamp_nombre>/migration.sql   (extraResource)
      LICENSE.txt                                   (extraResource, Fase 11C)
  out/make/squirrel.windows/x64/Integral-1.0.0 Setup.exe  (+ RELEASES, *.nupkg)
  DB: %APPDATA%\Integral\integral.db  · backups: %APPDATA%\Integral\integral.db.backup-<fecha>
```

### Archivos que se crean / modifican / borran

| Acción | Archivo |
|---|---|
| Crear | `backend/db/migrator.ts`, `backend/__tests__/migrator.test.ts` |
| Crear | `electron/runtimePaths.ts`, `backend/__tests__/runtime-paths.test.ts` |
| Crear | `electron/forge-env.d.ts`, `electron/smoke.ts` |
| Crear | `forge.config.mts`, `vite.main.config.mts`, `vite.preload.config.mts`, `vite.renderer.config.mts` |
| Crear | `scripts/verify-package.mjs`, `scripts/smoke-packaged.mjs` |
| Crear | `backend/__tests__/packaging-config.test.ts` |
| Crear | `assets/icons/README.md`, `INSTALACION.md` |
| Crear (11A) | `scripts/bytecode/compile-main.cjs` |
| Crear (11C) | `LICENSE.txt`, `electron/license.ts`, `backend/__tests__/license.test.ts` |
| Modificar (11A–11C) | `forge.config.mts`, `vite.renderer.config.mts`, `electron/main.ts`, `electron/smoke.ts`, `electron/runtimePaths.ts`, `scripts/verify-package.mjs`, `scripts/smoke-packaged.mjs`, `backend/__tests__/packaging-config.test.ts`, `backend/__tests__/runtime-paths.test.ts` |
| Modificar | `electron/main.ts`, `electron/setupEnv.ts`, `renderer/index.html`, `renderer/package.json` |
| Modificar | `package.json`, `.gitignore`, `backend/__tests__/db-path-config.test.ts`, `CLAUDE.md` |
| Borrar | `scripts/dev.js`, carpeta `dist/` (y sacarla del índice de git) |

---

## Fase P — Repo de GitHub privado (acción del USUARIO, no del agente)

**P.1** Comprobá la visibilidad (es solo una lectura pública, no necesita credenciales):
```
curl -s -o /dev/null -w "%{http_code}\n" https://api.github.com/repos/Antosancho/Integral
```
- `200` → el repo es **público**. Avisale al usuario, con este texto: *"El repo Antosancho/Integral es público: cualquiera puede leer el código fuente completo. Hacelo privado en GitHub → Settings → General → Danger Zone → Change repository visibility → Private."* **No lo cambies vos.** Seguí con el plan (el trabajo local no depende de esto) y volvé a comprobar en la Fase 14.
- `404` → ya es privado (o no existe). Seguí.

**P.2** En el reporte final aclará que hacerlo privado **no recupera** las copias o forks que alguien haya hecho mientras estuvo público.

---

## Fase 0 — Línea base (no modifica nada)

**0.1** Confirmá que estás en la raíz: `git rev-parse --show-toplevel` → tiene que terminar en `Integral`.

**0.2** Creá una rama: `git switch -c feat/electron-forge-packaging`.

**0.3** Corré la suite actual y **anotá el resultado** en un archivo temporal de tu scratchpad (no en el repo):
```
npm run test:backend
npm test --workspace renderer
```
Si algo ya falla **antes** de tocar nada, anotalo como "falla preexistente" y no lo arregles en este plan. Al final, las mismas pruebas tienen que dar el mismo resultado o mejor.

**0.4** Verificá la variable de entorno peligrosa:
- Bash: `printenv ELECTRON_RUN_AS_NODE`
- PowerShell: `$env:ELECTRON_RUN_AS_NODE`

Si imprime `1`, **cada vez** que lances Electron a mano (Fase 9) tenés que hacerlo sin ella (`env -u ELECTRON_RUN_AS_NODE npm start` en Bash, o `Remove-Item Env:ELECTRON_RUN_AS_NODE` antes, en PowerShell). Los scripts de smoke de este plan ya la manejan solos.

---

## Fase 1 — Migrador propio (`backend/db/migrator.ts`) con TDD

> Esta fase es 100% backend y no depende de Forge. Se hace primero porque es la pieza de mayor riesgo para los datos del cliente.

### 1.1 Crear el archivo con la API pública (stubs)

Creá `backend/db/migrator.ts`. Estilo: el mismo del resto de `backend/` (comillas dobles, sin punto y coma, comentarios en español). Exportá **exactamente** esta API:

```ts
import { PrismaClient } from "@prisma/client"

export type MigrationFile = { name: string; sql: string; checksum: string }
export type MigrationLogger = { info(message: string): void; warn(message: string): void }
export type RunMigrationsOptions = {
  databaseUrl: string          // "file:<ruta ABSOLUTA>" (lo que deja setupEnv en process.env.DATABASE_URL)
  migrationsDir: string        // carpeta con subcarpetas <timestamp_nombre>/migration.sql
  logger?: MigrationLogger     // default: console
  now?: () => number           // default: Date.now (inyectable para tests)
}
export type RunMigrationsResult = {
  applied: string[]            // nombres de migraciones aplicadas en ESTA corrida, en orden
  backupPath: string | null    // ruta del backup si se hizo, si no null
  dbCreated: boolean           // true si el archivo no existía o estaba vacío (0 bytes)
}
export type MigrationErrorCode = "NO_MIGRATIONS" | "FAILED_PREVIOUS" | "UNKNOWN_APPLIED" | "APPLY_FAILED" | "INVALID_URL"
export class MigrationError extends Error {
  constructor(public readonly code: MigrationErrorCode, message: string) { super(message); this.name = "MigrationError" }
}

export function splitSqlStatements(sql: string): string[]
export function sqliteFilePathFromUrl(databaseUrl: string): string
export function withSingleConnection(databaseUrl: string): string
export function readMigrations(migrationsDir: string): MigrationFile[]
export async function runMigrations(options: RunMigrationsOptions): Promise<RunMigrationsResult>
```

El archivo **no** importa nada de `electron` (tiene que poder correr con `ts-node`).

### 1.2 Escribir los tests ANTES de implementar

Creá `backend/__tests__/migrator.test.ts` siguiendo el patrón de los tests existentes (por ejemplo `testDb-helper.test.ts`): script plano con `assert(...)`, `console.log("  PASS: ...")`, `main().catch(e => { console.error(e); process.exit(1) })`. Usá `createMigratedTestDb` de `./helpers/testDb` cuando necesites una DB creada por el **CLI** de Prisma.

Para las DBs que crea el migrador usá una carpeta temporal: `fs.mkdtempSync(path.join(os.tmpdir(), "integral-migrator-"))`, y armá la URL como `` `file:${dbPath.replace(/\\/g, "/")}` ``. Siempre hacé `$disconnect()` **antes** de borrar archivos (en Windows da `EBUSY`). La limpieza va en `finally`.

Las migraciones reales están en `path.join(repoRoot, "backend", "prisma", "migrations")`.

**Casos (cada uno es un bloque con su `PASS`):**

**Grupo A — `splitSqlStatements` (puro):**
- A1: `"\uFEFFCREATE TABLE a (x INT);"` → `["CREATE TABLE a (x INT)"]` (quita el BOM y el `;` final).
- A2: `"-- comentario; con punto y coma\nSELECT 1;"` → `["SELECT 1"]`.
- A3: `"/* a; b */ SELECT 1; SELECT 2"` → `["SELECT 1", "SELECT 2"]` (la última sentencia no tiene `;`).
- A4: `"INSERT INTO t VALUES ('a;b'); SELECT 1;"` → 2 sentencias; la primera es exactamente `"INSERT INTO t VALUES ('a;b')"`.
- A5: `"INSERT INTO t VALUES ('it''s;');"` → 1 sentencia (comilla simple escapada duplicándola).
- A6: `'CREATE TABLE "we;ird" (x INT);'` → 1 sentencia (identificador entre comillas dobles).
- A7: `"   \n -- solo comentario\n"` → `[]`.
- A8: para cada migración real, la cantidad de sentencias coincide con la tabla de la sección 0 ("Cantidad de sentencias esperada"). Si algún número no coincide, **contá a mano** las sentencias de ese archivo antes de tocar el test o la implementación.

**Grupo B — helpers de URL (puros):**
- B1: `sqliteFilePathFromUrl("file:C:/x/y.db")` → `"C:/x/y.db"`; `sqliteFilePathFromUrl("file:C:/x/y.db?connection_limit=5")` → `"C:/x/y.db"`.
- B2: `sqliteFilePathFromUrl("file:./dev.db")` lanza `MigrationError` con `code === "INVALID_URL"` (las rutas relativas son ambiguas con Prisma; la app siempre pasa rutas absolutas). Igual con `"postgres://..."`.
- B3: `withSingleConnection("file:C:/a.db")` → `"file:C:/a.db?connection_limit=1"`; `withSingleConnection("file:C:/a.db?foo=1")` → `"file:C:/a.db?foo=1&connection_limit=1"`.

**Grupo C — `readMigrations`:**
- C1: con la carpeta real devuelve 9 elementos ordenados por nombre ascendente; ignora `migration_lock.toml`; el `checksum` de `20260210182056_init_stock_schema` es `704d76ae990e6a2829952f13344c050cc1aac831f5e88bf76164caf2e08e85a5`.
- C2: carpeta inexistente → devuelve `[]` (no lanza; quien decide lanzar es `runMigrations`).

**Grupo D — `runMigrations` sobre DB nueva:**
- D1: ruta de DB que **no existe** → `applied.length === 9`, `dbCreated === true`, `backupPath === null`, y el archivo existe.
- D2: **mismo schema que el CLI**. Creá otra DB con `createMigratedTestDb("migrator-ref")` y compará en ambas:
  `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY type, name`
  → las dos listas tienen que ser **idénticas** (comparalas con `JSON.stringify`).
- D3: **mismos checksums que el CLI**: por cada `migration_name`, `checksum` igual en ambas DBs.
- D4: `SELECT typeof(started_at) AS ts, typeof(finished_at) AS tf, applied_steps_count FROM _prisma_migrations` → todas las filas tienen `ts === "integer"`, `tf === "integer"` y `applied_steps_count == 1` (ojo: Prisma devuelve `bigint` → compará con `Number(...)`).
- D5: **idempotencia**: segunda corrida sobre la misma DB → `applied.length === 0`, `dbCreated === false`, `backupPath === null`.

**Grupo E — compatibilidad con el CLI de Prisma (es el caso "el cliente copia su dev.db"):**
- E1: sobre una DB de `createMigratedTestDb("migrator-cli")` → `runMigrations` devuelve `applied.length === 0` y `backupPath === null`.
- E2: sobre la DB creada en D1, corré con `spawnSync` (`shell: true`, `cwd: repoRoot`, `env: { ...process.env, DATABASE_URL: url }`):
  `npx prisma migrate status --schema backend/prisma/schema.prisma` → `status === 0` y el stdout contiene `Database schema is up to date`.
- E3: idem con `npx prisma migrate deploy --schema backend/prisma/schema.prisma` → `status === 0` y el stdout contiene `No pending migrations to apply`.

**Grupo F — migración parcial con datos (el test más importante: detecta pérdida de datos por FK/PRAGMA):**
- F1: creá una carpeta temporal de migraciones y copiá **solo las 5 primeras** (hasta `20260419180243_add_sales` inclusive). Corré `runMigrations` → `applied.length === 5`.
- F2: insertá datos con `$executeRawUnsafe` (Prisma Client tipado no sirve: el schema actual tiene columnas que todavía no existen):
  - 1 `Category`, 1 `Supplier`, 1 `Product` (con `barcode` `7790001000011`), 1 `Sale` (`total` 100), 2 `SaleItem` de esa venta, 1 `SalePayment`, 1 `StockMovement` tipo `SALE` con `saleId` = id de la venta.
- F3: copiá las 4 migraciones restantes a la carpeta temporal y corré `runMigrations` → `applied` es exactamente la lista de esos 4 nombres, en orden.
- F4: **datos intactos**: `SaleItem` sigue con 2 filas, `SalePayment` con 1, `StockMovement.saleId` **no es NULL**, el `barcode` del producto sigue igual, y `Sale.discountPct` es `0` (default de la migración).
- F5: `PRAGMA foreign_key_check` → devuelve 0 filas (`$queryRawUnsafe`).
- F6: **backup**: `backupPath` no es `null`, el archivo existe, su nombre empieza con `<nombre de la db>.backup-`, y abierto con otro `PrismaClient` tiene 2 `SaleItem` y solo 5 filas en `_prisma_migrations` (es el estado **anterior** a migrar).

**Grupo G — errores:**
- G1: carpeta de migraciones vacía → rechaza con `MigrationError` `code === "NO_MIGRATIONS"`.
- G2: carpeta temporal con las 9 migraciones reales + `99999999999999_broken/migration.sql` con contenido `CREATE TABLE "Rota" (;` → rechaza con `code === "APPLY_FAILED"`; el mensaje contiene `99999999999999_broken`. En `_prisma_migrations` existe la fila de `99999999999999_broken` con `finished_at IS NULL` y `logs` no vacío.
- G3: volver a correr sobre esa misma DB (aunque se arregle el SQL) → rechaza con `code === "FAILED_PREVIOUS"` **sin** intentar aplicar nada.
- G4: DB migrada completa + `INSERT` manual en `_prisma_migrations` de una fila terminada con nombre `99999999999999_desde_version_nueva` → rechaza con `code === "UNKNOWN_APPLIED"`.
- G5: **checksum distinto** (modificaste un `migration.sql` ya aplicado, por ejemplo agregándole un comentario al final en la carpeta temporal) → **no** rechaza, `applied.length === 0`, y el `logger.warn` (inyectá un logger que acumule mensajes en un array) recibió al menos un mensaje que contiene el nombre de esa migración.

Registrá el script en `package.json`:
```json
"test:migrator": "npx ts-node backend/__tests__/migrator.test.ts"
```
Corrélo → **tiene que fallar** (todavía no hay implementación). Así confirmás que el test realmente prueba algo.

### 1.3 Implementar `splitSqlStatements`

Máquina de estados que recorre carácter por carácter:
- Si el primer carácter es `\uFEFF`, se descarta.
- Estados: `normal`, `comillaSimple`, `comillaDoble`, `comentarioLinea`, `comentarioBloque`.
- En `normal`: `--` → `comentarioLinea` (no se copia); `/*` → `comentarioBloque` (no se copia); `'` → `comillaSimple` (se copia); `"` → `comillaDoble` (se copia); `;` → se cierra la sentencia actual (se hace `trim()` y se agrega si no queda vacía; el `;` **no** se incluye).
- En `comillaSimple`: `''` (dos seguidas) se copia y se sigue en el mismo estado; una sola `'` cierra. Lo mismo con `"` en `comillaDoble`.
- `comentarioLinea` termina en `\n` (el `\n` sí se copia, como separador). `comentarioBloque` termina en `*/`.
- Al final, si queda texto con `trim()` no vacío, se agrega como última sentencia.

Corré `npm run test:migrator`: el grupo A tiene que pasar.

### 1.4 Implementar `sqliteFilePathFromUrl`, `withSingleConnection` y `readMigrations`

- `sqliteFilePathFromUrl`: exige el prefijo `file:`; saca el prefijo y todo lo que viene desde `?`; exige `path.isAbsolute(ruta)`; si no se cumple, lanza `MigrationError("INVALID_URL", ...)`.
- `withSingleConnection`: agrega `connection_limit=1` con `?` o `&` según si la URL ya tiene query.
- `readMigrations`: si la carpeta no existe → `[]`. Lista subcarpetas (`withFileTypes`, solo directorios) que contengan `migration.sql`, ordenadas con `.sort()` (el nombre empieza con timestamp). Por cada una: `buffer = fs.readFileSync(...)`, `checksum = crypto.createHash("sha256").update(buffer).digest("hex")`, `sql = buffer.toString("utf-8")`.

Grupos B y C en verde.

### 1.5 Implementar `runMigrations` (algoritmo exacto)

```
1. migrations = readMigrations(migrationsDir)
   si migrations.length === 0 → throw MigrationError("NO_MIGRATIONS", `No se encontraron migraciones en ${migrationsDir}`)
2. dbPath = sqliteFilePathFromUrl(databaseUrl)
   fs.mkdirSync(path.dirname(dbPath), { recursive: true })
   dbCreated = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0
   si !fs.existsSync(dbPath) → fs.writeFileSync(dbPath, "")      // un archivo de 0 bytes es una DB SQLite válida
3. prisma = new PrismaClient({ datasources: { db: { url: withSingleConnection(databaseUrl) } } })
4. try {
   a. await prisma.$executeRawUnsafe(<DDL de _prisma_migrations de la sección 0, con CREATE TABLE IF NOT EXISTS>)
   b. rows = await prisma.$queryRawUnsafe<Row[]>(
        'SELECT "id", "migration_name", "checksum", "finished_at", "rolled_back_at" FROM "_prisma_migrations"')
   c. failed = rows con finished_at == null && rolled_back_at == null
      si hay → throw MigrationError("FAILED_PREVIOUS",
        `Una actualización anterior de la base de datos quedó incompleta (${nombres}). ` +
        `Restaurá el backup más reciente (${dbPath}.backup-*) o contactá a soporte.`)
   d. applied = rows con finished_at != null && rolled_back_at == null → Map nombre → checksum
   e. desconocidas = nombres de applied que no están en migrations
      si hay → throw MigrationError("UNKNOWN_APPLIED",
        `La base de datos fue actualizada por una versión más nueva de Integral (${nombres}). Instalá la versión más reciente.`)
   f. por cada migración aplicada cuyo checksum difiere → logger.warn(`[migrator] checksum distinto en ${name} (ya aplicada; no se re-aplica)`)
   g. pending = migrations.filter(m => !applied.has(m.name))
      si pending.length === 0 → logger.info("[migrator] base de datos al día") y return { applied: [], backupPath: null, dbCreated }
   h. backupPath = null
      si applied.size > 0:
        backupPath = `${dbPath}.backup-${AAAAMMDD-HHmmss de now()}`   // hora local, con ceros a la izquierda
        await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/\\/g, "/").replace(/'/g, "''")}'`)
        logger.info(`[migrator] backup creado en ${backupPath}`)
   i. por cada m de pending (en orden):
        id = crypto.randomUUID()
        await prisma.$executeRaw`INSERT INTO "_prisma_migrations" ("id","checksum","migration_name","started_at","applied_steps_count")
                                 VALUES (${id}, ${m.checksum}, ${m.name}, ${now()}, 0)`
        try {
          for (const stmt of splitSqlStatements(m.sql)) await prisma.$executeRawUnsafe(stmt)
        } catch (error) {
          await prisma.$executeRaw`UPDATE "_prisma_migrations" SET "logs" = ${String(error)} WHERE "id" = ${id}`
          throw new MigrationError("APPLY_FAILED",
            `Falló la migración ${m.name}: ${mensaje del error}.` + (backupPath ? ` Backup previo: ${backupPath}` : ""))
        }
        await prisma.$executeRaw`UPDATE "_prisma_migrations" SET "finished_at" = ${now()}, "applied_steps_count" = 1 WHERE "id" = ${id}`
        aplicadasEnEstaCorrida.push(m.name)
   j. logger.info(`[migrator] ${n} migración(es) aplicada(s)`)
   k. return { applied: aplicadasEnEstaCorrida, backupPath, dbCreated }
   } finally { await prisma.$disconnect() }
```

**Importante (no lo cambies):**
- **Nunca** envuelvas las sentencias en `$transaction` (rompe los `PRAGMA foreign_keys=OFF`).
- `connection_limit=1` es obligatorio (ver la sección 0).
- `now()` devuelve un número (ms). Pasá **números** a `started_at`/`finished_at` (test D4).
- El migrador crea **su propio** `PrismaClient` y lo desconecta. No uses el singleton `backend/db/client.ts`.

Corré `npm run test:migrator` → **todos** los grupos (A a G) en verde.

### 1.6 Sumarlo a la suite

En `package.json`, agregá `&& npm run test:migrator` al final del script `test:backend`. Corré `npm run test:backend` completo → mismo resultado que la línea base + migrador en verde.

**Checkpoint:** proponer el commit `feat(db): migrador propio compatible con _prisma_migrations`.

---

## Fase 2 — Rutas de runtime (`electron/runtimePaths.ts`)

Funciones **puras** (sin `import ... from "electron"`) para poder testearlas con ts-node.

**2.1** Creá `electron/runtimePaths.ts`:
```ts
import fs from "fs"
import path from "path"

export type RuntimeLocation = { isPackaged: boolean; resourcesPath: string; dirname: string }

/** Carpeta de migration.sql: en prod viaja como extraResource; en dev es la del repo. */
export function resolveMigrationsDir(loc: RuntimeLocation): string {
  return loc.isPackaged
    ? path.join(loc.resourcesPath, "migrations")
    // dirname en dev = <repo>/.vite/build → sube 2 niveles hasta la raíz
    : path.join(loc.dirname, "..", "..", "backend", "prisma", "migrations")
}

/** Ruta del motor de Prisma desempaquetado del asar, o null si no está. */
export function findQueryEngineLibrary(resourcesPath: string): string | null {
  const dir = path.join(resourcesPath, "app.asar.unpacked", "node_modules", ".prisma", "client")
  if (!fs.existsSync(dir)) return null
  const file = fs.readdirSync(dir).find((name) => /query_engine.*\.node$/.test(name))
  return file ? path.join(dir, file) : null
}
```

**2.2** Creá `backend/__tests__/runtime-paths.test.ts` (mismo patrón de script con `assert`):
- `resolveMigrationsDir({ isPackaged: true, resourcesPath: "C:\\App\\resources", dirname: "x" })` → `path.join("C:\\App\\resources", "migrations")`.
- `resolveMigrationsDir({ isPackaged: false, resourcesPath: "x", dirname: path.join(repoRoot, ".vite", "build") })` → `path.join(repoRoot, "backend", "prisma", "migrations")`, y **esa carpeta existe**.
- `findQueryEngineLibrary`: carpeta temporal sin `app.asar.unpacked` → `null`; con `app.asar.unpacked/node_modules/.prisma/client/query_engine-windows.dll.node` (archivo vacío) → devuelve esa ruta; con solo `index.js` adentro → `null`.

**2.3** Registrá `"test:runtime-paths": "npx ts-node backend/__tests__/runtime-paths.test.ts"`, agregalo a `test:backend` y corrélo → verde.

---

## Fase 3 — Dependencias

**3.1** Instalá las herramientas de build (todas exactas, todas dev):
```
npm install --save-dev --save-exact @electron-forge/cli@8.0.1 @electron-forge/plugin-vite@8.0.1 @electron-forge/maker-squirrel@8.0.1 @electron-forge/plugin-fuses@8.0.1 @electron-forge/shared-types@8.0.1 @electron/fuses@2.1.3 @electron/asar@4.3.1 electron-squirrel-startup@1.0.1 vite@7.3.2 @vitejs/plugin-react@5.2.0
```
- `electron-squirrel-startup` va en **dev** a propósito: Vite lo bundlea dentro de `main.cjs`. En `dependencies` solo van los externals de runtime (Prisma).
- `vite`/`@vitejs/plugin-react` en la raíz con **la misma versión** que usa `renderer/`, para que haya una sola copia.

**3.2** Mové `prisma` (el CLI) a devDependencies; en runtime solo se usa `@prisma/client`:
```
npm uninstall prisma
npm install --save-dev --save-exact prisma@5.22.0
```

**3.3** Verificaciones:
- `npm ls @electron-forge/cli @electron-forge/plugin-vite @electron-forge/maker-squirrel @electron-forge/plugin-fuses @electron-forge/shared-types` → todas `8.0.1`.
- `npm ls vite` → **solo** `7.3.2` (puede aparecer `deduped`). Si aparecen dos versiones, frená y revisá.
- En `package.json`, `dependencies` queda **solo** con `"@prisma/client": "5.22.0"`. `electron` sigue en `devDependencies`.
- `node_modules/.prisma/client/query_engine-windows.dll.node` existe (el `postinstall` corrió `prisma generate`).

---

## Fase 4 — Configs de Vite (raíz del repo)

> Los archivos `.mts` son ESM. **No uses `__dirname`** adentro (no existe en ESM). Usá `process.cwd()`: Forge siempre se ejecuta desde la raíz vía scripts npm.

**4.1** `vite.main.config.mts`:
```ts
import { defineConfig } from "vite"
import { builtinModules } from "node:module"

// Prisma NO se bundlea: tiene un motor nativo (.node). Lo copia el hook packageAfterPrune de forge.config.mts.
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: mode === "development",
    minify: mode === "production",
    rollupOptions: {
      external: [
        "electron",
        /^@prisma\/client(\/.*)?$/,
        /^\.prisma\//,
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
  },
}))
```

**4.2** `vite.preload.config.mts`: igual, pero `external: ["electron"]` solamente (el preload corre en sandbox: solo puede usar `electron`).

**4.3** `vite.renderer.config.mts`:
```ts
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

const ROOT = process.cwd()

// CSP solo en build: en dev el preámbulo inline de react-refresh y el websocket de HMR la violarían.
const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ")

function cspPlugin(): Plugin {
  return {
    name: "integral-csp",
    apply: "build",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: PROD_CSP }, injectTo: "head-prepend" }]
    },
  }
}

export default defineConfig({
  root: path.join(ROOT, "renderer"),
  plugins: [react(), cspPlugin()],
  build: {
    // Forge espera el renderer en .vite/renderer/<name>; como cambiamos root, lo fijamos en absoluto.
    outDir: path.join(ROOT, ".vite", "renderer", "main_window"),
    emptyOutDir: true,
    sourcemap: false,
  },
})
```
`main_window` **tiene que coincidir** con el `name` del renderer en `forge.config.mts`.

**4.4** `renderer/vite.config.ts` y `renderer/vitest.config.ts` **no se tocan**: siguen sirviendo para `npm run dev:renderer` y para Vitest.

---

## Fase 5 — `forge.config.mts`

**5.1** Creá `assets/icons/README.md` con este texto: "Colocar acá `icon.ico` (256×256, multi-resolución) para el ícono de la app y del instalador. Si no existe, se usa el ícono por defecto de Electron. No hace falta tocar `forge.config.mts`."

**5.2** Creá `forge.config.mts` en la raíz. Las partes marcadas como **OBLIGATORIO** van tal cual:

```ts
import type { ForgeConfig } from "@electron-forge/shared-types"
import { MakerSquirrel } from "@electron-forge/maker-squirrel"
import { VitePlugin } from "@electron-forge/plugin-vite"
import { FusesPlugin } from "@electron-forge/plugin-fuses"
import { FuseV1Options, FuseVersion } from "@electron/fuses"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
if (!fs.existsSync(path.join(ROOT, "forge.config.mts"))) {
  throw new Error("Ejecutar electron-forge desde la raíz del proyecto")
}

const ICON_BASE = path.join(ROOT, "assets", "icons", "icon") // sin extensión (packager agrega .ico)
const ICON_ICO = `${ICON_BASE}.ico`
const hasIcon = fs.existsSync(ICON_ICO)

// Firma opcional: solo si el entorno define el certificado. Nunca commitear certificados ni contraseñas.
const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD

// OBLIGATORIO: módulos que NO se bundlean y se copian tal cual al paquete.
const RUNTIME_EXTERNALS = [
  path.join("node_modules", "@prisma", "client"),
  path.join("node_modules", ".prisma", "client"),
]

const config: ForgeConfig = {
  packagerConfig: {
    name: "Integral",
    executableName: "Integral",
    asar: { unpack: "*.node" },                                        // OBLIGATORIO: el motor de Prisma no carga desde dentro del asar
    extraResource: [path.join(ROOT, "backend", "prisma", "migrations")], // OBLIGATORIO: → resources/migrations
    ...(hasIcon ? { icon: ICON_BASE } : {}),
    win32metadata: {
      CompanyName: "Antosancho",
      FileDescription: "Integral - Gestión de stock y ventas",
      ProductName: "Integral",
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: "Integral",
      authors: "Antosancho",
      description: "Gestión de stock y ventas",
      noMsi: true,
      ...(hasIcon ? { setupIcon: ICON_ICO } : {}),
      ...(certificateFile ? { certificateFile, certificatePassword } : {}),
    }),
  ],
  hooks: {
    // OBLIGATORIO: copiar Prisma después del prune (si se copia antes, el pruner borra .prisma/).
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      for (const rel of RUNTIME_EXTERNALS) {
        const src = path.join(ROOT, rel)
        const dst = path.join(buildPath, rel)
        if (!fs.existsSync(src)) {
          throw new Error(`Falta ${rel}. Corré "npm install" (genera el cliente de Prisma).`)
        }
        fs.cpSync(src, dst, { recursive: true, dereference: true })
      }
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        { entry: "electron/main.ts", config: "vite.main.config.mts", target: "main" },
        { entry: "electron/preload.ts", config: "vite.preload.config.mts", target: "preload" },
      ],
      renderer: [{ name: "main_window", config: "vite.renderer.config.mts" }],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
```

**No** setees `packagerConfig.ignore`: lo maneja el plugin de Vite (solo empaqueta `.vite/`). Por eso Prisma se copia con el hook.

---

## Fase 6 — Código de Electron

### 6.1 `electron/forge-env.d.ts` (nuevo)
```ts
// Globals que inyecta @electron-forge/plugin-vite en el build del main.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

declare module "electron-squirrel-startup" {
  const started: boolean
  export default started
}
```
Sin `import`/`export` de nivel superior: tiene que ser un script global.

### 6.2 `electron/setupEnv.ts`
- **No cambies** la función `resolveDbPath` ni la línea `return path.join(__dirname, "..", "..", "backend", "prisma", "dev.db")`: `db-path-config.test.ts` la parsea con una regex. Con Vite, `__dirname` en dev es `<repo>/.vite/build`, que está a la misma profundidad que `dist/electron`, así que la ruta sigue siendo correcta.
- Agregá `import { findQueryEngineLibrary } from "./runtimePaths"` y, al final del archivo:
```ts
// En la app empaquetada el motor de Prisma vive en app.asar.unpacked; se lo indicamos explícitamente.
if (app.isPackaged && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const engine = findQueryEngineLibrary(process.resourcesPath)
  if (engine) process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine
}
```

### 6.3 `electron/smoke.ts` (nuevo) — modo de prueba del binario empaquetado

Solo se activa si existe la variable de entorno `INTEGRAL_SMOKE_RESULT` (ruta de un archivo JSON). Exportá:
```ts
export type SmokeResult = {
  ok: boolean
  stage: "migrations" | "load" | "checks" | "timeout" | "done"
  error?: string
  migrationsApplied?: number
  dbCreated?: boolean
  apiType?: string
  rootChildren?: number
  categoriesDirect?: number
  categoriesViaIpc?: number
  isPackaged: boolean
  userDataPath: string
}
export function writeSmokeResultAndExit(resultPath: string, partial: Omit<SmokeResult, "isPackaged" | "userDataPath">): void
export function runSmokeChecks(win: BrowserWindow, migration: RunMigrationsResult, resultPath: string): void
```
- `writeSmokeResultAndExit`: completa `isPackaged: app.isPackaged` y `userDataPath: app.getPath("userData")`, escribe el JSON con `fs.writeFileSync(resultPath, JSON.stringify(result, null, 2))` y llama a `app.exit(result.ok ? 0 : 1)`.
- `runSmokeChecks`:
  1. `setTimeout` de 45 s → `{ ok: false, stage: "timeout" }`.
  2. `win.webContents.once("did-fail-load", (_e, code, desc) => ... { ok: false, stage: "load", error: \`${code} ${desc}\` })`.
  3. `win.webContents.once("did-finish-load", async () => { ... })` con:
     - `apiType = await win.webContents.executeJavaScript("typeof window.api")`
     - `rootChildren = await win.webContents.executeJavaScript('new Promise(r => setTimeout(() => r(document.getElementById("root")?.childElementCount ?? 0), 1500))')`
     - `categoriesDirect = (await listCategories()).length` (importado de `../backend/repositories`: prueba que el motor de Prisma carga en el paquete)
     - `categoriesViaIpc = await win.webContents.executeJavaScript("window.api.listCategories().then(x => x.length)")` (prueba IPC de punta a punta)
     - `ok = apiType === "object" && rootChildren > 0 && categoriesDirect === categoriesViaIpc`
     - incluí `migrationsApplied: migration.applied.length` y `dbCreated: migration.dbCreated`, `stage: "done"`.
     - cualquier excepción → `{ ok: false, stage: "checks", error: String(e) }`.
  4. Usá un flag `finished` para escribir el resultado **una sola vez**, y `clearTimeout` al terminar.

### 6.4 `electron/main.ts` (reescritura)

Estructura obligatoria (respetá el orden):
```ts
import "./setupEnv"                                    // SIEMPRE el primer import
import started from "electron-squirrel-startup"
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron"
import path from "path"
import { registerIpcHandlers } from "./ipcHandlers"
import { runMigrations, type RunMigrationsResult } from "../backend/db/migrator"
import { resolveMigrationsDir } from "./runtimePaths"
import { runSmokeChecks, writeSmokeResultAndExit } from "./smoke"

const SMOKE_RESULT = process.env.INTEGRAL_SMOKE_RESULT
let mainWindow: BrowserWindow | null = null

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

async function bootstrap() {
  Menu.setApplicationMenu(null)            // se mantiene: F10 no debe abrir el menú nativo
  let migration: RunMigrationsResult
  try {
    migration = await runMigrations({
      databaseUrl: process.env.DATABASE_URL as string,
      migrationsDir: resolveMigrationsDir({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, dirname: __dirname }),
    })
  } catch (error) {
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
```
Nunca vuelvas a escribir `localhost:5173` en el main.

### 6.5 `electron/preload.ts`
No requiere cambios. Confirmá que **solo** importa `electron` y `./ipcContract`, y que `ipcContract.ts` en el nivel superior solo tiene `import type` (así el bundle del preload funciona con `sandbox: true`).

### 6.6 `renderer/index.html`
- Borrá la línea `<link rel="icon" type="image/svg+xml" href="/vite.svg" />` (Electron no usa favicon y las rutas absolutas `/` se rompen con `file://`).
- Cambiá `<title>renderer</title>` por `<title>Integral</title>` y `lang="en"` por `lang="es"`.
- `<script type="module" src="/src/main.tsx">` **se deja igual** (Vite lo reescribe en el build).

### 6.7 Typecheck
- En `renderer/package.json` agregá el script `"typecheck": "tsc -b"`.
- En la raíz: `npx tsc --noEmit` → 0 errores (el `tsconfig.json` raíz ya incluye `electron/**/*.ts`, y por lo tanto `forge-env.d.ts`).
- `npm run typecheck --workspace renderer` → 0 errores.

---

## Fase 7 — `package.json`, `.gitignore` y limpieza

**7.1** En `package.json` (raíz):
- `"main": ".vite/build/main.cjs"`
- Agregá `"productName": "Integral"` (define `%APPDATA%\Integral`).
- `"description": "Gestión de stock y ventas"` y `"author": "Antosancho"` (Squirrel falla si están vacíos).
- Scripts: **borrá** `build` y `dev:electron`. Cambiá/agregá:
```json
"dev": "electron-forge start",
"start": "electron-forge start",
"prepackage": "prisma generate --schema backend/prisma/schema.prisma",
"package": "electron-forge package",
"premake": "prisma generate --schema backend/prisma/schema.prisma",
"make": "electron-forge make",
"typecheck": "tsc --noEmit && npm run typecheck --workspace renderer",
"verify:package": "node scripts/verify-package.mjs",
"verify:make": "node scripts/verify-package.mjs --make",
"test:smoke-packaged": "node scripts/smoke-packaged.mjs",
"test:packaging-config": "npx ts-node backend/__tests__/packaging-config.test.ts"
```
- Agregá `&& npm run test:packaging-config` a `test:backend`.
- `dev:renderer`, los `prisma:*`, `wipe:test-data` y los `test:*` existentes **quedan**.

**7.2** Borrá `scripts/dev.js` (Forge lo reemplaza).

**7.3** `.gitignore`: agregá al final
```
# Build de Electron Forge
out/
.vite/
dist/
```

**7.4** Sacá `dist/` del repo: `git rm -r --cached dist` y después borrá la carpeta del disco. Confirmá con `git ls-files dist` → vacío.

---

## Fase 8 — Tests estáticos de configuración

**8.1** `backend/__tests__/db-path-config.test.ts`: cambiá
```ts
const runtimeDirname = path.join(repoRoot, "dist", "electron")
```
por
```ts
const runtimeDirname = path.join(repoRoot, ".vite", "build")
```
y actualizá el comentario de arriba (`setupEnv.ts se bundlea en .vite/build/main.cjs`). Corré `npm run test:db-path-config` → PASS.

**8.2** Creá `backend/__tests__/packaging-config.test.ts`. Lee archivos como texto/JSON y verifica (un `PASS` por punto):
1. `package.json`: `main === ".vite/build/main.cjs"`, `productName === "Integral"`, `author` y `description` no vacíos.
2. Todas las dependencias `@electron-forge/*` tienen **la misma** versión y es exacta (`/^\d+\.\d+\.\d+$/`).
3. `electron`, `prisma` y `electron-squirrel-startup` están en `devDependencies`. `dependencies` tiene exactamente `["@prisma/client"]`.
4. `electron/main.ts`: contiene `preload.cjs`, `MAIN_WINDOW_VITE_DEV_SERVER_URL`, `MAIN_WINDOW_VITE_NAME`, `sandbox: true`, `electron-squirrel-startup`, `requestSingleInstanceLock`, `runMigrations`, `Menu.setApplicationMenu(null)`; **no** contiene `localhost:5173` ni `sandbox: false`.
5. `electron/main.ts`: la primera línea con `import` es `import "./setupEnv"`.
6. `forge.config.mts`: contiene `extraResource`, `"migrations"`, `unpack: "*.node"`, `packageAfterPrune`, `.prisma`, `@prisma`, `FuseV1Options.RunAsNode]: false`, `OnlyLoadAppFromAsar]: true`, `name: "main_window"`.
7. `vite.renderer.config.mts`: contiene `"main_window"` y `Content-Security-Policy`.
8. `.gitignore` contiene las líneas `out/`, `.vite/` y `dist/`.
9. `scripts/dev.js` **no** existe.

Corré `npm run test:packaging-config` → verde. Corré `npm run test:backend` → todo verde.

---

## Fase 9 — Verificación en desarrollo (manual)

**9.1** Lanzá sin la variable peligrosa: Bash `env -u ELECTRON_RUN_AS_NODE npm start`, o PowerShell `Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; npm start`.

**9.2** Chequeá y anotá cada punto:
- [ ] Se genera `.vite/build/main.cjs` y `.vite/build/preload.cjs`. **Si en cambio se generan `main.js`/`preload.js`**, ajustá `package.json#main`, la ruta del preload en `main.ts` y los tests de la Fase 8 a los nombres reales (ver Troubleshooting T1).
- [ ] En consola aparece `[migrator] base de datos al día` (la `dev.db` ya estaba migrada por el CLI).
- [ ] Abre la ventana en la pantalla Stock y lista los productos de `dev.db`.
- [ ] Ventas: escaneo/búsqueda (F2), ítem general (F10, **no** abre ningún menú), cobro y aprobar venta funcionan.
- [ ] Alerta de vencimientos en el header (si hay datos).
- [ ] HMR: cambiá un texto de `Header.tsx` → la ventana se actualiza sin reiniciar. Revertí el cambio.
- [ ] Con la app abierta, ejecutá `npm start` en otra terminal → no se abre una segunda ventana (se enfoca la existente).
- [ ] `npm run dev:renderer` sigue levantando el renderer suelto en el navegador (sin `window.api`, es lo esperado).

---

## Fase 10 — Empaquetado + verificación estática del paquete

**10.1** `npm run package`. Tiene que terminar sin errores y crear `out/Integral-win32-x64/Integral.exe`.

**10.2** Creá `scripts/verify-package.mjs` (ESM, sin dependencias salvo `@electron/asar` y `@electron/fuses`). Imprime `PASS:`/`FAIL:` por chequeo y sale con código 1 si hubo algún FAIL. Constantes: `ROOT = process.cwd()`, `APP_DIR = out/Integral-win32-x64`, `RES = APP_DIR/resources`, `ASAR = RES/app.asar`.

Listá el asar con `import { listPackage, extractFile } from "@electron/asar"`, y normalizá cada entrada: `\` → `/` y sin `/` inicial.

**Chequeos:**
1. Existen `APP_DIR/Integral.exe` y `ASAR`.
2. El asar **contiene**: `package.json`, `.vite/build/main.cjs`, `.vite/build/preload.cjs`, `.vite/renderer/main_window/index.html`, `node_modules/@prisma/client/package.json`, `node_modules/.prisma/client/index.js`, `node_modules/.prisma/client/schema.prisma`.
3. El asar **no contiene** ninguna entrada que: empiece con `backend/`, `electron/`, `renderer/`, `scripts/`, `src/`, `dist/`; termine en `.map`; termine en `.ts` sin ser `.d.ts`; termine en `.db` o `.db-journal`; o cuyo basename empiece con `.env`. (Requisito de no exponer código fuente ni datos.)
4. Existe un archivo `/query_engine.*\.node$/` en `RES/app.asar.unpacked/node_modules/.prisma/client/`.
5. `RES/migrations/`: mismas subcarpetas que `backend/prisma/migrations/` (sin contar `migration_lock.toml`), y cada `migration.sql` con el **mismo sha256** que el del repo.
6. `JSON.parse(extractFile(ASAR, "package.json"))`: `main === ".vite/build/main.cjs"` y `productName === "Integral"`.
7. `main.cjs` **del build, antes del bytecode**: leé `ROOT/.vite/build/main.cjs` del disco, **no** el del asar (desde la Fase 11A, el del asar es solo un cargador; Vite deja el bundle legible en `.vite/build/` después de `npm run package`):
   - contiene `require("@prisma/client")` (regex `/require\(["']@prisma\/client["']\)/`);
   - **no** contiene `localhost:5173`;
   - **no** contiene `require("electron-squirrel-startup")` (tiene que estar bundleado);
   - la primera aparición de `PRISMA_QUERY_ENGINE_LIBRARY` está **antes** que la primera de `PrismaClient(` (setupEnv corre antes de crear clientes).
8. `preload.cjs`: el conjunto de módulos en `require("...")` es exactamente `{"electron"}`.
9. `index.html` del renderer: contiene `Content-Security-Policy`; no contiene `src="/`, `href="/` ni `localhost`.
10. **Fuses**: `import { getCurrentFuseWire, FuseV1Options, FuseState } from "@electron/fuses"`; `wire = await getCurrentFuseWire(exe)`; `RunAsNode`, `EnableNodeOptionsEnvironmentVariable` y `EnableNodeCliInspectArguments` === `FuseState.DISABLE`; `OnlyLoadAppFromAsar`, `EnableEmbeddedAsarIntegrityValidation` y `EnableCookieEncryption` === `FuseState.ENABLE`.
11. Con el flag `--make` (Fase 12), además: `out/make/squirrel.windows/x64/` contiene un archivo que termina en `Setup.exe`, el archivo `RELEASES` y al menos un `*-full.nupkg`.

**10.3** `npm run verify:package` → todo PASS. Si algo falla, ver Troubleshooting **antes** de tocar código.

---

## Fase 11 — Smoke test del binario empaquetado

**11.1** Creá `scripts/smoke-packaged.mjs` (ESM). Helper `runApp(dbPath, resultPath, extraEnv = {})`:
- `env = { ...process.env, DATABASE_URL: "file:" + dbPath.replace(/\\/g, "/"), INTEGRAL_SMOKE_RESULT: resultPath, ...extraEnv }`, y si `extraEnv` no define `ELECTRON_RUN_AS_NODE`, hacé `delete env.ELECTRON_RUN_AS_NODE`.
- `spawn(exe, [], { env, stdio: "inherit" })` con timeout de 90 s (si vence: `kill` + FAIL "¿hay otra instancia de Integral abierta?").
- Devuelve `{ code, result }`, con `result` = JSON leído de `resultPath` (o `null` si no existe).

**Corridas (todas en una carpeta `fs.mkdtempSync(os.tmpdir() + "/integral-smoke-")`):**
1. **DB nueva**: `smoke.db` inexistente → `code === 0`, `result.ok`, `result.isPackaged === true`, `result.dbCreated === true`, `result.migrationsApplied === <cantidad de carpetas de migración del repo>`, `result.apiType === "object"`, `result.rootChildren > 0`, `path.basename(result.userDataPath).toLowerCase() === "integral"`.
2. **Segunda apertura** (misma DB) → `ok`, `migrationsApplied === 0`, `dbCreated === false`.
3. **DB del cliente (creada por el CLI)**: creá `legacy.db` con `spawnSync("npx prisma migrate deploy --schema backend/prisma/schema.prisma", { shell: true, env: { ...process.env, DATABASE_URL: <url de legacy.db> } })` → abrí la app sobre ella → `ok`, `migrationsApplied === 0`.
4. **Fuse RunAsNode**: misma DB que la corrida 1, pero con `extraEnv = { ELECTRON_RUN_AS_NODE: "1" }` → tiene que dar `ok` igual (si el fuse no estuviera aplicado, el exe correría como Node y no escribiría el resultado).
5. Al final borrá la carpeta temporal (salvo que se pase `--keep`). Salí con código 1 si alguna corrida falló, imprimiendo el JSON del resultado.

**11.2** Cerrá cualquier Integral abierto y corré `npm run test:smoke-packaged` → 4/4 PASS.

**Checkpoint:** el empaquetado sin protecciones anda. Proponer commit antes de seguir.

---

## Fase 11A — Main process compilado a bytecode de V8 (bytenode)

> Objetivo: que dentro del `app.asar` no haya JS legible de la lógica de negocio. Se hace en el hook de empaquetado, sobre la **copia** del build (`buildPath`); el `.vite/` del proyecto y `npm start` no cambian.

**11A.1** Instalá bytenode como dependencia **de runtime** (se carga desde el paquete) y exacta:
```
npm install --save-exact bytenode@1.7.0
```
**No** uses 2.x: 2.0.0 y 2.0.1 se publicaron el 23 y 24-oct-2026, son demasiado nuevas. bytenode 1.7.0 no tiene dependencias propias, así que alcanza con copiar su carpeta.

**11A.2** Leé `node_modules/bytenode/README.md` y confirmá dos cosas: (a) la firma de `compileFile` acepta `{ filename, output, compileAsModule }`; (b) `require("bytenode")` registra la extensión `.jsc` en `require`. Si algo difiere, adaptá **solo** el script de 11A.3 y el cargador de 11A.4.

**11A.3** Creá `scripts/bytecode/compile-main.cjs` (CommonJS). Corre **dentro** de Electron en modo Node, para que el bytecode coincida con el V8 del runtime:
```js
// Se ejecuta con el binario de Electron del proyecto y ELECTRON_RUN_AS_NODE=1 (ver forge.config.mts).
// El bytecode de V8 solo es válido para la misma versión de Electron/V8 y la misma arquitectura.
const bytenode = require("bytenode")

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error("uso: compile-main.cjs <entrada.cjs> <salida.jsc>")
  process.exit(2)
}

Promise.resolve(bytenode.compileFile({ filename: input, output, compileAsModule: true }))
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1) })
```

**11A.4** En `forge.config.mts`:
- Imports nuevos: `import { spawnSync } from "node:child_process"` y `import { createRequire } from "node:module"`.
- `const requireFromRoot = createRequire(path.join(ROOT, "package.json"))`
- Agregá `path.join("node_modules", "bytenode")` a `RUNTIME_EXTERNALS`.
- Agregá esta constante y esta función:
```ts
const BYTECODE_LOADER = [
  '"use strict"',
  "// Cargador: el código real del main está compilado a bytecode de V8 en main.jsc",
  'require("bytenode")',
  'require("./main.jsc")',
  "",
].join("\n")

function compileMainToBytecode(buildPath: string, electronVersion: string, platform: string, arch: string) {
  if (process.env.INTEGRAL_NO_BYTECODE === "1") {
    console.warn("[bytecode] DESACTIVADO por INTEGRAL_NO_BYTECODE=1 (solo para depurar; verify:package va a fallar)")
    return
  }
  const installed = requireFromRoot("electron/package.json").version as string
  if (installed !== electronVersion) throw new Error(`[bytecode] Electron instalado ${installed} ≠ empaquetado ${electronVersion}`)
  if (platform !== process.platform || arch !== process.arch) {
    throw new Error(`[bytecode] Solo se puede compilar para el SO/arquitectura del host (${process.platform}/${process.arch}); se pidió ${platform}/${arch}`)
  }
  const electronExe = requireFromRoot("electron") as string // desde Node, require("electron") devuelve la ruta del ejecutable
  const input = path.join(buildPath, ".vite", "build", "main.cjs")
  const output = path.join(buildPath, ".vite", "build", "main.jsc")
  const result = spawnSync(electronExe, [path.join(ROOT, "scripts", "bytecode", "compile-main.cjs"), input, output], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  })
  if (result.status !== 0 || !fs.existsSync(output)) throw new Error(`[bytecode] Falló la compilación (status ${result.status})`)
  fs.writeFileSync(input, BYTECODE_LOADER)
}
```
- Cambiá la firma del hook a `packageAfterPrune: async (_forgeConfig, buildPath, electronVersion, platform, arch) => { ... }` y, **después** del `for` que copia los externals, llamá `compileMainToBytecode(buildPath, electronVersion, platform, arch)`.

Nota: el `electron.exe` de `node_modules` es el de desarrollo, **sin fuses**, por eso acepta `ELECTRON_RUN_AS_NODE`. El empaquetado sí tiene el fuse apagado.

**11A.5** `electron/smoke.ts`: agregá `mainFile: string` a `SmokeResult` y completalo en `writeSmokeResultAndExit` con `path.basename(__filename)`. En el paquete tiene que dar `"main.jsc"`; en dev, `"main.cjs"`.

**11A.6** `scripts/smoke-packaged.mjs`: en **las 4 corridas**, asertá `result.mainFile === "main.jsc"`.

**11A.7** `scripts/verify-package.mjs`, chequeo nuevo **12 — bytecode**:
- El asar contiene `.vite/build/main.jsc` y `node_modules/bytenode/package.json`.
- El `.vite/build/main.cjs` **del asar** mide menos de 500 bytes y contiene `require("bytenode")` y `./main.jsc`.
- El `main.jsc` del asar mide más de 20 KB.
- Prueba de que no quedó código fuente: `ROOT/.vite/build/main.cjs` (bundle legible) **contiene** `setWindowOpenHandler(`, y el `main.jsc` del asar, leído como `buffer.toString("latin1")`, **no** lo contiene. (El bytecode guarda nombres de propiedades y textos, pero no el código con sus paréntesis.)

**11A.8** `backend/__tests__/packaging-config.test.ts`:
- El punto 3 pasa a: `dependencies` tiene exactamente `["@prisma/client", "bytenode"]` (ordenado) y `bytenode` es `"1.7.0"`.
- Nuevo: `forge.config.mts` contiene `compileMainToBytecode`, `compile-main.cjs`, `ELECTRON_RUN_AS_NODE` y `"bytenode"`; existe `scripts/bytecode/compile-main.cjs`.

**11A.9** Verificá en este orden: `npm run test:packaging-config` → `npm run package` (en la salida tiene que aparecer la compilación, sin `[bytecode] DESACTIVADO`) → `npm run verify:package` → `npm run test:smoke-packaged` (4/4, con `mainFile === "main.jsc"`). Después confirmá que `npm start` sigue andando (Fase 9.1, sin repetir todo el checklist).

---

## Fase 11B — Ofuscación del renderer

**11B.1** Instalá: `npm install --save-dev --save-exact javascript-obfuscator@5.9.0`

**11B.2** Confirmá que en `renderer/src/Pages/Sells/Sells.tsx` existe el literal plano `'no-price'` (`kind: 'no-price'`, cerca de la línea 88). Se usa como "testigo" en la verificación. Si ya no existe, elegí otro string literal simple (no template literal) que aparezca una sola vez en `renderer/src` y usalo en 11B.4.

**11B.3** En `vite.renderer.config.mts`:
```ts
import JavaScriptObfuscator from "javascript-obfuscator"

// Opciones moderadas: protegen sin castigar la velocidad de la caja.
// PROHIBIDO activar selfDefending, debugProtection, domainLock o cualquier opción que genere eval/new Function:
// la CSP de producción (script-src 'self') las bloquea → pantalla en blanco.
const OBFUSCATOR_OPTIONS = {
  target: "browser-no-eval",
  compact: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  stringArray: true,
  stringArrayThreshold: 1,
  stringArrayEncoding: ["base64"],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  transformObjectKeys: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  sourceMap: false,
} as const

function obfuscatorPlugin(): Plugin {
  return {
    name: "integral-obfuscator",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      if (process.env.INTEGRAL_NO_OBFUSCATE === "1") {
        console.warn("[obfuscator] DESACTIVADO por INTEGRAL_NO_OBFUSCATE=1 (solo para depurar; verify:package va a fallar)")
        return
      }
      for (const chunk of Object.values(bundle)) {
        // Solo nuestro código: el chunk vendor (React y demás librerías) no se ofusca.
        if (chunk.type !== "chunk" || chunk.name === "vendor") continue
        chunk.code = JavaScriptObfuscator.obfuscate(chunk.code, OBFUSCATOR_OPTIONS).getObfuscatedCode()
      }
    },
  }
}
```
- Agregá `obfuscatorPlugin()` al final de `plugins` (después de `cspPlugin()`).
- En `build` agregá:
```ts
rollupOptions: {
  output: {
    manualChunks(id) {
      return id.includes("node_modules") ? "vendor" : undefined
    },
  },
},
```
- Si TypeScript se queja del tipo de `OBFUSCATOR_OPTIONS` en `obfuscate(...)`, tipalo con el tipo de opciones que exporta el paquete (buscalo en `node_modules/javascript-obfuscator/typings/`). **No** uses `any`.

**11B.4** `scripts/verify-package.mjs`, chequeo nuevo **13 — ofuscación** (sobre `.vite/renderer/main_window/assets/` del **asar**, listando las entradas que empiezan con ese prefijo):
- Existe exactamente un `vendor-*.js` y al menos otro `.js` (chunks de la app).
- Cada chunk de la app: contiene `_0x` (nombres hexadecimales) y **no** contiene el testigo `no-price`.
- No hay ningún `.map`.

**11B.5** `backend/__tests__/packaging-config.test.ts`, nuevo: `vite.renderer.config.mts` contiene `browser-no-eval`, `manualChunks`, `obfuscatorPlugin()` y `"vendor"`; y **no** contiene `selfDefending: true`, `debugProtection: true` ni `domainLock`.

**11B.6** Verificá: `npm test --workspace renderer` (Vitest no usa esta config: tiene que dar igual que la línea base) → `npm run package` → `npm run verify:package` → `npm run test:smoke-packaged` (si `rootChildren` da 0, ver T17).

**11B.7** Prueba manual de rendimiento con el paquete (`out/Integral-win32-x64/Integral.exe`, sin smoke), comparando con `npm start`:
- [ ] Ventas: escanear (o tipear código + Enter) 20 productos seguidos → cada uno aparece al instante.
- [ ] F2: escribir en el buscador → los resultados aparecen sin demora perceptible.
- [ ] Estadísticas y Historial de ventas cargan en un tiempo similar al de dev.

Si hay demora perceptible: primero bajá `stringArrayThreshold` a `0.75` y sacá `stringArrayEncoding`. Si con eso el testigo `no-price` vuelve a aparecer en claro, cambiá el chequeo 13 para exigir solo `_0x` y dejalo anotado en el reporte.

---

## Fase 11C — Licencia de uso (EULA) aceptada en el primer arranque

**11C.1** Creá `LICENSE.txt` en la raíz: UTF-8, español, **máximo 3000 caracteres** (se muestra en un diálogo nativo). La primera línea es exactamente `Licencia de uso de Integral — versión 1`. La segunda es `BORRADOR: revisar con un abogado antes de distribuir (borrar esta línea en la versión final).` Cláusulas, en este orden:
1. **Licencia, no venta:** licencia de uso no exclusiva e intransferible, para un (1) negocio del licenciatario.
2. **Titularidad:** el software (código, diseño, documentación) es propiedad de Antosancho y está protegido por la Ley 11.723 de Propiedad Intelectual (con el software incorporado por la Ley 25.036).
3. **Prohibiciones:** copiar, redistribuir, sublicenciar, alquilar o vender el software; descompilar, desensamblar, extraer o modificar sus archivos (incluido `app.asar`) o aplicar ingeniería inversa, salvo en lo que la ley permita expresamente.
4. **Datos:** los datos cargados en el sistema pertenecen al licenciatario, que es responsable de sus copias de seguridad.
5. **Garantía y responsabilidad:** se entrega "tal cual"; la responsabilidad queda limitada al monto pagado por la licencia.
6. **Terminación:** el incumplimiento termina la licencia.
7. **Ley y jurisdicción:** República Argentina; tribunales de `[COMPLETAR jurisdicción]`.

**11C.2** `electron/runtimePaths.ts`: agregá
```ts
export function resolveLicenseFile(loc: RuntimeLocation): string {
  return loc.isPackaged
    ? path.join(loc.resourcesPath, "LICENSE.txt")
    : path.join(loc.dirname, "..", "..", "LICENSE.txt")
}
```
y en `runtime-paths.test.ts` sumá los dos casos (empaquetado y dev); en dev el archivo **existe**.

**11C.3** `forge.config.mts`: agregá `path.join(ROOT, "LICENSE.txt")` a `extraResource` (queda en `resources/LICENSE.txt`).

**11C.4** Creá `electron/license.ts`: funciones puras, **sin** importar `electron` (se testean con ts-node):
```ts
/** Subir este número cada vez que cambie LICENSE.txt: obliga a todos a aceptar de nuevo. */
export const LICENSE_VERSION = "1"

export type LicenseAcceptance = { licenseVersion: string; acceptedAt: string } // acceptedAt en ISO 8601

/** null si el archivo no existe, no es JSON válido o no tiene la forma esperada (dos strings). Nunca lanza. */
export function readLicenseAcceptance(filePath: string): LicenseAcceptance | null
export function isLicenseAccepted(acceptance: LicenseAcceptance | null, currentVersion: string): boolean
/** Crea la carpeta si hace falta, escribe el JSON y devuelve lo escrito. */
export function writeLicenseAcceptance(filePath: string, version: string, now: Date): LicenseAcceptance
```

**11C.5** Creá `backend/__tests__/license.test.ts` (mismo patrón de script con `assert`, en una carpeta temporal):
- `readLicenseAcceptance` de un archivo inexistente → `null`; de un archivo con `"{rota"` → `null`; de uno con `{}` → `null`; de uno con `{"licenseVersion": 1, "acceptedAt": "x"}` (número) → `null`.
- `writeLicenseAcceptance(ruta/en/subcarpeta/inexistente.json, "1", new Date("2026-01-02T03:04:05Z"))`, luego `read` → `{ licenseVersion: "1", acceptedAt: "2026-01-02T03:04:05.000Z" }`.
- `isLicenseAccepted(null, "1")` → `false`; con versión `"1"` y current `"1"` → `true`; con `"1"` y current `"2"` → `false`.
- `LICENSE.txt` de la raíz: existe, tiene ≤ 3000 caracteres, contiene `ingeniería inversa` y su primera línea es exactamente `` `Licencia de uso de Integral — versión ${LICENSE_VERSION}` `` (así no se desincronizan el número del archivo y el del código). Leé el archivo quitando un posible BOM inicial y separá las líneas con `/\r?\n/`.

Registrá `"test:license": "npx ts-node backend/__tests__/license.test.ts"` y agregalo a `test:backend`.

**11C.6** `electron/main.ts`:
- Imports: `import fs from "fs"`, `import { LICENSE_VERSION, isLicenseAccepted, readLicenseAcceptance, writeLicenseAcceptance } from "./license"` y `resolveLicenseFile` desde `./runtimePaths`.
- Función nueva:
```ts
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
```
- En `bootstrap()`, **justo después** de `Menu.setApplicationMenu(null)` y **antes** de las migraciones (si no acepta, no se toca la base):
```ts
if (!SMOKE_RESULT && !ensureLicenseAccepted()) {
  app.exit(0)
  return
}
```
El modo smoke saltea la licencia porque el diálogo bloquearía la prueba automática. No sirve para evitar la licencia: en modo smoke la app se cierra sola apenas termina los chequeos.

**11C.7** `scripts/verify-package.mjs`, chequeo nuevo **14 — licencia**: existe `RES/LICENSE.txt` y su sha256 es igual al del `LICENSE.txt` del repo.

**11C.8** `packaging-config.test.ts`, nuevo: `main.ts` contiene `ensureLicenseAccepted`, `LICENSE_VERSION` y `!SMOKE_RESULT && !ensureLicenseAccepted()`; `forge.config.mts` contiene `LICENSE.txt`.

**11C.9** Verificá: `npm run test:backend` → `npm run package` → `npm run verify:package` → `npm run test:smoke-packaged`. Prueba manual en **dev** (`npm start`; dev y la app instalada comparten `%APPDATA%\Integral`, así que borrá `%APPDATA%\Integral\license-accepted.json` antes de empezar):
- [ ] Aparece el diálogo con el texto completo y legible (si se corta, acortá `LICENSE.txt`).
- [ ] "No acepto" (o Esc, o cerrar el diálogo) → la app se cierra y **no** se crea `license-accepted.json`.
- [ ] Volver a abrir → se pide de nuevo. "Acepto" → abre normal y se crea el JSON.
- [ ] Volver a abrir → **no** se pide.
- [ ] Cambiá temporalmente `LICENSE_VERSION` a `"2"` → se vuelve a pedir. **Revertí** a `"1"`.

---

## Fase 12 — Instalador (make) y prueba de instalación

**12.1** `npm run make` → crea `out/make/squirrel.windows/x64/Integral-1.0.0 Setup.exe` (el nombre exacto puede variar levemente).
**12.2** `npm run verify:make` → todo PASS (incluye los chequeos de la Fase 10 + el 11).
**12.3** Prueba manual de instalación (idealmente en otra cuenta de Windows o en una VM limpia). Marcá cada punto:
- [ ] Al ejecutar `Setup.exe` aparece SmartScreen ("editor desconocido") → "Más información" → "Ejecutar de todas formas". **Esperado** sin firma.
- [ ] Se instala sin pedir admin y abre la app sola, mostrando primero la **licencia de uso**. "No acepto" cierra la app; al reabrir la vuelve a pedir; "Acepto" entra a Stock.
- [ ] Hay acceso directo "Integral" en el escritorio y en el menú Inicio.
- [ ] Existe `%APPDATA%\Integral\integral.db`.
- [ ] Crear categoría + proveedor + producto, cargar stock, hacer una venta. Cerrar y reabrir → los datos siguen ahí.
- [ ] F10 abre el popup de ítem general (no un menú). Flujo de scanner OK.
- [ ] Doble clic en el acceso directo con la app abierta → no abre otra ventana.
- [ ] Desinstalar desde "Aplicaciones instaladas" → `%APPDATA%\Integral\integral.db` **sigue existiendo** (los datos del negocio no se borran).
- [ ] Reinstalar → aparecen los datos anteriores y **no** se vuelve a pedir la licencia (`license-accepted.json` sigue en `%APPDATA%\Integral`).
- [ ] Extracción: `npx @electron/asar extract "%LOCALAPPDATA%\Integral\app-1.0.0\resources\app.asar" <carpeta temporal>` → en `.vite/build/` hay un `main.cjs` de 3 líneas y un `main.jsc` binario; los `.js` de la app en `.vite/renderer/main_window/assets/` están ofuscados (`_0x...`). Borrá la carpeta temporal.
- [ ] **Actualización**: subí `version` a `1.0.1` en `package.json`, `npm run make`, ejecutá el nuevo `Setup.exe` sobre la instalación existente → abre con los datos intactos. Volvé `version` a `1.0.0` si no se va a publicar.

---

## Fase 13 — Documentación

**13.1** Creá `INSTALACION.md` (público: quien instala en el negocio; lenguaje simple):
- Requisitos: Windows 10/11 x64. No hace falta Node ni Git.
- Instalación nueva: ejecutar `Integral-x.y.z Setup.exe` (aviso de SmartScreen y cómo seguir). En la primera apertura hay que aceptar la licencia de uso; si se rechaza, la app se cierra.
- **Migración desde la versión de código fuente (cliente actual)**, en este orden:
  1. Cerrar la versión vieja (`npm run dev`).
  2. Hacer una copia de seguridad de `backend\prisma\dev.db` en un pendrive o en la nube.
  3. Crear la carpeta `%APPDATA%\Integral` (pegar esa ruta en la barra del Explorador).
  4. Copiar `dev.db` ahí y **renombrarlo** a `integral.db`. Si existe un `dev.db-journal`, la versión vieja no se cerró bien: volver al paso 1.
  5. Recién ahí ejecutar el instalador. Al abrir, la app actualiza la base si hace falta (y deja un backup `integral.db.backup-<fecha>` al lado).
  6. Verificar que aparezcan productos y ventas.
  - Si ya se instaló antes de copiar: cerrar Integral, reemplazar `%APPDATA%\Integral\integral.db` por la copia renombrada y volver a abrir.
- Dónde están los datos: `%APPDATA%\Integral\integral.db`. Backup manual: copiar ese archivo con la app cerrada.
- Actualizar: ejecutar el `Setup.exe` nuevo; los datos se conservan.
- Desinstalar: no borra los datos.
- Errores al iniciar ("Error en la base de datos"): no borrar nada; restaurar el `integral.db.backup-*` más reciente renombrándolo a `integral.db`, o contactar a soporte.

**13.2** Actualizá `CLAUDE.md`:
- Tabla **Stack**: "Main process: TypeScript bundleado con Vite (Electron Forge v8) a `.vite/build/`"; agregar la fila "Empaquetado: Electron Forge 8 + Squirrel.Windows".
- **Estructura de carpetas**: agregar `forge.config.mts`, `vite.*.config.mts`, `electron/runtimePaths.ts`, `electron/smoke.ts`, `electron/forge-env.d.ts`, `backend/db/migrator.ts`, `scripts/verify-package.mjs`, `scripts/smoke-packaged.mjs`, `scripts/bytecode/compile-main.cjs`, `electron/license.ts`, `LICENSE.txt`, `assets/icons/`; sacar `scripts/dev.js`.
- Sección **DATABASE_URL**: el dev `__dirname` es `.vite/build`; agregar `PRISMA_QUERY_ENGINE_LIBRARY` en prod. **Reemplazar** el párrafo "Pendiente para producción" por la descripción del migrador (algoritmo resumido, `connection_limit=1`, sin transacción, backup con `VACUUM INTO`, códigos de error, compatibilidad con `_prisma_migrations`).
- Nueva sección **Empaquetado**: comandos (`npm start`, `npm run package`, `npm run make`, `verify:package`, `verify:make`, `test:smoke-packaged`), la trampa `ELECTRON_RUN_AS_NODE`, la firma por variables de entorno (`WINDOWS_CERTIFICATE_FILE`, `WINDOWS_CERTIFICATE_PASSWORD`), el ícono opcional, y la regla: **toda migración nueva de Prisma viaja sola en el instalador** (no hay que hacer nada extra), pero **nunca hay que editar un `migration.sql` ya publicado**.
- Nueva sección **Protección del código y licencia**:
  - Main compilado a bytecode con bytenode 1.7.0 en el hook `packageAfterPrune`. Atado a la versión exacta de Electron: **al actualizar Electron no hay que hacer nada extra** (se recompila en cada `package`), pero el empaquetado debe correr en Windows x64. `INTEGRAL_NO_BYTECODE=1` solo sirve para depurar.
  - Renderer ofuscado con javascript-obfuscator 5.9.0 (`browser-no-eval`; prohibido `selfDefending`/`debugProtection`/`domainLock` por la CSP). El chunk `vendor` no se ofusca. `INTEGRAL_NO_OBFUSCATE=1` solo sirve para depurar.
  - Si un cambio de código depende de `Function.prototype.toString()` en el main, se rompe en el paquete (el bytecode no conserva el fuente).
  - EULA: `LICENSE.txt` + `LICENSE_VERSION` en `electron/license.ts`. **Regla:** si cambia el texto, subir `LICENSE_VERSION` y la primera línea del archivo (el test `test:license` exige que coincidan).
  - Límites: siguen visibles `schema.prisma`, los `migration.sql`, el preload y la base SQLite.
- Tabla MVP/Futuro: agregar "Empaquetado e instalador Windows: **Implementado**", "Protección de código (bytecode + ofuscación) y EULA: **Implementado**" y "Auto-update / firma de código: Futuro".

---

## Fase 14 — Cierre

**14.1** Corré la batería completa y compará con la línea base de la Fase 0:
```
npm run typecheck
npm run test:backend
npm test --workspace renderer
npm run make
npm run verify:make
npm run test:smoke-packaged
```
Volvé a correr el `curl` de la Fase P.1 e incluí el resultado.

**14.2** Reportá al usuario:
- qué se cambió y el resultado de cada comando;
- los checklists de las Fases 9, 11B.7, 11C.9 y 12;
- el estado del repo de GitHub (público/privado);
- lo pendiente: **revisión legal de `LICENSE.txt`** (sacar la línea BORRADOR y completar la jurisdicción), firma de código, ícono real y auto-update/publisher;
- el límite de la protección (sección 0, decisión 11).

---

## Troubleshooting

| # | Síntoma | Causa probable | Solución |
|---|---|---|---|
| T1 | Forge genera `main.js`/`preload.js` en vez de `.cjs` | Comportamiento de la versión del plugin | Usá los nombres reales en `package.json#main`, en `main.ts` (preload), en `packaging-config.test.ts` y en `verify-package.mjs`. No fuerces el nombre por config. |
| T2 | `npm start` no abre ventana; la terminal queda "colgada" o sale enseguida | `ELECTRON_RUN_AS_NODE=1` en el entorno | Fase 0.4 / 9.1. |
| T3 | Error `The plugin vite requires main to contain .vite/` (o similar) | `package.json#main` mal | Fase 7.1. |
| T4 | Ventana en blanco en el paquete; `did-fail-load` en el smoke | `outDir` del renderer distinto de `.vite/renderer/main_window` | Revisá que exista `.vite/renderer/main_window/index.html` después de `npm run package`; corregí `outDir`/`name` (Fase 4.3 / 5.2). |
| T5 | `window.api` es `undefined` (`apiType: "undefined"`) | Preload con nombre equivocado, o el preload hace `require` de algo distinto de `electron` con sandbox | Chequeo 8 de verify-package; revisá `ipcContract.ts` (solo `import type` arriba). |
| T6 | `PrismaClientInitializationError: Query engine library ... could not be found` en el paquete | Motor no desempaquetado o `PRISMA_QUERY_ENGINE_LIBRARY` sin setear | Chequeos 4 y 7 de verify-package. Confirmá `asar.unpack: "*.node"` y el bloque de la Fase 6.2. |
| T7 | `Cannot find module '@prisma/client'` o `.prisma/client/default` en el paquete | El hook no copió los módulos | Chequeo 2. Si `packageAfterPrune` no corrió (agregá un `console.log` en el hook para verlo), mové la misma lógica a `packageAfterCopy` y verificá de nuevo que `.prisma/client` sobreviva al prune. |
| T8 | `MigrationError NO_MIGRATIONS` en el paquete | `extraResource` no copió las migraciones | Chequeo 5. Revisá la ruta absoluta en `extraResource`. |
| T9 | Test F4 falla (se perdieron `SaleItem` o `saleId` quedó NULL) | Las sentencias corrieron en conexiones distintas o dentro de una transacción | Confirmá `withSingleConnection` en el `PrismaClient` del migrador y que no haya `$transaction`. |
| T10 | Error de Prisma "multiple statements" o un `migration.sql` aplicado a medias | El splitter no dividió bien | Grupo A del test; revisá el manejo del BOM y de los comentarios. |
| T11 | `make` falla en Squirrel con "description"/"authors" | Metadatos vacíos | Fase 7.1 (`author`, `description`) y `MakerSquirrel({ authors, description })`. |
| T12 | `EBUSY` al borrar DBs temporales en los tests | Cliente Prisma sin desconectar | `await prisma.$disconnect()` antes de `rmSync`. |
| T13 | Error al cargar `forge.config.mts` por `__dirname` / `import.meta` | Uso de rutas ESM | Usá `process.cwd()` como en la Fase 5.2. |
| T14 | `getCurrentFuseWire` no existe en `@electron/fuses` | Cambio de API | Usá el CLI: `npx @electron/fuses read --app out/Integral-win32-x64/Integral.exe`, mirá el formato de la salida y parseá el estado de cada fuse. |
| T15 | La smoke test da timeout | Hay otra instancia abierta (single instance lock) o la app quedó esperando un diálogo | Cerrá Integral. Si persiste, corré el exe a mano con las mismas variables de entorno y mirá la consola. |
| T16 | Tras la Fase 11A la app empaquetada se cierra al instante o el error dice `Invalid or incompatible cached data` | Bytecode generado con otra versión de Electron/V8 o restos de un build anterior | Borrá `out/` y `.vite/`, y volvé a correr `npm run package`. Revisá que `requireFromRoot("electron/package.json").version` coincida con el `electronVersion` del hook. Para aislar el problema: `INTEGRAL_NO_BYTECODE=1 npm run package` + smoke (si pasa, el problema es el bytecode). |
| T17 | Tras la Fase 11B el smoke da `rootChildren: 0` (pantalla en blanco) | El ofuscador generó `eval`/`new Function` (bloqueado por la CSP) o rompió los imports entre chunks | Confirmá `target: "browser-no-eval"` y que ninguna opción prohibida esté activa. Aislá con `INTEGRAL_NO_OBFUSCATE=1 npm run package` + smoke. Si pasa así, desactivá opciones de a una (empezando por `stringArrayEncoding` y `stringArrayRotate`). |
| T18 | `compile-main.cjs` falla con `Cannot find module 'bytenode'` | bytenode no instalado en la raíz | `npm ls bytenode` → `1.7.0`; repetí 11A.1. |
| T19 | El diálogo de licencia se ve cortado o enorme | Texto demasiado largo para un diálogo nativo | Acortá `LICENSE.txt` (el test exige ≤ 3000 caracteres; apuntá a menos si hace falta). |
| T20 | En `npm start` aparece el diálogo de licencia en cada arranque | No se pudo escribir `license-accepted.json` | Revisá permisos de `%APPDATA%\Integral` y que `writeLicenseAcceptance` cree la carpeta (`mkdirSync` con `recursive: true`). |

---

## Definition of Done

- [ ] `npm run typecheck` sin errores.
- [ ] `npm run test:backend` verde (incluye `migrator`, `runtime-paths`, `packaging-config` y `db-path-config` actualizado).
- [ ] `npm test --workspace renderer` igual o mejor que la línea base.
- [ ] `npm start` funciona con HMR (checklist de la Fase 9 completo).
- [ ] `npm run make` + `npm run verify:make` todo PASS.
- [ ] `npm run test:smoke-packaged` 4/4 PASS, con `mainFile === "main.jsc"`.
- [ ] `verify:make` incluye en PASS los chequeos 12 (bytecode), 13 (ofuscación) y 14 (licencia).
- [ ] `test:license` en verde y checklists de las Fases 11B.7 (rendimiento) y 11C.9 (licencia) completos.
- [ ] Estado del repo de GitHub informado al usuario (Fase P).
- [ ] Checklist de instalación de la Fase 12 completo.
- [ ] `INSTALACION.md` creado y `CLAUDE.md` actualizado.
- [ ] `dist/` fuera del repo; `out/` y `.vite/` ignorados.
