# Plan: Tipado del contrato IPC entre Electron main y renderer

## Contexto del problema

- `electron/ipcContract.ts` declara todos los métodos de `ElectronApi` con retorno `Promise<unknown>`. El renderer pierde toda la información de tipos.
- `renderer/src/electron-api.d.ts` es el espejo de esa interfaz y tiene tipos parcialmente inventados / desactualizados (por ejemplo, tipa `StockMovement.product` como `ProductFromApi` cuando en realidad viene sin `category` ni `supplier`).
- Los valores que cruzan el IPC pasan por `electron/ipcSerialize.ts`, que transforma los `Decimal` de Prisma a `string`. Los `BigInt` pasan tal cual (no se convierten a string). Las `Date` pasan tal cual.
- Las queries de productos incluyen siempre `{ category, supplier }`. Las queries de stockMovements incluyen siempre `{ product }` **desnudo** (sin `category`/`supplier`). Los `delete*` NO incluyen relaciones.
- Ambos archivos (`ipcContract.ts` y `electron-api.d.ts`) deben quedar con tipos idénticos entre sí.
- **Restricción dura:** no modificar ningún archivo de lógica (repositorios, handlers, serializer). Solo se editan los dos archivos de contrato/tipos y se crean archivos de test de tipos.

---

## Decisiones de diseño (NO cambiar)

1. **`barcode` se tipa como `bigint | null`** en los tipos de salida. Reflejamos lo que el serializer hace hoy: los bigint pasan tal cual.
2. **`purchasePrice` y `salePrice` se tipan como `string`** en los tipos de salida (el serializer convierte `Decimal` de Prisma a `string`).
3. **`createdAt` y `date` se tipan como `Date`** en los tipos de salida (el serializer y `structured clone` de Electron preservan `Date`).
4. **`StockMovement.product` se tipa como `BareProductFromApi`** (sin `category` ni `supplier`) porque el repositorio incluye `{ product: true }` sin relaciones anidadas.
5. **`deleteProduct` devuelve `BareProductFromApi`** (sin relaciones) porque `prisma.product.delete` no hace include.
6. **`deleteStockMovement` devuelve `BareStockMovementFromApi`** (sin `product`) porque `prisma.stockMovement.delete` no hace include.

---

## Orden de ejecución

Cada paso es pequeño, independiente de los siguientes hasta donde se pueda, y termina con una verificación. Si una verificación falla, parar, revisar qué salió distinto, y corregir antes de continuar.

---

### Paso 1 — Snapshot del estado actual (baseline)

**Objetivo:** saber cuántos errores de tipo hay HOY para poder comparar al final.

1. Abrir una terminal en `h:\anton\Integral`.
2. Ejecutar:
   ```bash
   npx tsc --noEmit -p electron/tsconfig.json
   ```
   Si no existe ese tsconfig, usar el de la raíz:
   ```bash
   npx tsc --noEmit
   ```
3. Ejecutar también:
   ```bash
   cd renderer && npx tsc --noEmit
   ```
4. Guardar mentalmente (o en un scratchpad) cuántos errores salen en cada uno. Al final del plan no deben ser MÁS que ahora. Idealmente quedan en 0.

---

### Paso 2 — Leer los tipos de input en los repositorios

**Objetivo:** confirmar los nombres exactos de las interfaces de input que vamos a importar en `ipcContract.ts` y duplicar en `electron-api.d.ts`.

1. Abrir [backend/repositories/categoryRepository.ts](backend/repositories/categoryRepository.ts). Anotar: `CreateCategoryInput`, `UpdateCategoryInput`.
2. Abrir [backend/repositories/supplierRepository.ts](backend/repositories/supplierRepository.ts). Anotar: `CreateSupplierInput`, `UpdateSupplierInput`.
3. Abrir [backend/repositories/productRepository.ts](backend/repositories/productRepository.ts). Anotar: `CreateProductInput`, `UpdateProductInput`, `ProductFilters`.
4. Abrir [backend/repositories/stockMovementRepository.ts](backend/repositories/stockMovementRepository.ts). Anotar: `CreateStockMovementInput`, `ListStockMovementsFilters`.
5. Abrir [backend/repositories/utilities.ts](backend/repositories/utilities.ts). Anotar: `BarcodeInput` (`bigint | number | string`), `DecimalInput`, `StockMovementType` (`"IN" | "SALE" | "ADJUSTMENT"`).

