# Plan — Limpieza total de datos de prueba + readiness mínimo para entrega

## Contexto

El sistema se entrega al cliente final corriéndolo en **modo desarrollo** (`npm install` + `npm run dev`) directamente sobre la máquina del cliente. **No hay packaging**: el cliente ejecuta el repo tal cual.

**Decisión del usuario (Opción A):** wipe **total** de datos. La DB queda vacía: sin productos, sin categorías, sin proveedores, sin ventas, sin movimientos de stock. El cliente carga sus datos manualmente desde la UI.

**Estado actual de la DB** (`backend/prisma/dev.db`):
- Contiene productos, categorías, proveedores, ventas, pagos, movimientos de stock — todo de pruebas.
- Tiene la migración `20260504202127_add_expiry_to_stock_movement` aplicada.
- Tiene esquema sincronizado con `backend/prisma/schema.prisma`.
- Stock de productos puede estar negativo por ventas de prueba (no nos importa porque borramos los productos).

---

## Objetivo

1. Vaciar todas las tablas de datos preservando el esquema y las migraciones.
2. Resetear los autoincrement (que el primer producto/venta del cliente arranque en `id = 1`).
3. Hacer un par de fixes mínimos para que `npm run dev` corra limpio en la máquina del cliente.
4. Documentar lo que queda fuera de scope (deuda técnica para futuro).

---

## Restricciones de orden de borrado (importante)

Por las relaciones de Prisma (`schema.prisma`):

| Tabla | FK | onDelete |
|---|---|---|
| `SalePayment.saleId` → `Sale` | Cascade |
| `SaleItem.saleId` → `Sale` | Cascade |
| `SaleItem.productId` → `Product` | **Restrict** |
| `StockMovement.productId` → `Product` | **Restrict** |
| `StockMovement.saleId` → `Sale` | SetNull |
| `Product.categoryId` → `Category` | **Restrict** |
| `Product.supplierId` → `Supplier` | **Restrict** |

Por los `Restrict`, el orden de `deleteMany` es obligatorio:

1. `SalePayment` (cascadea por Sale igual; explícito por seguridad)
2. `SaleItem` (cascadea por Sale igual; explícito por seguridad)
3. `StockMovement` (no cascadea; tiene Restrict hacia Product)
4. `Sale`
5. `Product` (requiere que SaleItem y StockMovement ya estén vacíos)
6. `Category` (requiere que Product ya esté vacío)
7. `Supplier` (requiere que Product ya esté vacío)

Después de los deletes: ejecutar `DELETE FROM sqlite_sequence` para que los autoincrement vuelvan a 1.

Todo dentro de **una sola transacción** (`prisma.$transaction`) para que si falla a la mitad, no queden datos parciales.

---

## Parte 1 — Backup defensivo de la DB actual

### Paso 1.1
Crear carpeta `backend/prisma/_backups/` si no existe (ya existe, pero el script lo crea idempotente).

### Paso 1.2
Copiar `backend/prisma/dev.db` a `backend/prisma/_backups/dev.db.pre-wipe.<YYYYMMDD_HHMMSS>.bak`.

**Criterio de éxito:** el archivo backup existe en `_backups/` y su tamaño es igual al del `dev.db` original.

> Este backup es manual y queda fuera del flujo de wipe. Lo hace el operador antes de correr el wipe. **Nunca correr el wipe sin haber confirmado que el backup existe.**

---

## Parte 2 — Crear script de wipe

### Archivo a crear
`scripts/wipe-test-data.ts`

### Comportamiento del script

El script tiene **dos modos**:

- **`--dry-run`**: imprime cuántas filas hay en cada tabla y qué se borraría. **No borra nada.**
- **`--confirm`**: borra todo en transacción y resetea autoincrement.

Si no se pasa ningún flag, **el script aborta con error explicando que hay que pasar `--dry-run` o `--confirm`**. Esto evita que se corra por accidente.

### Estructura del script (explícita en lo crítico)

Imports requeridos:
```ts
import prisma from "../backend/db/client"
```

Tablas y orden (literalmente esta lista, en este orden):
```ts
const DELETE_ORDER = [
  "salePayment",
  "saleItem",
  "stockMovement",
  "sale",
  "product",
  "category",
  "supplier",
] as const
```

Lógica clave (pseudocódigo explícito):

