# Plan — Limpieza total de datos residuales (DB, repo, historial y Electron)

## Contexto

La app se usó con datos reales antes de estar terminada. Hay que dejarla **limpia** para seguir el desarrollo y entregarla vacía al cliente. Además, la investigación encontró que el repo de GitHub (`Antosancho/Integral`) es **público** y su historial contiene datos reales del negocio y **tokens de GitHub en texto plano**.

Este plan está pensado para que lo ejecute un modelo de menor potencia: cada paso es chico, local a 1–2 archivos y tiene su verificación. **No saltear pasos ni cambiar el orden.** Los pasos marcados con 🛑 requieren **parar y pedir confirmación al usuario** antes de seguir.

---

## Inventario de residuos encontrados

| # | Dónde | Qué contiene | Acción |
|---|---|---|---|
| R1 | `backend/prisma/dev.db` (versionado en git) | 260 productos reales, 2 categorías, 2 proveedores, 497 movimientos de stock, 208 ventas, 263 ítems, 210 pagos. `sqlite_sequence` con contadores altos (Product=269, Sale=225…) | Recrear vacía desde migraciones + dejar de versionar |
| R2 | `backups/dev_2026-05-07_17-09-41.db` (versionado en git) | Copia vieja con 188 productos reales y 3 ventas | Borrar + ignorar `backups/` |
| R3 | Historial de git (público) | 14 versiones distintas de `dev.db` + el backup | Reescribir historial con BFG + force-push |
| R4 | `.claude/settings.local.json` (versionado en git, 13 commits) | **2 tokens de GitHub** (`ghp_ySEd…` y `ghp_nwPE…`) dentro de reglas de permisos | Revocar tokens, quitar líneas, dejar de versionar, purgar del historial |
| R5 | `backend/test.ts` y `backend/testIpcBridge.ts` | Escriben sobre la **dev.db real**. Dejaron basura: categoría y proveedor `IT … Updated 1778189606813` (id 7) | Hacer que usen una DB temporal aislada |
| R6 | `backend/__tests__/saleService-create.test.ts` y `wipe-test-data.test.ts` | Crean su DB temporal **copiando la dev.db real** (copian datos reales a archivos temporales) | Crear la DB temporal desde migraciones |
| R7 | `scripts/wipe-test-data.ts` | Borra filas pero **no hace `VACUUM`**: los datos borrados quedan en páginas libres del archivo SQLite | Agregar `VACUUM` |
| R8 | `%APPDATA%\integral\` (userData de Electron) | Cache HTTP, Code Cache, GPU cache, Local/Session Storage (solo DevTools y `localhost:5173`), Preferences | Borrar la carpeta completa |
| R9 | `.env` | **No existe** en esta máquina → `test:backend` y `wipe:test-data` fallan hoy | Crear `.env.example` versionado + `.env` local |

**Verificado que NO hay residuos en:** código del renderer (no usa `localStorage`/`sessionStorage`/IndexedDB), datos hardcodeados (los `categoryId: 1` y barcodes que aparecen son fixtures de tests, no datos reales), `renderer/public/`, docs `.md`.

---

## Decisiones tomadas con el usuario

| # | Decisión |
|---|---|
| D1 | **Borrar todo**: la DB queda con 0 filas en todas las tablas (sin sembrar `GENERAL`). |
| D2 | **Sin respaldo** de los datos reales. Se descartan. |
| D3 | **Reescribir el historial** de git para purgar `dev.db`, `backups/` y `.claude/settings.local.json`, y hacer `push --force`. |
| D4 | **`dev.db` deja de versionarse**. Se genera con `npm run prisma:deploy` en la primera instalación. |
| D5 | Herramienta de reescritura: **BFG Repo-Cleaner** (no hay Python para `git filter-repo`; sí hay Java 8). |
| D6 | La DB local se limpia **borrando el archivo y recreándolo desde migraciones** (garantiza 0 residuos, mejor que borrar filas). El script `wipe-test-data` se mejora igual porque es la herramienta oficial de entrega. |

---

## Fase 0 — 🛑 URGENTE: revocar los tokens (acción manual del usuario)

> Esto lo tiene que hacer el **usuario**, no el modelo. El modelo debe pedirlo y **esperar confirmación** antes de seguir.

1. Pedirle al usuario que entre a https://github.com/settings/tokens y **revoque** los tokens cuyo prefijo es `ghp_ySEd` y `ghp_nwPE` (y cualquier otro token clásico que no reconozca).
2. Pedirle que revise https://github.com/settings/security-log por actividad sospechosa.
3. **No continuar** hasta que el usuario confirme "tokens revocados". Reescribir el historial NO alcanza: el repo es público y los tokens ya pudieron ser copiados.

**Regla para todo el plan:** nunca escribir un token completo en ningún archivo, commit, log ni mensaje.

---

## Fase 1 — Preparación

### Paso 1.1 — Working tree limpio

1. Correr `git status`.
2. Hoy hay cambios **ajenos a este plan**: `package.json` (versiones fijadas sin `^`) y varios archivos de `dist/`. 🛑 Preguntar al usuario si los commitea aparte (sugerido: `chore: fijar versiones de dependencias y rebuild de dist`) o los descarta. **Es obligatorio** que el árbol quede limpio antes de la Fase 11 (que hace `git reset --hard`).
3. Verificación: `git status` → `nothing to commit, working tree clean`.

### Paso 1.2 — Crear el `.env` local

1. Crear `H:\anton\Proyectos\Integral\.env` con **exactamente** esta línea:
   ```
   DATABASE_URL="file:./dev.db"
   ```
   (La ruta relativa se resuelve desde `backend/prisma/`, ver "Trampa conocida" en `CONTEXT.md`.)
2. Verificación: `git status` **no** debe listar `.env` (ya está en `.gitignore`).

### Paso 1.3 — Línea base de tests

1. Correr `npm run test:backend` y anotar el resultado (hoy no tenía `.env`, puede que ahora pasen).
2. Correr `cd renderer && npm test` y anotar el resultado.
3. Si hay tests rojos **antes** de empezar, anotarlos en una lista para no atribuirlos a este plan.

---

## Fase 2 — Helper de DB de test aislada (base para R5 y R6)

### Paso 2.1 — Crear `backend/__tests__/helpers/testDb.ts`

**Objetivo:** que ningún test dependa de `dev.db`. Cada test obtiene una DB nueva creada con las migraciones reales.

Exportar:

```ts
export type TestDb = { dbPath: string; databaseUrl: string; cleanup: () => void }
export function createMigratedTestDb(label: string): TestDb
```

Comportamiento **exacto**:

1. `repoRoot = path.resolve(__dirname, "..", "..", "..")` (el helper está un nivel más adentro que los otros tests — verificar que `repoRoot` termine en `Integral`).
2. `schemaPath = path.join(repoRoot, "backend", "prisma", "schema.prisma")`.
3. `dbPath = path.join(repoRoot, "backend", "prisma", \`test-${label}.${process.pid}.${Date.now()}.db\`)` → el nombre empieza con `test` para que lo cubra la regla `backend/prisma/test*.db` del `.gitignore`.
4. `databaseUrl = \`file:${dbPath.replace(/\\/g, "/")}\``.
5. Correr **sincrónicamente** (mismo patrón que `runWipeScript` en `wipe-test-data.test.ts`):
   ```ts
   spawnSync(`npx prisma migrate deploy --schema "${schemaPath}"`, [], {
     cwd: repoRoot,
     env: { ...process.env, DATABASE_URL: databaseUrl },
     encoding: "utf-8",
     shell: true,
     timeout: 120_000,
   })
   ```
6. Si `status !== 0` → `throw new Error(...)` incluyendo `stdout` y `stderr`.
7. Si `!fs.existsSync(dbPath)` → `throw`.
8. `cleanup()` borra `dbPath` y `${dbPath}-journal` con `fs.rmSync(..., { force: true })` **dentro de try/catch** (en Windows puede dar `EBUSY` si quedó un cliente abierto; en ese caso loguear un warning, no fallar).

Comentarios en español, mismo estilo que `wipe-test-data.test.ts`.

### Paso 2.2 — Crear `backend/__tests__/helpers/useIsolatedDb.ts`

Módulo de **efecto secundario** (mismo patrón que `electron/setupEnv.ts`): se importa como **primer import** y deja `DATABASE_URL` apuntando a una DB temporal antes de que cualquier otro import cargue el Prisma client.

```ts
import { createMigratedTestDb } from "./testDb"

// Pisa DATABASE_URL a propósito: los tests de integración NUNCA deben tocar dev.db.
const testDb = createMigratedTestDb("integration")
process.env.DATABASE_URL = testDb.databaseUrl
process.on("exit", () => testDb.cleanup())
```

Agregar además una guarda: si `process.env.DATABASE_URL` no contiene `/test-` después de setearlo → `throw`.

### Paso 2.3 — Test del helper: `backend/__tests__/testDb-helper.test.ts`

Mismo estilo que los otros tests de `backend/__tests__` (funciones `assert`/`logStep`, `main().catch(...)`). Casos:

1. **Crea el archivo**: `createMigratedTestDb("helper")` → `fs.existsSync(dbPath) === true`.
2. **Migraciones aplicadas**: con un `PrismaClient` apuntando a `databaseUrl`, `SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL` es igual a la cantidad de **carpetas** dentro de `backend/prisma/migrations/` (contar con `fs.readdirSync(..., { withFileTypes: true }).filter(d => d.isDirectory())`; hoy son 9).
3. **Vacía**: `category`, `supplier`, `product`, `stockMovement`, `sale`, `saleItem`, `salePayment` → `count() === 0` las 7.
4. **No toca dev.db**: calcular SHA-256 de `backend/prisma/dev.db` antes y después de crear la DB de test (si `dev.db` existe) → iguales.
5. **Ignorada por git**: `git check-ignore -q <dbPath>` (con `spawnSync`) → `status === 0`.
6. **Cleanup**: después de `$disconnect()` + `cleanup()` → `fs.existsSync(dbPath) === false`.

### Paso 2.4 — Registrar el script

En `package.json` raíz:
- Agregar `"test:testdb-helper": "npx ts-node backend/__tests__/testDb-helper.test.ts"`.
- Agregar `npm run test:testdb-helper` **al principio** de la cadena de `test:backend`.

Verificación: `npm run test:testdb-helper` en verde.

---

## Fase 3 — Tests que copiaban la dev.db real (R6)

### Paso 3.1 — `backend/__tests__/saleService-create.test.ts`

1. Borrar `readConfiguredDatabasePath`, `prepareTestDb`, `removeTestDbFiles` y las constantes `testDbPath`/`testDatabaseUrl`.
2. Al principio de `main()`:
   ```ts
   const testDb = createMigratedTestDb("saleService-create")
   process.env.DATABASE_URL = testDb.databaseUrl
   ```
   **Antes** de los `require(...)` de `saleService` y `db/client` (el orden ya existente se mantiene: los `require` son tardíos a propósito).
3. En el `finally`: `await prisma.$disconnect()` y luego `testDb.cleanup()`.
4. Reemplazar el comentario "The temp DB starts as a copy of the real dev DB…" por uno que diga que la DB se crea vacía desde migraciones. Los `deleteMany()` de limpieza previa se pueden borrar (la DB ya nace vacía).
5. Verificación: `npm run test:saleService-create` en verde.

### Paso 3.2 — `backend/__tests__/wipe-test-data.test.ts`

1. Borrar `readConfiguredDatabasePath`, `prepareTestDb`, `makeTestDbPath`, `removeTestDbFiles`.
2. En cada test reemplazar:
   ```ts
   const dbPath = makeTestDbPath()
   const databaseUrl = prepareTestDb(dbPath)
   ```
   por:
   ```ts
   const testDb = createMigratedTestDb("wipe")
   const { dbPath, databaseUrl } = testDb
   ```
   y en el `finally` `removeTestDbFiles(dbPath)` por `testDb.cleanup()`.
3. Actualizar el comentario de cabecera ("copia de dev.db" → "DB nueva creada desde migraciones").
4. Verificación: `npm run test:wipe-script` en verde (los 5 tests existentes).

---

## Fase 4 — Tests de integración que escribían en dev.db (R5)

### Paso 4.1 — `backend/test.ts`

1. Agregar como **primera línea del archivo** (antes que cualquier otra cosa):
   ```ts
   import "./__tests__/helpers/useIsolatedDb"
   ```
2. Borrar el bloque guarda `if (!process.env.ALLOW_INTEGRATION_TESTS) { ... process.exit(1) }` y su comentario. Reemplazar por un comentario corto: "Este script corre sobre una DB temporal aislada (ver useIsolatedDb); nunca toca dev.db."
3. No cambiar nada más de la lógica del test.

### Paso 4.2 — `backend/testIpcBridge.ts`

Exactamente lo mismo que el Paso 4.1.

### Paso 4.3 — `package.json`

1. `test:backend-db` → `"npx ts-node backend/test.ts"` (sacar `cross-env ALLOW_INTEGRATION_TESTS=1`).
2. `test:ipc-bridge` → `"npx ts-node backend/testIpcBridge.ts"`.
3. **No** desinstalar `cross-env` (puede usarse en otro lado; fuera de alcance).

### Paso 4.4 — Test de aislamiento: `backend/__tests__/integration-isolation.test.ts`

1. Si `backend/prisma/dev.db` no existe → fallar con mensaje "Corré `npm run prisma:deploy` primero".
2. Calcular SHA-256 (`crypto.createHash("sha256")`) y tamaño de `dev.db` **antes**.
3. `spawnSync("npm run test:backend-db", [], { cwd: repoRoot, shell: true, encoding: "utf-8", timeout: 300_000 })` → `status === 0` (si falla, mostrar stdout/stderr).
4. Lo mismo con `npm run test:ipc-bridge`.
5. SHA-256 de `dev.db` **después** → igual al de antes.
6. No quedan archivos `test-integration.*` en `backend/prisma/` (`fs.readdirSync(...).filter(f => f.startsWith("test-integration."))` → largo 0).
7. Registrar `"test:integration-isolation": "npx ts-node backend/__tests__/integration-isolation.test.ts"` y agregarlo **al final** de `test:backend`.

Verificación: `npm run test:integration-isolation` en verde. Si `test.ts` o `testIpcBridge.ts` fallan por depender de datos que existían en la dev.db real, arreglar el **test** (que cree sus propios datos), no sembrar datos.

---

## Fase 5 — `VACUUM` en el script de wipe (R7)

### Paso 5.1 — `scripts/wipe-test-data.ts`

1. Después del `await prisma.$transaction(...)` y **antes** de `printCounts(prisma, "DESPUÉS")`, agregar:
   ```ts
   // VACUUM no puede correr dentro de una transacción. Reescribe el archivo
   // SQLite para que las filas borradas no queden recuperables en páginas libres.
   await prisma.$executeRawUnsafe("VACUUM")
   console.log("VACUUM ejecutado")
   ```
2. En el bloque final de mensajes agregar `console.log("✓ Archivo compactado (VACUUM)")`.
3. El modo `--dry-run` **no** debe ejecutar `VACUUM` (ya sale antes con `process.exit(0)`; verificar que siga así).
4. Actualizar el comentario de cabecera: mencionar que también compacta el archivo.

### Paso 5.2 — Tests nuevos en `wipe-test-data.test.ts`

Agregar y registrar en `main()`:

**Test 6 — VACUUM elimina residuos del archivo**
1. `createMigratedTestDb("wipe")`, seedear con `seedTestData` pero con un producto extra cuyo nombre sea un marcador único: `const marker = \`WIPE-RESIDUE-MARKER-${Date.now()}\``.
2. `await prisma.$disconnect()`.
3. **Sanity check**: `fs.readFileSync(dbPath).includes(Buffer.from(marker, "utf-8")) === true` (prueba que el test es capaz de detectar el residuo).
4. Correr `runWipeScript(databaseUrl, ["--confirm"])` → `status === 0`.
5. `fs.readFileSync(dbPath).includes(Buffer.from(marker, "utf-8")) === false`.
6. `stdout` incluye `"VACUUM"`.

**Test 7 — El wipe conserva el historial de migraciones**
1. DB nueva + `seedTestData` + `--confirm`.
2. `SELECT COUNT(*) AS n FROM _prisma_migrations` → igual a la cantidad de carpetas en `backend/prisma/migrations/`.

**Test 8 — Dry run no compacta**
1. DB nueva + seed con marcador + `$disconnect()` + `--dry-run`.
2. El marcador **sigue** en el archivo y `stdout` **no** incluye `"VACUUM ejecutado"`.

Verificación: `npm run test:wipe-script` → 8 tests en verde.

---

## Fase 6 — Higiene del repo (R1, R2, R4, R9)

### Paso 6.1 — Quitar los tokens del archivo local

1. Abrir `.claude/settings.local.json`.
2. Borrar **todas** las entradas del array `permissions.allow` que contengan `ghp_` o `GH_TOKEN=` (hoy son 7).
3. Borrar también las 2 entradas `Remove-Item "h:\\anton\\Documents\\Music\\Intergral\\..."` (rutas de una ubicación vieja del proyecto, ya no sirven).
4. Verificar que el JSON siga siendo válido: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8'))"` sin error.
5. `Grep` de `ghp_` en todo el proyecto (excluyendo `node_modules`) → 0 resultados.

### Paso 6.2 — `.env.example`

Crear `.env.example` en la raíz con:
```
# Copiar este archivo como .env (no se versiona).
# La ruta es relativa a backend/prisma/ (así la resuelve Prisma).
DATABASE_URL="file:./dev.db"
```

### Paso 6.3 — `.gitignore` raíz

Agregar al final (mantener lo existente):
```
# Bases de datos locales: nunca se versionan (contienen datos del negocio)
backend/prisma/dev.db
backups/
*.db-journal

# Configuración local de Claude Code (puede contener secretos)
.claude/settings.local.json
```

### Paso 6.4 — Dejar de versionar sin borrar del disco

```
git rm --cached backend/prisma/dev.db
git rm --cached .claude/settings.local.json
git rm -r --cached backups
```
Luego borrar del disco la carpeta `backups/` completa (D2: sin respaldo).

Verificación:
- `git ls-files | Select-String "\.db$"` → vacío.
- `git ls-files | Select-String "settings.local.json|^backups/"` → vacío.
- `Test-Path backend/prisma/dev.db` → `True` (el archivo local sigue, se limpia en la Fase 8).

### Paso 6.5 — Test de higiene: `backend/__tests__/repo-hygiene.test.ts`

Mismo estilo que los otros tests. Usa `spawnSync("git", [...], { cwd: repoRoot, encoding: "utf-8" })` (sin shell). Casos:

1. **Ningún `.db` versionado**: `git ls-files` → ninguna línea termina en `.db` ni en `.db-journal`.
2. **Nada de `backups/` versionado**: ninguna línea empieza con `backups/`.
3. **Config local no versionada**: no aparece `.claude/settings.local.json` ni `.env`.
4. **Sin tokens versionados**: `git grep -I -n -E "ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}"` → `status === 1` (git grep devuelve 1 cuando no hay matches). Si es 0 → fallar listando **solo el nombre de archivo y número de línea**, nunca el contenido de la línea.
5. **Reglas de ignore activas**: `git check-ignore -q <ruta>` → `status === 0` para `backend/prisma/dev.db`, `backups/cualquier.db`, `.claude/settings.local.json`, `.env`, `backend/prisma/test-x.db`.
6. **`.env.example` versionable y correcto**: `git check-ignore -q .env.example` → `status === 1`; el archivo existe y contiene la línea `DATABASE_URL="file:./dev.db"`.

Registrar `"test:repo-hygiene": "npx ts-node backend/__tests__/repo-hygiene.test.ts"` y agregarlo a `test:backend`.

> Nota: el caso 1 recién pasa después del Paso 6.4 (con el índice ya actualizado). Correrlo después de ese paso.

---

## Fase 7 — Documentación

### Paso 7.1 — `ENTREGA.md`

1. **Primera instalación** pasa a ser:
   ```bash
   npm install
   copy .env.example .env     # (en PowerShell: Copy-Item .env.example .env)
   npm run prisma:deploy      # crea backend/prisma/dev.db vacía con todas las migraciones
   npm run dev
   ```
2. En **Copia de seguridad**: aclarar que `dev.db` **no** se versiona en git, así que `git pull` nunca la pisa, y que por eso mismo es imprescindible copiarla a mano.
3. En **Limitaciones**, punto 2: misma aclaración.

### Paso 7.2 — `README_DB.md`

En "Commands" agregar:
- `npm run prisma:deploy`: crea/actualiza la DB aplicando migraciones (primera instalación).
- `npm run wipe:test-data -- --dry-run | --confirm`: vacía todas las tablas, resetea autoincrement y compacta (VACUUM).

Y una nota: `dev.db` no se versiona; se genera desde migraciones.

### Paso 7.3 — `CONTEXT.md`

En la sección "Configuración de la base de datos (DATABASE_URL)":
1. Cambiar la frase del `.env` para indicar que existe `.env.example` versionado y que hay que copiarlo como `.env`.
2. Agregar un párrafo: "**Tests y DB**: ningún test toca `dev.db`. Todos crean una DB temporal desde migraciones con `backend/__tests__/helpers/testDb.ts` (`createMigratedTestDb`). Los scripts de integración (`backend/test.ts`, `backend/testIpcBridge.ts`) importan primero `useIsolatedDb.ts`. `dev.db`, `backups/` y `.claude/settings.local.json` están en `.gitignore`; `repo-hygiene.test.ts` lo verifica."

---

## Fase 8 — Limpiar la DB local (R1)

> La app **tiene que estar cerrada** (si Electron tiene la DB abierta, Windows no deja borrarla).

1. Borrar `backend/prisma/dev.db` y, si existe, `backend/prisma/dev.db-journal`.
2. Borrar cualquier `backend/prisma/test*.db*` que haya quedado de corridas anteriores.
3. Correr `npm run prisma:deploy`. Debe decir que aplicó **9** migraciones.
4. Verificación con el script oficial: `npm run wipe:test-data -- --dry-run` → las 7 tablas en `0 filas`.
5. Verificación de contadores: `node -e` (o un script en el scratchpad, **no** en el repo) que ejecute `SELECT COUNT(*) FROM sqlite_sequence` sobre `dev.db` → `0` (o error "no such table", ambos OK).
6. Verificación de residuos en el archivo: buscar en los bytes de `dev.db` los textos `TAKIS`, `JACK DANIELS`, `IT Category`, `GENERAL` → ninguno presente (`fs.readFileSync(...).includes(Buffer.from(texto))` → `false`).
7. `npm run test:schema-db-sync` y `npm run test:db-path-config` en verde.

---

## Fase 9 — Limpiar el userData de Electron (R8)

1. Confirmar que no haya procesos `electron.exe` corriendo (`Get-Process electron -ErrorAction SilentlyContinue` → vacío).
2. Borrar **solo** la carpeta de esta app:
   ```powershell
   Remove-Item -Recurse -Force "$env:APPDATA\integral" -Confirm:$false
   ```
   **No** tocar `"$env:APPDATA\electron-from-docs"` ni ninguna otra carpeta.
3. Verificación: `Test-Path "$env:APPDATA\integral"` → `False`.
4. Al volver a abrir la app, Electron recrea la carpeta vacía; es esperado.

---

## Fase 10 — Verificación completa y commit

1. `npm run build` sin errores (compila los `.ts` nuevos).
2. `npm run test:backend` → todo verde (ahora incluye: testdb-helper, db-path-config, schema-db-sync, saleService-create, wipe-script, repo-hygiene, integration-isolation).
3. `cd renderer && npm test` → mismo resultado que la línea base (Paso 1.3).
4. Smoke manual: `npm run dev` →
   - Stock: tabla vacía, sin errores.
   - Crear una categoría, un proveedor y un producto → el producto queda con **id 1** (autoincrement reseteado).
   - Hacer una venta de prueba → historial de ventas muestra solo esa venta.
   - Header: no aparece alerta de vencimientos.
   - **Al terminar**, repetir la Fase 8 (pasos 1–4) para que la DB vuelva a quedar vacía.
5. `git status`: deben aparecer como borrados `backend/prisma/dev.db`, `backups/...`, `.claude/settings.local.json` (del índice) y como nuevos/modificados los archivos de este plan. **No** debe aparecer `.env`.
6. Commit único:
   ```
   chore: limpiar datos residuales y aislar tests de la DB real

   - dev.db, backups/ y .claude/settings.local.json dejan de versionarse
   - tests crean su DB desde migraciones (helpers/testDb.ts)
   - test.ts y testIpcBridge.ts usan DB temporal aislada
   - wipe-test-data hace VACUUM
   - tests nuevos: testDb-helper, repo-hygiene, integration-isolation
   ```
   (+ la línea de co-autoría que indique el entorno.)
7. 🛑 Pedir confirmación y hacer `git push` **normal** (todavía sin force). BFG necesita que el commit HEAD remoto ya no tenga los archivos.

---

## Fase 11 — 🛑 Reescribir el historial público (R3, R4)

> **Destructivo e irreversible para el remoto.** Cambia los hashes de todos los commits. Confirmar con el usuario **antes del push final** (Paso 11.6). Hoy el repo tiene 0 forks, 1 sola rama (`main`) y 0 tags.

### Paso 11.1 — Preparar herramientas (fuera del repo)

1. Crear una carpeta de trabajo **fuera** de `Integral/`, por ejemplo `H:\anton\Proyectos\integral-cleanup\`.
2. Descargar BFG 1.14.0 ahí:
   ```powershell
   Invoke-WebRequest https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -OutFile H:\anton\Proyectos\integral-cleanup\bfg.jar
   ```
3. `java -jar H:\anton\Proyectos\integral-cleanup\bfg.jar --version` → imprime versión. Si da `UnsupportedClassVersionError`, parar y pedir al usuario instalar un JRE ≥ 11 (Temurin).

### Paso 11.2 — Clon espejo

```powershell
cd H:\anton\Proyectos\integral-cleanup
git clone --mirror https://github.com/Antosancho/Integral.git Integral.git
```

### Paso 11.3 — Purgar los archivos de todos los commits

Correr **por separado** (uno por vez, revisando la salida de cada uno):
```powershell
java -jar bfg.jar --delete-files dev.db Integral.git
java -jar bfg.jar --delete-files settings.local.json Integral.git
java -jar bfg.jar --delete-folders backups Integral.git
```
- BFG protege el commit HEAD: como en la Fase 10 ya se quitaron del HEAD, no debe advertir "protected commits contain these files". Si lo advierte → **parar**: la Fase 10 no se pusheó bien.

### Paso 11.4 — Eliminar los objetos viejos del espejo

```powershell
cd Integral.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Paso 11.5 — Verificar el espejo ANTES de pushear

1. `git rev-list --all --objects | Select-String "\.db$|settings\.local\.json|backups/"` → **vacío**.
2. `git log --all -S "ghp_" --oneline` → **vacío**.
3. `git log --oneline | Measure-Object` → la cantidad de commits debe ser parecida a la original (BFG no borra commits, solo los reescribe).
4. `git ls-tree -r HEAD --name-only` → contiene `schema.prisma`, `migrations/...`, `.env.example`, `backend/__tests__/repo-hygiene.test.ts`.

### Paso 11.6 — 🛑 Push forzado

1. Mostrarle al usuario el resultado del 11.5 y pedir confirmación explícita.
2. `git push --force` (dentro de `Integral.git`; el clon `--mirror` empuja todas las refs).
3. Errores `! [remote rejected] refs/pull/... (deny updating a hidden ref)` son **esperables e inofensivos** si hubo PRs; cualquier otro error → parar.

### Paso 11.7 — Resincronizar el repo local de trabajo

En `H:\anton\Proyectos\Integral`:
1. `git status` → **limpio** (obligatorio; el siguiente comando descarta cambios no commiteados). Los archivos ignorados (`.env`, `dev.db`, `.claude/settings.local.json`) no se tocan.
2. ```powershell
   git fetch origin
   git reset --hard origin/main
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```
3. Verificación: `git rev-list --all --objects | Select-String "\.db$|settings\.local\.json|backups/"` → vacío.
4. `npm run test:backend` → verde de nuevo.
5. Borrar `H:\anton\Proyectos\integral-cleanup\` completa (contiene el espejo y el reporte de BFG con hashes viejos).

### Paso 11.8 — Avisos finales al usuario

1. GitHub puede seguir mostrando commits viejos si alguien tiene el hash exacto (caché). Para purgarlos del todo, el usuario puede abrir un ticket en GitHub Support ("Remove sensitive data / cached views"). Por eso la **Fase 0 (revocar tokens) es lo que realmente protege**.
2. Cualquier otro clon del repo (otra PC, el cliente) debe **borrarse y clonarse de nuevo**; un `git pull` sobre un clon viejo reintroduciría los archivos.

---

## Checklist final (todo debe ser ✅)

- [ ] Tokens revocados por el usuario (Fase 0).
- [ ] `backend/prisma/dev.db`: 0 filas en las 7 tablas, `sqlite_sequence` vacía, sin textos residuales en el archivo.
- [ ] `backups/` no existe.
- [ ] `%APPDATA%\integral` no existe (o se recreó vacía al abrir la app).
- [ ] `.claude/settings.local.json` sin tokens y fuera de git.
- [ ] `git ls-files` sin `.db`; `.gitignore` con las reglas nuevas; `.env.example` versionado.
- [ ] `npm run test:backend` verde (7 suites); `renderer` tests igual que la línea base.
- [ ] Historial remoto y local sin `dev.db`, `backups/`, `settings.local.json` ni `ghp_`.
- [ ] `ENTREGA.md`, `README_DB.md`, `CONTEXT.md` actualizados.

---

## Fuera de alcance (anotado para después)

- `dist/` está versionado en git (código compilado, no datos). Conviene ignorarlo en una iteración aparte.
- `renderer/.gitignore` tiene la regla `.settings.local.json` (con punto inicial, no matchea nada). Inofensivo.
- Producción: la DB en `<userData>/integral.db` todavía no se crea ni migra sola en el primer arranque (ya anotado en `CONTEXT.md`).

---

## Trampas conocidas

- **Orden de imports**: `useIsolatedDb` tiene que ser el **primer** import de `test.ts`/`testIpcBridge.ts`. Si otro import carga `backend/db/client` antes, Prisma se conecta a `dev.db`. El test de aislamiento (Paso 4.4) detecta este error.
- **`VACUUM` fuera de la transacción**: dentro de `$transaction` falla con "cannot VACUUM from within a transaction".
- **Windows y archivos abiertos**: borrar una `.db` con un `PrismaClient` conectado da `EBUSY`. Siempre `$disconnect()` antes de `cleanup()` o de leer los bytes del archivo.
- **Rutas relativas en `DATABASE_URL`**: Prisma las resuelve desde `backend/prisma/`, no desde el CWD. El helper usa rutas **absolutas** para evitarlo.
- **BFG y HEAD protegido**: si los archivos siguen en el commit HEAD remoto, BFG no los borra de ahí. Por eso la Fase 10 (commit + push normal) va antes de la Fase 11.
- **Nunca** imprimir ni commitear un token completo, ni en logs de tests (el test de higiene muestra solo archivo:línea).