No modificar nada en este paso. Es solo lectura.

---

### Paso 3 — Redactar los tipos de salida serializados en `ipcContract.ts`

**Objetivo:** agregar las interfaces de lo que efectivamente llega al renderer (tipos "FromApi").

1. Abrir [electron/ipcContract.ts](electron/ipcContract.ts).
2. Dejar el bloque de `import type { ... } from "../backend/repositories"` como está (al final del paso 4 vamos a usarlo para los inputs).
3. Debajo del `import` y antes de `export type IpcInvoke`, pegar EXACTAMENTE este bloque de tipos:

   ```ts
   // -----------------------------------------------------------------------------
   // Tipos de salida (lo que realmente llega al renderer después del IPC).
   // Reflejan la serialización de `electron/ipcSerialize.ts`:
   //   - Prisma.Decimal  -> string
   //   - bigint          -> bigint (pasa tal cual)
   //   - Date            -> Date   (pasa tal cual)
   // -----------------------------------------------------------------------------

   export interface CategoryFromApi {
     id: number
     name: string
   }

   export interface SupplierFromApi {
     id: number
     name: string
     phone: string | null
     notes: string | null
   }

   export interface BareProductFromApi {
     id: number
     name: string
     barcode: bigint | null
     purchasePrice: string
     salePrice: string
     stock: number
     minStock: number
     createdAt: Date
     categoryId: number
     supplierId: number
   }

   export interface ProductFromApi extends BareProductFromApi {
     category: CategoryFromApi
     supplier: SupplierFromApi
   }

   export interface BareStockMovementFromApi {
     id: number
     productId: number
     type: string
     quantity: number
     date: Date
     notes: string | null
     appliedDelta: number | null
     saleId: number | null
   }

   export interface StockMovementFromApi extends BareStockMovementFromApi {
     product: BareProductFromApi
   }
   ```

4. Guardar el archivo.
5. Ejecutar `npx tsc --noEmit` desde la raíz y confirmar que no hay errores nuevos (solo los del baseline).

**Notas de decisión:**
- `BareStockMovementFromApi` incluye `appliedDelta` y `saleId` porque están en el modelo Prisma (ver [backend/prisma/schema.prisma](backend/prisma/schema.prisma)) y `findMany` los devuelve.
- `type` se deja como `string` (no `StockMovementType`) porque el campo en la DB es `String` y teóricamente puede contener valores inválidos heredados. Si se quiere más estricto, se podría usar `"IN" | "SALE" | "ADJUSTMENT"`, pero por ahora mantenemos compatibilidad con el shape crudo de Prisma.

---

### Paso 4 — Tipar los retornos de `ElectronApi` en `ipcContract.ts`

**Objetivo:** reemplazar los `Promise<unknown>` por los tipos reales.

1. En el mismo archivo [electron/ipcContract.ts](electron/ipcContract.ts), reemplazar la interfaz `ElectronApi` completa por esta versión:

   ```ts
   export interface ElectronApi {
     createCategory: (data: CreateCategoryInput) => Promise<CategoryFromApi>
     listCategories: () => Promise<CategoryFromApi[]>
     getCategoryById: (id: number) => Promise<CategoryFromApi | null>
     updateCategory: (id: number, data: UpdateCategoryInput) => Promise<CategoryFromApi>
     deleteCategory: (id: number) => Promise<CategoryFromApi>

     createSupplier: (data: CreateSupplierInput) => Promise<SupplierFromApi>
     listSuppliers: () => Promise<SupplierFromApi[]>
     getSupplierById: (id: number) => Promise<SupplierFromApi | null>
     updateSupplier: (id: number, data: UpdateSupplierInput) => Promise<SupplierFromApi>
     deleteSupplier: (id: number) => Promise<SupplierFromApi>

     createProduct: (data: CreateProductInput) => Promise<ProductFromApi>
     listProducts: (filters?: ProductFilters) => Promise<ProductFromApi[]>
     getProductById: (id: number) => Promise<ProductFromApi | null>
     getProductByBarcode: (barcode: bigint | number | string) => Promise<ProductFromApi | null>
     updateProduct: (id: number, data: UpdateProductInput) => Promise<ProductFromApi>
     updateProductStock: (id: number, stock: number) => Promise<ProductFromApi>
     changeProductStock: (id: number, delta: number) => Promise<ProductFromApi>
     deleteProduct: (id: number) => Promise<BareProductFromApi>

     createStockMovement: (data: CreateStockMovementInput) => Promise<StockMovementFromApi>
     listStockMovements: (filters?: ListStockMovementsFilters) => Promise<StockMovementFromApi[]>
     getStockMovementById: (id: number) => Promise<StockMovementFromApi | null>
     deleteStockMovement: (id: number, revertStock?: boolean) => Promise<BareStockMovementFromApi>
   }
   ```