```
parseArgs() → { dryRun: boolean, confirm: boolean }

if (!dryRun && !confirm) {
  console.error("Pasá --dry-run o --confirm. Aborting.")
  process.exit(1)
}

// 1. Imprimir contadores ANTES
for (const table of DELETE_ORDER) {
  const n = await prisma[table].count()
  console.log(`${table}: ${n} filas`)
}

if (dryRun) {
  console.log("DRY RUN — no se borró nada.")
  process.exit(0)
}

// 2. Borrado en transacción
await prisma.$transaction(async (tx) => {
  for (const table of DELETE_ORDER) {
    const result = await tx[table].deleteMany()
    console.log(`Deleted ${result.count} from ${table}`)
  }

  // 3. Reset de autoincrement (SQLite específico)
  await tx.$executeRawUnsafe("DELETE FROM sqlite_sequence")
})

// 4. Imprimir contadores DESPUÉS (deben ser todos 0)
for (const table of DELETE_ORDER) {
  const n = await prisma[table].count()
  console.log(`${table}: ${n} filas`)
}

await prisma.$disconnect()
```

> **Importante (100% explícito):**
> - El reset de autoincrement debe ir **dentro** de la misma transacción.
> - Usar `$executeRawUnsafe` (no `$executeRaw`) porque la sentencia es estática y no toma parámetros.
> - El nombre de la tabla `sqlite_sequence` se respeta tal cual; **no** existe si nunca se hizo un insert con autoincrement; el script debe tolerarlo (envolver en try/catch que ignore el error específico de "no such table" — ver Paso 2.4).

### Paso 2.1
Crear `scripts/wipe-test-data.ts` con la lógica anterior.

### Paso 2.2
Agregar al `package.json` raíz, en `scripts`:
```json
"wipe:test-data": "ts-node scripts/wipe-test-data.ts"
```

### Paso 2.3
Asegurarse de que el script imprima al inicio el path absoluto de la DB sobre la que está operando (lo lee de `process.env.DATABASE_URL` después de que `backend/db/client.ts` corre `loadEnv()`). Esto le da al operador la chance de abortar si el path apunta a algún lado raro.

Concretamente, antes de cualquier borrado:
```ts
console.log(`Operando sobre DATABASE_URL=${process.env.DATABASE_URL}`)
```

### Paso 2.4
Manejar el caso de `sqlite_sequence` inexistente. Envolver el `DELETE FROM sqlite_sequence` en try/catch; si el error contiene `no such table: sqlite_sequence`, ignorar (significa que la DB nunca tuvo autoincrement activado). Cualquier otro error → re-throw.

### Paso 2.5
Al final imprimir un resumen claro:
```
✓ Wipe completo
✓ Todas las tablas en 0 filas
✓ Autoincrement reseteado
DB lista para entrega.
```

---

## Parte 3 — Tests del script de wipe

Los tests usan el mismo patrón que `backend/__tests__/saleService-create.test.ts`: cada test crea su propia DB SQLite aislada (`test-wipe.<pid>.<ts>.db`), aplica el schema con `prisma migrate deploy`, corre el script, y al final borra el archivo.

### Archivo a crear
`backend/__tests__/wipe-test-data.test.ts`

### Test 1 — Dry run no borra nada
1. Crear DB aislada con schema.
2. Seedear: 1 Category, 1 Supplier, 1 Product, 1 Sale con 1 SaleItem y 1 SalePayment, 1 StockMovement.
3. Ejecutar el script con `--dry-run` (vía `child_process.spawnSync` con `DATABASE_URL` apuntando a la DB de test).
4. **Asserts:**
   - exit code = 0
   - `Category.count()` sigue siendo 1
   - `Product.count()` sigue siendo 1
   - `Sale.count()` sigue siendo 1
   - stdout incluye la palabra "DRY RUN"

### Test 2 — Confirm borra todo
1. Mismo seed que Test 1.
2. Ejecutar con `--confirm`.
3. **Asserts:**
   - exit code = 0
   - todas las 7 tablas tienen `count() === 0`
   - Crear un nuevo `Category` con `name: "Test"` y verificar que su `id === 1` (autoincrement reseteado correctamente).
   - Crear un nuevo Supplier y verificar que `id === 1`.
   - Crear un nuevo Product (con la category y supplier recién creados) y verificar que `id === 1`.

### Test 3 — Sin flags aborta
1. Ejecutar el script sin argumentos.
2. **Asserts:**
   - exit code ≠ 0
   - stderr contiene "--dry-run" o "--confirm"