2. NO tocar la función `buildElectronApi(invoke)` que viene abajo. Como sus retornos ahora son específicos en vez de `unknown`, TS va a inferir que `invoke(...)` devuelve `Promise<unknown>` y no va a matchear. Arreglar eso en el paso 5 con un cast controlado.

3. Guardar.

---

### Paso 5 — Ajustar `buildElectronApi` para no romper por los retornos más estrictos

**Objetivo:** que `buildElectronApi` compile con los nuevos tipos sin cambiar su lógica.

1. En [electron/ipcContract.ts](electron/ipcContract.ts), reemplazar el cuerpo de `buildElectronApi` por esta versión (solo cambia la firma del helper interno y el uso de un cast al final; la lógica de los canales es idéntica):

   ```ts
   export function buildElectronApi(invoke: IpcInvoke): ElectronApi {
     const call = <T>(channel: string, payload: unknown) => invoke(channel, payload) as Promise<T>

     return {
       createCategory: (data) => call<CategoryFromApi>("category:create", { data }),
       listCategories: () => call<CategoryFromApi[]>("category:list", {}),
       getCategoryById: (id) => call<CategoryFromApi | null>("category:getById", { id }),
       updateCategory: (id, data) => call<CategoryFromApi>("category:update", { id, data }),
       deleteCategory: (id) => call<CategoryFromApi>("category:delete", { id }),

       createSupplier: (data) => call<SupplierFromApi>("supplier:create", { data }),
       listSuppliers: () => call<SupplierFromApi[]>("supplier:list", {}),
       getSupplierById: (id) => call<SupplierFromApi | null>("supplier:getById", { id }),
       updateSupplier: (id, data) => call<SupplierFromApi>("supplier:update", { id, data }),
       deleteSupplier: (id) => call<SupplierFromApi>("supplier:delete", { id }),

       createProduct: (data) => call<ProductFromApi>("product:create", { data }),
       listProducts: (filters) => call<ProductFromApi[]>("product:list", { filters }),
       getProductById: (id) => call<ProductFromApi | null>("product:getById", { id }),
       getProductByBarcode: (barcode) => call<ProductFromApi | null>("product:getByBarcode", { barcode }),
       updateProduct: (id, data) => call<ProductFromApi>("product:update", { id, data }),
       updateProductStock: (id, stock) => call<ProductFromApi>("product:updateStock", { id, stock }),
       changeProductStock: (id, delta) => call<ProductFromApi>("product:changeStock", { id, delta }),
       deleteProduct: (id) => call<BareProductFromApi>("product:delete", { id }),

       createStockMovement: (data) => call<StockMovementFromApi>("stockMovement:create", { data }),
       listStockMovements: (filters) => call<StockMovementFromApi[]>("stockMovement:list", { filters }),
       getStockMovementById: (id) => call<StockMovementFromApi | null>("stockMovement:getById", { id }),
       deleteStockMovement: (id, revertStock) =>
         call<BareStockMovementFromApi>("stockMovement:delete", { id, revertStock })
     }
   }
   ```

2. **Importante:** NO cambiar `IpcInvoke`. El cast se hace por canal, lo que es equivalente a lo que había antes (el runtime no se modifica).
3. Guardar.
4. Ejecutar `npx tsc --noEmit` desde la raíz. No deben aparecer errores nuevos en `electron/ipcContract.ts`.

---

### Paso 6 — Sincronizar `renderer/src/electron-api.d.ts`

**Objetivo:** que el archivo del renderer declare EXACTAMENTE los mismos tipos, duplicados a mano (el renderer no puede importar desde `backend/` ni desde `electron/`).

1. Abrir [renderer/src/electron-api.d.ts](renderer/src/electron-api.d.ts).
2. Reemplazar TODO el contenido del archivo por lo siguiente:

   ```ts
   // ---------------------------------------------------------------------------
   // ESPEJO del contrato IPC. Debe quedar SINCRONIZADO con electron/ipcContract.ts.
   // Si uno cambia, el otro también.
   // Reglas de serialización:
   //   - Prisma.Decimal -> string
   //   - bigint         -> bigint  (pasa tal cual)
   //   - Date           -> Date    (pasa tal cual)
   // ---------------------------------------------------------------------------

   // ---------- Inputs ----------

   type DecimalInput = number | string
   type BarcodeInput = number | string | bigint
   type StockMovementType = "IN" | "SALE" | "ADJUSTMENT"

   type PaginationInput = {
     skip?: number
     take?: number
   }

   type CreateCategoryInput = {
     name: string
   }

   type UpdateCategoryInput = {
     name?: string
   }

   type CreateSupplierInput = {
     name: string
     phone?: string | null
     notes?: string | null
   }

   type UpdateSupplierInput = {
     name?: string
     phone?: string | null
     notes?: string | null
   }

   type CreateProductInput = {
     name: string
     purchasePrice: DecimalInput
     salePrice: DecimalInput
     categoryId: number
     supplierId: number
     barcode?: BarcodeInput | null
     stock?: number
     minStock?: number
   }

   type UpdateProductInput = {
     name?: string
     purchasePrice?: DecimalInput
     salePrice?: DecimalInput
     categoryId?: number
     supplierId?: number
     barcode?: BarcodeInput | null
     stock?: number
     minStock?: number
   }

   type ProductFilters = PaginationInput & {
     id?: number
     barcode?: BarcodeInput
     categoryId?: number
     supplierId?: number
     nameContains?: string
   }

   type CreateStockMovementInput = {
     productId: number
     type: StockMovementType | string
     quantity: number
     notes?: string | null
     date?: Date
     applyToStock?: boolean
   }

   type ListStockMovementsFilters = PaginationInput & {
     productId?: number
     type?: StockMovementType | string
     fromDate?: Date
     toDate?: Date
   }

   // ---------- Outputs (serializados) ----------

   type CategoryFromApi = {
     id: number
     name: string
   }

   type SupplierFromApi = {
     id: number
     name: string
     phone: string | null
     notes: string | null
   }

   type BareProductFromApi = {
     id: number
     name: string
     barcode: bigint | null
     purchasePrice: string
     salePrice: string
     stock: number
     minStock: number
     createdAt: Date
     categoryId: number
     supplierId: number
   }

   type ProductFromApi = BareProductFromApi & {
     category: CategoryFromApi
     supplier: SupplierFromApi
   }

   type BareStockMovementFromApi = {
     id: number
     productId: number
     type: string
     quantity: number
     date: Date
     notes: string | null
     appliedDelta: number | null
     saleId: number | null
   }

   type StockMovementFromApi = BareStockMovementFromApi & {
     product: BareProductFromApi
   }

   // ---------- ElectronApi ----------

   type ElectronApi = {
     createCategory: (data: CreateCategoryInput) => Promise<CategoryFromApi>
     listCategories: () => Promise<CategoryFromApi[]>
     getCategoryById: (id: number) => Promise<CategoryFromApi | null>
     updateCategory: (id: number, data: UpdateCategoryInput) => Promise<CategoryFromApi>
     deleteCategory: (id: number) => Promise<CategoryFromApi>

     createSupplier: (data: CreateSupplierInput) => Promise<SupplierFromApi>
     listSuppliers: () => Promise<SupplierFromApi[]>
     getSupplierById: (id: number) => Promise<SupplierFromApi | null>
     updateSupplier: (id: number, data: UpdateSupplierInput) => Promise<SupplierFromApi>
     deleteSupplier: (id: number) => Promise<SupplierFromApi>

     createProduct: (data: CreateProductInput) => Promise<ProductFromApi>
     listProducts: (filters?: ProductFilters) => Promise<ProductFromApi[]>
     getProductById: (id: number) => Promise<ProductFromApi | null>
     getProductByBarcode: (barcode: BarcodeInput) => Promise<ProductFromApi | null>
     updateProduct: (id: number, data: UpdateProductInput) => Promise<ProductFromApi>
     updateProductStock: (id: number, stock: number) => Promise<ProductFromApi>
     changeProductStock: (id: number, delta: number) => Promise<ProductFromApi>
     deleteProduct: (id: number) => Promise<BareProductFromApi>

     createStockMovement: (data: CreateStockMovementInput) => Promise<StockMovementFromApi>
     listStockMovements: (filters?: ListStockMovementsFilters) => Promise<StockMovementFromApi[]>
     getStockMovementById: (id: number) => Promise<StockMovementFromApi | null>
     deleteStockMovement: (id: number, revertStock?: boolean) => Promise<BareStockMovementFromApi>
   }

   declare global {
     interface Window {
       api: ElectronApi
     }
   }

   export {}
   ```