### Test 4 — Orden de borrado respeta los Restrict
1. Seedear con un escenario que rompería si el orden estuviera mal: 1 Product con 1 StockMovement IN + 1 Sale referenciada que tiene SaleItem → ese Product (cubre los 3 Restrict en cadena).
2. Ejecutar con `--confirm`.
3. **Asserts:**
   - exit code = 0
   - todas las tablas en 0
   - **Si el orden de borrado fuera incorrecto**, Prisma lanzaría error de FK constraint y el test fallaría — esto es el assert real.

### Test 5 — DB ya vacía es idempotente
1. DB con schema aplicado pero **sin datos**.
2. Ejecutar con `--confirm`.
3. **Asserts:**
   - exit code = 0
   - sigue todo en 0
   - no tira error por `sqlite_sequence` inexistente (Paso 2.4).

### Paso 3.1
Crear el archivo de tests con los 5 tests anteriores. Reusar las helpers `prepareTestDb()` y `removeTestDbFiles()` de `backend/__tests__/saleService-create.test.ts` (copiar e inlinear las funciones; no las extraigas a un módulo compartido por ahora — overkill).

### Paso 3.2
Agregar al `package.json`:
```json
"test:wipe-script": "npx ts-node backend/__tests__/wipe-test-data.test.ts"
```

### Paso 3.3
Actualizar el script `test:backend` agregando el nuevo test a la cadena:
```json
"test:backend": "npm run test:db-path-config && npm run test:schema-db-sync && npm run test:saleService-create && npm run test:wipe-script"
```

---

## Parte 4 — Ejecución del wipe sobre la DB real

> **Pre-condición:** Parte 1 (backup) hecha y verificada. Parte 3 (tests) verde.

### Paso 4.1
Asegurarse de que **no haya ningún proceso de Electron corriendo** (Prisma + SQLite no soportan multiple writers). Cerrar el `npm run dev` si está abierto. Si Windows reporta lock, terminar procesos `electron.exe` desde el Task Manager.

### Paso 4.2
Verificar que `dev.db-journal` **no exista** en `backend/prisma/`. Si existe, significa que SQLite cerró mal — abrir/cerrar la DB con `sqlite3` o `prisma studio` para que limpie el journal. **No borrar el archivo journal a mano**.

### Paso 4.3
Correr `npm run wipe:test-data -- --dry-run` y verificar que los contadores **antes** muestren las filas esperadas (debería haber productos, ventas, etc., números > 0).

### Paso 4.4
Correr `npm run wipe:test-data -- --confirm`. Verificar:
- Logs muestran `Deleted N from <tabla>` para las 7 tablas.
- Contadores **después** son todos 0.
- Sale el mensaje `✓ Wipe completo`.

### Paso 4.5
Verificación manual con `npm run prisma:studio`:
- Las 7 tablas están vacías.
- Las migraciones (`_prisma_migrations`) **siguen estando** (esa tabla no se toca).

### Paso 4.6
Smoke test funcional:
- `npm run dev` arranca sin errores.
- En la UI: ir a Stock → ver tabla vacía sin error.
- Crear un proveedor + categoría + producto desde la UI.
- Verificar en Studio que `Product.id === 1`, `Category.id === 1`, `Supplier.id === 1`.
- Ir a Sells → carrito vacío, sin error.

---

## Parte 5 — Hardening mínimo para entrega en modo `npm run dev`

Cosas que pueden romper en la máquina del cliente aun corriendo en dev. **Solo las críticas** — el resto queda en Parte 6 como deuda documentada.

### Paso 5.1 — Postinstall de Prisma generate

**Problema:** después de `npm install` en la máquina del cliente, el Prisma Client **no se genera automáticamente**. La primera vez que el cliente arranque, Prisma falla con "Client did not initialize yet".

**Fix:** agregar al `package.json` raíz, en `scripts`:
```json
"postinstall": "prisma generate --schema backend/prisma/schema.prisma"
```

**Test manual:** borrar `node_modules/.prisma` y `node_modules/@prisma/client/.prisma`, correr `npm install`, verificar que `node_modules/@prisma/client/.prisma/client/index.js` existe sin haber ejecutado `prisma:generate` a mano.

### Paso 5.2 — Aplicar migraciones pendientes en la DB del cliente

**Problema:** si el cliente recibe el repo y la DB que entregamos tiene el schema correcto, todo funciona. Pero si el cliente actualiza el repo en el futuro y vienen migraciones nuevas, no hay nadie que las aplique.

**Fix mínimo (manual):** documentar en un nuevo archivo `ENTREGA.md` (creado en este paso) la instrucción de correr `npm run prisma:deploy` después de cada `git pull`. Agregar el script:
```json
"prisma:deploy": "npx prisma migrate deploy --schema backend/prisma/schema.prisma"
```