3. Guardar.

**Criterio de consistencia (importante):** los shapes (nombres de propiedades + tipos de propiedades + retornos de métodos) en este archivo deben coincidir uno a uno con los de `electron/ipcContract.ts`. La única diferencia admitida es:
- En `electron/ipcContract.ts` los tipos son `export interface ...`.
- En `electron-api.d.ts` son `type ... = { ... }` (porque el archivo es un `.d.ts` ambiente y no exporta nada al módulo). Eso es estructuralmente equivalente para TS.

---

### Paso 7 — Test de tipos del lado del main (electron)

**Objetivo:** detectar en tiempo de compilación si alguien rompe la consistencia entre los tipos declarados y el shape real que devuelven las queries.

1. Crear un archivo nuevo `electron/ipcContract.types-test.ts` con este contenido:

   ```ts
   // Archivo de test de tipos. NO tiene runtime útil; TS lo valida en compilación.
   // Si rompe, significa que el contrato IPC dejó de coincidir con la realidad.

   import type {
     BareProductFromApi,
     BareStockMovementFromApi,
     CategoryFromApi,
     ElectronApi,
     ProductFromApi,
     StockMovementFromApi,
     SupplierFromApi
   } from "./ipcContract"

   // --- Fixtures que simulan lo que sale del serializer ---

   const category: CategoryFromApi = { id: 1, name: "Bebidas" }

   const supplier: SupplierFromApi = {
     id: 1,
     name: "Proveedor X",
     phone: null,
     notes: null
   }

   const bareProduct: BareProductFromApi = {
     id: 1,
     name: "Coca 500ml",
     barcode: 7790895000000n,
     purchasePrice: "100.00",
     salePrice: "150.00",
     stock: 10,
     minStock: 2,
     createdAt: new Date(),
     categoryId: 1,
     supplierId: 1
   }

   const product: ProductFromApi = {
     ...bareProduct,
     category,
     supplier
   }

   const bareMovement: BareStockMovementFromApi = {
     id: 1,
     productId: 1,
     type: "IN",
     quantity: 5,
     date: new Date(),
     notes: null,
     appliedDelta: null,
     saleId: null
   }

   const movement: StockMovementFromApi = {
     ...bareMovement,
     product: bareProduct
   }

   // --- Comprobaciones estructurales ---

   // barcode DEBE ser bigint | null (no string, no number).
   const _bc: bigint | null = product.barcode
   // precios DEBEN ser string.
   const _pp: string = product.purchasePrice
   const _sp: string = product.salePrice
   // createdAt DEBE ser Date.
   const _ca: Date = product.createdAt
   // category y supplier DEBEN estar presentes.
   const _catName: string = product.category.name
   const _supName: string = product.supplier.name

   // StockMovement.product NO debe tener category/supplier (es BareProductFromApi).
   // @ts-expect-error — product dentro de un movimiento viene desnudo.
   const _shouldFail = movement.product.category

   // --- Mock de ElectronApi para validar firmas ---

   const api: ElectronApi = {
     createCategory: async (_d) => category,
     listCategories: async () => [category],
     getCategoryById: async (_id) => category,
     updateCategory: async (_id, _d) => category,
     deleteCategory: async (_id) => category,

     createSupplier: async (_d) => supplier,
     listSuppliers: async () => [supplier],
     getSupplierById: async (_id) => supplier,
     updateSupplier: async (_id, _d) => supplier,
     deleteSupplier: async (_id) => supplier,

     createProduct: async (_d) => product,
     listProducts: async (_f) => [product],
     getProductById: async (_id) => product,
     getProductByBarcode: async (_b) => product,
     updateProduct: async (_id, _d) => product,
     updateProductStock: async (_id, _s) => product,
     changeProductStock: async (_id, _d) => product,
     deleteProduct: async (_id) => bareProduct,

     createStockMovement: async (_d) => movement,
     listStockMovements: async (_f) => [movement],
     getStockMovementById: async (_id) => movement,
     deleteStockMovement: async (_id, _r) => bareMovement
   }

   void api
   ```