> **No** hacer auto-deploy de migraciones en `main.ts` por ahora — eso introduce complejidad y riesgos (timing de inicialización del Prisma client, manejo de errores en startup). Queda como deuda en Parte 6.

### Paso 5.3 — Proteger los scripts de test/integración contra ejecución accidental

**Problema:** `backend/test.ts` y `backend/testIpcBridge.ts` crean datos en la DB que `DATABASE_URL` apunte. Si el cliente o un dev distraído corre `npm run test:backend-db` sobre la DB real, se siembra basura.

**Fix:** agregar al inicio de **ambos archivos** (`backend/test.ts` y `backend/testIpcBridge.ts`), antes de cualquier import de Prisma:

```ts
if (!process.env.ALLOW_INTEGRATION_TESTS) {
  console.error(
    "Este script siembra datos en la DB. Definí ALLOW_INTEGRATION_TESTS=1 para correrlo."
  )
  process.exit(1)
}
```

Y actualizar los `package.json` scripts existentes:
```json
"test:backend-db": "cross-env ALLOW_INTEGRATION_TESTS=1 ts-node backend/test.ts",
"test:ipc-bridge":  "cross-env ALLOW_INTEGRATION_TESTS=1 ts-node backend/testIpcBridge.ts"
```

Si `cross-env` no está instalado, instalarlo como devDependency:
```bash
npm install --save-dev cross-env
```

> **No** tocar los tests bajo `backend/__tests__/` — esos ya usan DB aislada propia (ver `saleService-create.test.ts`).

### Paso 5.4 — Limpiar `_backups/` antes de entregar

`backend/prisma/_backups/` tiene 3 archivos viejos del incidente del path anidado de Prisma:
- `dev.db.canonical.20260505_204834.bak`
- `dev.db.nested.20260505_204834.bak`
- `dev.db.nested.20260505_204834.bak-journal`

Estos **no están en `.gitignore`** (la regla de `_backups/` los excluye sólo del git, pero pueden existir en el filesystem). Verificar con `git status` que no estén tracked. Si no lo están, eliminarlos del filesystem antes de entregar (limpieza, no es bloqueante).

> El backup hecho en Parte 1 (`dev.db.pre-wipe.<ts>.bak`) **se preserva** — es el rollback en caso de que algo salga mal post-entrega.

### Paso 5.5 — Verificar que no haya `dev.db-journal` en el repo

Cuando SQLite cierra mal queda un `dev.db-journal`. Si se entrega con journal pendiente, la primera apertura de la DB en la máquina del cliente puede aplicar/rollbackear cambios inesperados.

**Verificación:** `ls backend/prisma/dev.db-journal` debe **no existir** antes de empaquetar/entregar el zip del repo.

### Paso 5.6 — Smoke test full-flow sobre DB limpia

Después de los pasos 5.1–5.5:
1. `rm -rf node_modules` (simular máquina del cliente).
2. `npm install` — debe correr `prisma generate` automáticamente (verificación del 5.1).
3. `npm run dev` — debe arrancar sin errores.
4. UI: crear categoría, proveedor, producto. Hacer una venta de prueba. Verificar que se persiste.
5. **Una vez que se confirme que todo funciona, volver a correr el wipe (Parte 4) para dejar la DB nuevamente vacía antes de la entrega real.**

---

## Parte 6 — Deuda técnica documentada (NO se aborda en esta entrega)

Crear archivo `ENTREGA.md` en la raíz con la siguiente sección:

```markdown
## Limitaciones conocidas de esta versión

1. **Sin instalador**: el sistema corre con `npm run dev`. Requiere Node.js 18+ instalado.
2. **Sin backups automáticos**: la DB vive en `backend/prisma/dev.db`. Recomendar al
   cliente copiar este archivo periódicamente. Si se corrompe, no hay recovery.
3. **Sin migraciones automáticas en arranque**: si se actualiza el repo, hay que correr
   `npm run prisma:deploy` manualmente.
4. **Sin auth / multiusuario**: cualquiera con acceso a la PC puede operar como cajero.
5. **DevTools accesibles**: Ctrl+Shift+I abre el inspector. El cliente puede ver el
   código del renderer. Aceptado dado que igual recibe el repo completo.
6. **Sin cancelación de ventas**: una venta confirmada no se puede anular desde la UI.
   Si hay que corregir, se hace con `npm run prisma:studio` (manual).
7. **Stock puede ir negativo**: por diseño (alerta visible pero no bloquea). Cliente
   debe entender que es comportamiento esperado.
8. **El campo `purchasePriceSnapshot` puede ser null** en SaleItems creados antes de la
   migración `add_purchase_price_snapshot` — afecta cálculo de ganancia en Stats si se
   importan ventas viejas (en este momento N/A porque la DB se entrega vacía).
```