2. Guardar.
3. Ejecutar `npx tsc --noEmit` desde la raíz.
4. **Criterio de éxito:** cero errores en este archivo. El `@ts-expect-error` DEBE triggerear correctamente (si TS se queja de que "esta directiva no aplica", quiere decir que el bug NO fue cazado y hay que revisar por qué `movement.product` acepta `.category`).

---

### Paso 8 — Test de tipos del lado del renderer

**Objetivo:** el mismo test, pero del lado del renderer, contra `window.api`.

1. Crear un archivo nuevo `renderer/src/electron-api.types-test.ts` con este contenido:

   ```ts
   // Archivo de test de tipos para el renderer. NO se usa en runtime.

   async function _checkWindowApi() {
     const products = await window.api.listProducts({ take: 10 })
     const first = products[0]

     // Shape esperado
     const _id: number = first.id
     const _name: string = first.name
     const _barcode: bigint | null = first.barcode
     const _purchase: string = first.purchasePrice
     const _sale: string = first.salePrice
     const _created: Date = first.createdAt
     const _catName: string = first.category.name
     const _supName: string = first.supplier.name

     const maybe = await window.api.getProductById(1)
     // Puede ser null
     const _n: ProductFromApi | null = maybe

     const deleted = await window.api.deleteProduct(1)
     // deleteProduct NO trae category/supplier.
     // @ts-expect-error — deleteProduct devuelve BareProductFromApi.
     const _shouldFail1 = deleted.category

     const movements = await window.api.listStockMovements()
     const m = movements[0]
     const _mDate: Date = m.date
     // product dentro del movimiento viene desnudo.
     // @ts-expect-error — StockMovement.product es BareProductFromApi.
     const _shouldFail2 = m.product.category

     const delMov = await window.api.deleteStockMovement(1, false)
     // @ts-expect-error — deleteStockMovement no incluye product.
     const _shouldFail3 = delMov.product
   }

   void _checkWindowApi
   ```

2. Guardar.
3. Ejecutar `cd renderer && npx tsc --noEmit`.
4. **Criterio de éxito:** cero errores, y los tres `@ts-expect-error` son aceptados (si TS se queja de alguno, es porque el tipo NO está protegiendo bien y hay que revisar).

---

### Paso 9 — Verificar que el renderer real no se rompió

**Objetivo:** [renderer/src/Pages/Stock.tsx](renderer/src/Pages/Stock.tsx) consume `listProducts` usando `Awaited<ReturnType<...>>[number]`. Ese patrón debe seguir funcionando con los nuevos tipos.

1. Ejecutar `cd renderer && npx tsc --noEmit`.
2. Confirmar que `Stock.tsx` NO tiene errores nuevos.
3. Abrir `Stock.tsx` y verificar visualmente que los accesos `p.name`, `p.salePrice` (string), `p.stock`, `p.category.name`, `p.barcode` (bigint | null), `p.minStock`, `p.supplier.name` siguen siendo válidos con el tipo `ProductFromApi`. Todos deberían pasar porque:
   - `p.salePrice` es `string` → `formatMoney(p.salePrice)` recibe `string`. ✅
   - `p.barcode` es `bigint | null` → se compara con `null` y se llama `.toString()`. ✅
   - `p.category.name` y `p.supplier.name` están presentes. ✅

4. Si hay algún error de tipo en `Stock.tsx`, parar y revisar que los tipos definidos en el paso 6 coincidan con los del paso 3.

---

### Paso 10 — Smoke test en runtime

**Objetivo:** confirmar que nada en runtime se rompió (los cambios son solo de tipos, así que no debería romperse nada, pero verificamos).

1. Desde la raíz, arrancar la app en modo dev:
   ```bash
   node scripts/dev.js
   ```
2. Esperar a que abra la ventana de Electron.
3. Ir a la pestaña **Stock**. Debe cargar la lista de productos igual que antes (nombre, precio formateado en ARS, stock, categoría, código de barras, min stock, proveedor).
4. Si la tabla carga correctamente y no hay errores en la consola (DevTools), el cambio está OK.
5. Cerrar la app.

---

### Paso 11 — Revisión final de consistencia

**Objetivo:** dejar explícito que los dos archivos dicen lo mismo.

1. Abrir [electron/ipcContract.ts](electron/ipcContract.ts) y [renderer/src/electron-api.d.ts](renderer/src/electron-api.d.ts) en paralelo.
2. Ir método por método de `ElectronApi` y verificar que:
   - El nombre del método es idéntico.
   - La cantidad y orden de parámetros es idéntica.
   - Los tipos de parámetros son equivalentes (un input con el mismo shape).
   - El retorno (`Promise<X>`) es equivalente (mismo shape para `X`).
3. Ir tipo por tipo de salida (`CategoryFromApi`, `SupplierFromApi`, `BareProductFromApi`, `ProductFromApi`, `BareStockMovementFromApi`, `StockMovementFromApi`) y verificar que las propiedades coinciden una a una.
4. Si hay cualquier desalineación, corregirla en ambos archivos.

---

### Paso 12 — Checklist final

- [ ] `npx tsc --noEmit` en la raíz: 0 errores nuevos (idealmente 0 totales).
- [ ] `cd renderer && npx tsc --noEmit`: 0 errores nuevos.
- [ ] `electron/ipcContract.types-test.ts` existe y compila (incluyendo los `@ts-expect-error`).
- [ ] `renderer/src/electron-api.types-test.ts` existe y compila (incluyendo los `@ts-expect-error`).
- [ ] `electron/ipcContract.ts` y `renderer/src/electron-api.d.ts` declaran los mismos shapes.
- [ ] La pestaña Stock de la app sigue funcionando en runtime.
- [ ] No se modificó ningún archivo de lógica (repositorios, handlers, serializer, servicios).

---

## Qué hacer si algo falla

- **Si `tsc` se queja de que `BigInt` no es asignable a `string` o viceversa en algún lado:** revisar que el tipo en ambos archivos diga `bigint | null` para `barcode` (no `string`).
- **Si un `@ts-expect-error` se queja de que "la directiva no aplica":** significa que el tipo NO está restringiendo lo que debería. Revisar que `StockMovementFromApi.product` sea `BareProductFromApi` y no `ProductFromApi`.
- **Si `Stock.tsx` rompe:** lo más probable es que el tipo `salePrice` haya quedado mal. Debe ser `string`.
- **Si la app crashea en runtime al cargar productos:** los cambios son solo de tipos, NO debería pasar. Si pasa, revertir con `git checkout` y reportar.

---

## Archivos tocados por este plan

| Archivo | Acción |
|---|---|
| `electron/ipcContract.ts` | **Editar** (agregar tipos de salida, tipar retornos) |
| `renderer/src/electron-api.d.ts` | **Reescribir** (mirror del contrato) |
| `electron/ipcContract.types-test.ts` | **Crear** (test de tipos) |
| `renderer/src/electron-api.types-test.ts` | **Crear** (test de tipos) |

Nada más. No se tocan repositorios, handlers, servicios, ni el serializer.