---

## Parte 7 — Checklist final pre-entrega

Bloque de verificación que el operador (o el AI ejecutor) debe completar antes de empaquetar el repo:

- [ ] Backup `dev.db.pre-wipe.<ts>.bak` existe en `_backups/`.
- [ ] `npm run test:backend` pasa verde (incluye `test:wipe-script`).
- [ ] `npm run wipe:test-data -- --confirm` corrió sin error.
- [ ] Las 7 tablas (`Category`, `Supplier`, `Product`, `StockMovement`, `Sale`, `SaleItem`, `SalePayment`) tienen 0 filas en Studio.
- [ ] `npm run dev` arranca sin error sobre la DB vacía.
- [ ] Crear → editar → vender un producto funciona en la UI.
- [ ] Después del smoke, **volver a correr** `npm run wipe:test-data -- --confirm` para dejar limpio.
- [ ] `package.json` tiene los scripts nuevos: `wipe:test-data`, `prisma:deploy`, `postinstall`, `test:wipe-script`, y los `test:backend-db` / `test:ipc-bridge` con `cross-env ALLOW_INTEGRATION_TESTS=1`.
- [ ] `backend/test.ts` y `backend/testIpcBridge.ts` tienen el guard `ALLOW_INTEGRATION_TESTS`.
- [ ] `backend/prisma/dev.db-journal` no existe.
- [ ] `_backups/` solo contiene el backup `pre-wipe.<ts>.bak` (los `canonical` y `nested` viejos eliminados).
- [ ] `ENTREGA.md` existe con la sección de limitaciones conocidas (Parte 6).
- [ ] `git status` no muestra cambios sin commitear que no formen parte de esta entrega.

---

## Resumen de archivos tocados/creados

**Creados:**
- `scripts/wipe-test-data.ts` — el script de wipe.
- `backend/__tests__/wipe-test-data.test.ts` — 5 tests.
- `ENTREGA.md` — limitaciones conocidas y guía mínima al cliente.

**Modificados:**
- `package.json` — nuevos scripts (`wipe:test-data`, `prisma:deploy`, `postinstall`, `test:wipe-script`); guard con `cross-env` en `test:backend-db` y `test:ipc-bridge`; cadena `test:backend` extendida; `cross-env` como devDependency.
- `backend/test.ts` — guard `ALLOW_INTEGRATION_TESTS` al inicio.
- `backend/testIpcBridge.ts` — guard `ALLOW_INTEGRATION_TESTS` al inicio.

**Limpiados (filesystem, no commits):**
- `backend/prisma/_backups/dev.db.canonical.*` y `nested.*` viejos.
- `backend/prisma/dev.db-journal` (si existiese).

**No tocados:**
- `schema.prisma` — la estructura de la DB se preserva intacta.
- `backend/prisma/migrations/` — el historial se preserva intacto.
- Cualquier código del renderer o de los repositorios.

---

## Notas para el ejecutor (AI de menor potencia)

- **Trabajá los pasos en orden secuencial.** Parte 1 → Parte 2 → Parte 3 → Parte 5 → Parte 4 → Parte 7. (Parte 4 va después de 5 porque el smoke test del 5.6 incluye un wipe extra al final.)
- **Antes de correr cualquier wipe sobre `dev.db`, confirmá que el backup de Parte 1 existe.** Si no existe, parar y avisar.
- **Si el orden de borrado falla por FK**, no improvises — re-leé la sección "Restricciones de orden de borrado" arriba y compará contra `DELETE_ORDER` en el código.
- **Para los tests**, copiá el patrón de aislamiento de DB de `backend/__tests__/saleService-create.test.ts` (lee las primeras 80 líneas para entender el patrón). No inventes uno nuevo.
- **Nunca uses `prisma:reset`** — borra y recrea TODO incluyendo `_prisma_migrations`. El wipe que necesitamos es solo de datos, preservando schema y migraciones.
- **Si encontrás algo que no encaja con este plan** (un archivo que esperabas no existe, una tabla nueva, etc.), parar y avisar antes de improvisar.
