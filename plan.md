# Plan — F10: agregar ítem "general" (monto libre) al carrito

## Objetivo
Al presionar **F10** en la pantalla Sells, abrir un popup con un input de monto. Al confirmar, se agrega al carrito una **fila de tipo "general"** (sin producto asociado) con ese monto. Las filas "general" conviven con las filas de producto en la misma lista, son **editables en cantidad y monto**, se pueden **eliminar**, y **no** disparan alerta de stock.

## Decisiones de diseño (ya acordadas con el usuario)
1. Se extiende `CartLine` con un campo discriminador `kind: 'product' | 'general'`. `productId` / `product` pasan a ser opcionales (solo presentes cuando `kind === 'product'`).
2. Cada F10 agrega **una fila independiente** (no se acumulan). Id interno único para poder identificarlas.
3. Cantidad y monto editables inline (igual que un producto).
4. El popup F10 tiene **un único input** (monto). No hay descripción.
5. Validación: número **positivo** (> 0), admite decimales. **Acepta coma decimal además de punto** (es-AR).
6. **F10 es toggle**: abre/cierra el popup. `Enter` confirma, `Escape` cancela. Al cerrar (por cualquier motivo) el foco vuelve al input de barcode.
7. Las filas "general" **no tienen stock**, por lo tanto no se muestra la advertencia "Sin stock suficiente" ni se valida stock al agregar.
8. **Nombre de fila:** siempre el literal `"General"`. No editable.
9. **F10 y Electron:** se deshabilita el menú nativo de la ventana con `Menu.setApplicationMenu(null)` en `electron/main.ts` para evitar que F10 active el menú del sistema en Windows.
10. **Persistencia futura:** cuando se implemente `createSale`, `SaleItem.productId` será **opcional** en el schema de Prisma — una línea `'general'` se guardará con `productId = null`. Esto **no** se implementa en esta iteración (no se toca backend).

---

## Arquitectura — cambios de tipos

El carrito actualmente tiene esta forma:

```ts
type CartLine = {
  productId: number
  product: ProductFromApi
  quantity: number
  unitPrice: string
}
```

Queda así (**unión discriminada** por `kind`):

```ts
type ProductCartLine = {
  kind: 'product'
  lineId: string           // nuevo: id único de fila (también para filas de producto, por consistencia)
  productId: number
  product: ProductFromApi
  quantity: number
  unitPrice: string
}

type GeneralCartLine = {
  kind: 'general'
  lineId: string           // nuevo: id único de fila
  quantity: number
  unitPrice: string        // el monto ingresado por F10 (se trata igual que unitPrice de un producto)
}

type CartLine = ProductCartLine | GeneralCartLine
```

Notas clave:
- **`lineId`** reemplaza a `productId` como identificador de fila para `REMOVE` / `SET_QUANTITY` / `SET_UNIT_PRICE`. Esto permite tener múltiples filas "general" independientes y no rompe la identidad cuando hay repetición.
- Para filas de producto seguimos haciendo el merge por `productId` en `ADD` (regla existente: mismo producto → +1 cantidad). **El `lineId` se genera sólo cuando se crea la fila nueva y se preserva en el merge** (el spread `{ ...l, quantity: l.quantity + 1 }` lo mantiene intacto — no regenerarlo).
- El campo `unitPrice` se reutiliza para el monto "general" para que `lineTotal(line) = quantity * Number(unitPrice)` siga funcionando sin ramas.

---

## Lista de pasos (cada uno pensado para ser ejecutado y verificado aislado)

### Fase 0 — Preparación
- [ ] **Paso 0.1** Leer el archivo [renderer/src/Pages/Sells/types.ts](renderer/src/Pages/Sells/types.ts) y el [renderer/src/Pages/Sells/cartReducer.ts](renderer/src/Pages/Sells/cartReducer.ts) para familiarizarse con el estado actual. No modificar nada todavía.
- [ ] **Paso 0.2** Confirmar con `npm test` (o el script que corresponda en el proyecto) que los tests actuales pasan en verde **antes** de tocar nada. Si ya están rotos, detener y reportar.

### Fase 1 — Refactor de tipos + `lineId` para filas de producto (sin feature nueva aún)

El objetivo de esta fase es que el código siga haciendo **exactamente lo mismo que hoy**, pero internamente ya identifique las filas por `lineId` y use el discriminador `kind`. Esto aísla el refactor del feature nuevo.

- [ ] **Paso 1.1** En [renderer/src/Pages/Sells/types.ts](renderer/src/Pages/Sells/types.ts), reemplazar `CartLine` por la unión discriminada descripta arriba (`ProductCartLine | GeneralCartLine`). Dejar `CartState = { lines: CartLine[] }` como está.

- [ ] **Paso 1.2** Crear un util `renderer/src/Pages/Sells/lineId.ts` que exporte una función `newLineId(): string`. Implementación: usar `crypto.randomUUID()` si está disponible (`typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'`), si no, fallback a `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`.
  - Tests (crear `renderer/src/Pages/Sells/__tests__/lineId.test.ts`):
    - `newLineId()` devuelve string no vacío.
    - Dos llamadas consecutivas devuelven strings distintos.

- [ ] **Paso 1.3** Actualizar [renderer/src/Pages/Sells/cartReducer.ts](renderer/src/Pages/Sells/cartReducer.ts):
  - Cambiar las acciones para que `REMOVE`, `SET_QUANTITY`, `SET_UNIT_PRICE` acepten **`lineId: string`** en lugar de `productId: number`.
  - `ADD` sigue siendo `{ type: 'ADD'; product: ProductFromApi }` y sigue haciendo merge por `productId` (en líneas con `kind === 'product'`). Cuando crea una línea nueva, le asigna `kind: 'product'` y un `lineId` fresco con `newLineId()`.
  - **Importante — preservar `lineId` en el merge:** al sumar cantidad en un producto existente, mantener el mismo `lineId`. El spread actual `{ ...l, quantity: l.quantity + 1 }` ya lo hace — **no** reemplazar la línea con un objeto construido desde cero que regenere el id.
  - Para que TypeScript reconozca `productId` dentro de `ADD`, filtrar/estrechar antes: el merge debe recorrer sólo líneas con `kind === 'product'` antes de comparar `l.productId === action.product.id`.
  - `lineTotal` no cambia (sigue siendo `quantity * Number(unitPrice)`).

- [ ] **Paso 1.4** Actualizar los tests existentes en [renderer/src/Pages/Sells/__tests__/cartReducer.test.ts](renderer/src/Pages/Sells/__tests__/cartReducer.test.ts):
  - Reemplazar todo `productId` usado como identificador de fila en los dispatch de `REMOVE`/`SET_QUANTITY`/`SET_UNIT_PRICE` por `lineId`. Para obtenerlo, leerlo del estado después de `ADD` (`state.lines[0].lineId`).
  - Agregar asserts nuevos: después de `ADD`, `state.lines[0].kind === 'product'` y `typeof state.lines[0].lineId === 'string'` y `state.lines[0].lineId.length > 0`.
  - El test "ADD incrementa quantity en +1 cuando el producto ya existe" debe además verificar que el `lineId` de la fila **no cambia** entre las dos invocaciones (la identidad de la fila se preserva).
  - Donde el test actual usa `l.productId === ...` para encontrar la fila (ej. el test de 2 productos distintos), el acceso a `productId` ahora requiere estrechar el tipo: filtrar primero por `l.kind === 'product'`. Si TypeScript se queja, agregar el guard.
  - Todos los tests existentes deben seguir pasando.

- [ ] **Paso 1.5** Actualizar [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx):
  - Los handlers `onQuantityChange`, `onUnitPriceChange`, `onRemove` ahora reciben `lineId: string` como primer argumento en lugar de `productId: number`. Actualizar el tipo `Props`.
  - El `key` del `map` pasa a ser `line.lineId`.
  - Dentro del `map`, cuando acceda a `line.product.name` o `line.quantity > line.product.stock`, **solo** hacerlo si `line.kind === 'product'`. Para esta fase, si algún día `kind !== 'product'` no pasaría nada (porque no se crean aún), pero dejar los guards listos: si `line.kind === 'general'`, mostrar `"General"` como nombre y nunca la warning de stock.
  - El handler de `Delete` y del botón `✕` ahora llama `onRemove(line.lineId)`.
  - Los `onChange` de los inputs de cantidad y precio llaman `onQuantityChange(line.lineId, ...)` y `onUnitPriceChange(line.lineId, ...)`.

- [ ] **Paso 1.6** Actualizar [renderer/src/Pages/Sells/Sells.tsx](renderer/src/Pages/Sells/Sells.tsx) para que los dispatch `REMOVE` / `SET_QUANTITY` / `SET_UNIT_PRICE` usen `lineId` y los callbacks pasados a `<CartList>` tomen `lineId`. Es decir:
  ```tsx
  onQuantityChange={(id, q) => dispatch({ type: 'SET_QUANTITY', lineId: id, quantity: q })}
  onUnitPriceChange={(id, p) => dispatch({ type: 'SET_UNIT_PRICE', lineId: id, unitPrice: p })}
  onRemove={(id) => dispatch({ type: 'REMOVE', lineId: id })}
  ```
  - La lógica de alerta "Sin stock suficiente" dentro de `addProduct` sigue usando `newLine.quantity > product.stock`, pero se queda en `addProduct` (solo agregamos productos por ahora).
  - Ojo con la búsqueda del `newLine` tras `ADD`: actualmente se hace `nextState.lines.find(l => l.productId === product.id)`. Con la unión discriminada, filtrar primero por `kind === 'product'` para que TypeScript reconozca la propiedad `productId`, p.ej. `nextState.lines.find(l => l.kind === 'product' && l.productId === product.id)`.

- [ ] **Paso 1.7** Correr `npm test`. Todos los tests deben pasar. Arrancar la app en dev y verificar manualmente que el flujo actual sigue funcionando: escanear → se agrega, repetir → suma cantidad, cambiar cantidad inline, cambiar precio inline, eliminar con ✕ y con `Delete`. **Si algo se rompió, parar y depurar antes de seguir.**

### Fase 2 — Reducer: acción `ADD_GENERAL` + util de normalización

- [ ] **Paso 2.1** Crear `renderer/src/Pages/Sells/amount.ts` con dos helpers puros:
  ```ts
  // Normaliza el input del usuario: trim, cambia coma decimal por punto.
  export function normalizeAmount(raw: string): string

  // Valida que el resultado normalizado sea un número finito > 0.
  // Devuelve el string normalizado si es válido, o un objeto de error.
  export function validateGeneralAmount(raw: string):
    | { ok: true; value: string }
    | { ok: false; error: string }
  ```
  Reglas:
  - `normalizeAmount('  150,50 ')` → `'150.50'`.
  - `normalizeAmount('150.50')` → `'150.50'` (sin cambios).
  - `normalizeAmount('')` → `''`.
  - Si el string tiene **varias comas o puntos**, no intentar "adivinar": `validateGeneralAmount` lo rechaza por no ser número finito tras `Number(...)`.
  - `validateGeneralAmount`: primero `normalizeAmount`, después chequear `n = Number(normalized)`: válido si `Number.isFinite(n) && n > 0`. El `value` devuelto en caso `ok` es el **string normalizado** (con punto), no el original.
  - Mensajes de error: para vacío → `"Ingresá un monto"`, para los demás casos inválidos → `"Ingresá un monto positivo"`.

- [ ] **Paso 2.2** Crear tests en `renderer/src/Pages/Sells/__tests__/amount.test.ts`:
  - `validateGeneralAmount('500')` → `{ ok: true, value: '500' }`
  - `validateGeneralAmount('150.50')` → `{ ok: true, value: '150.50' }`
  - `validateGeneralAmount('150,50')` → `{ ok: true, value: '150.50' }` (coma → punto)
  - `validateGeneralAmount(' 200 ')` → `{ ok: true, value: '200' }` (trim)
  - `validateGeneralAmount(' 1.234,56 ')` → `{ ok: false, ... }` (múltiples separadores, no adivinamos)
  - `validateGeneralAmount('')` → `{ ok: false, error: 'Ingresá un monto' }`
  - `validateGeneralAmount('0')` → `{ ok: false, ... }`
  - `validateGeneralAmount('-3')` → `{ ok: false, ... }`
  - `validateGeneralAmount('-3,5')` → `{ ok: false, ... }`
  - `validateGeneralAmount('abc')` → `{ ok: false, ... }`
  - `validateGeneralAmount('NaN')` → `{ ok: false, ... }`

- [ ] **Paso 2.3** En [renderer/src/Pages/Sells/cartReducer.ts](renderer/src/Pages/Sells/cartReducer.ts), agregar una acción nueva:
  ```ts
  | { type: 'ADD_GENERAL'; amount: string }
  ```
  Comportamiento:
  - Llamar `validateGeneralAmount(action.amount)` (import desde `./amount`). Si `!ok`, devolver el estado tal cual (no agregar nada).
  - Si es válido: crear una `GeneralCartLine` con `kind: 'general'`, `lineId: newLineId()`, `quantity: 1`, `unitPrice: value` (el string **normalizado** que devolvió la validación, no el input crudo). Pushear al final del array `lines`.
  - **Siempre agrega una fila nueva** — no hay merge entre filas general, aunque el monto sea el mismo.

- [ ] **Paso 2.4** Agregar tests en `cartReducer.test.ts`:
  - `ADD_GENERAL` con `amount: '500'` agrega una fila nueva con `kind === 'general'`, `quantity === 1`, `unitPrice === '500'`, `lineId` string no vacío.
  - `ADD_GENERAL` con `amount: '150,50'` agrega fila con `unitPrice === '150.50'` (normalizado) y `lineTotal` devuelve `150.5`.
  - Dos `ADD_GENERAL` consecutivos con el mismo `amount` producen **dos filas distintas** (`lineId` distintos, `lines.length === 2`).
  - `ADD_GENERAL` con `amount: '0'` no modifica el estado (`next === state`).
  - `ADD_GENERAL` con `amount: '-10'` no modifica el estado.
  - `ADD_GENERAL` con `amount: ''` no modifica el estado.
  - `ADD_GENERAL` con `amount: 'abc'` no modifica el estado.
  - `ADD_GENERAL` con `amount: '150.50'` agrega fila con `unitPrice === '150.50'` y `lineTotal` devuelve `150.5`.
  - Una fila general puede ser eliminada con `REMOVE` pasando su `lineId`.
  - `SET_QUANTITY` sobre una fila general con `quantity: 3` actualiza a 3 (funciona igual que con productos).
  - `SET_UNIT_PRICE` sobre una fila general con `unitPrice: '200'` actualiza el monto.
  - Después de un `ADD` (producto) y un `ADD_GENERAL`, el estado contiene ambas filas y cada una es modificable/removible por su `lineId` sin afectar a la otra.

- [ ] **Paso 2.5** Correr `npm test`. Verificar verde. El reducer ya soporta filas general pero la UI todavía no las dispara.

### Fase 3 — Componente `GeneralAmountPopup`

- [ ] **Paso 3.1** Crear `renderer/src/Pages/Sells/GeneralAmountPopup.tsx`. Props:
  ```ts
  type Props = {
    open: boolean
    onClose: () => void
    onConfirm: (amount: string) => void   // recibe el string normalizado (con punto)
  }
  ```
  Comportamiento:
  - Si `!open`, devuelve `null`.
  - Render: overlay (reusar clases `search-popup__overlay` / `search-popup__container` para mantener consistencia; es aceptable, no exige CSS nuevo).
  - Título `<h2>Monto general</h2>`.
  - Un único `<input type="text" inputMode="decimal">` con placeholder `"Monto (ej: 1500,50)"`.
    - **Nota importante:** se usa `type="text"` (no `type="number"`) porque `type="number"` en Chromium rechaza la coma como separador decimal dependiendo del locale y no permite leer el valor crudo para normalizar. `inputMode="decimal"` da el teclado numérico en mobile y sigue permitiendo coma.
  - Usa estado local `const [value, setValue] = useState('')` y `const [error, setError] = useState<string | null>(null)`. Cuando `open` pasa de `false` a `true`, resetea ambos a vacío/null (usar un `useEffect` que dependa de `open`).
  - Auto-foco al input al abrir (patrón igual al `SearchPopup`: `useEffect` con `setTimeout(() => inputRef.current?.focus(), 0)` cuando `open` pasa a true).
  - `onKeyDown` del input:
    - `Enter`: llamar `validateGeneralAmount(value)` (import desde `./amount`). Si `ok`, llamar `onConfirm(result.value)` (el string normalizado) y luego `onClose()`. Si `!ok`, setear `error` con `result.error` y **no cerrar**.
    - `Escape`: `onClose()`.
  - Click en overlay (fuera del container): `onClose()` (mismo patrón que `SearchPopup`).
  - Mostrar `error` (si existe) con clase `search-popup__error`.
  - **No** duplicar la lógica de validación en este archivo: siempre delegar a `validateGeneralAmount` de `./amount`.

- [ ] **Paso 3.2** Crear tests en `renderer/src/Pages/Sells/__tests__/GeneralAmountPopup.test.tsx`.
  - **El proyecto ya tiene testing tools configuradas** (verificado en [renderer/package.json](renderer/package.json)): `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` y `happy-dom` como entorno DOM (se usa `happy-dom` en lugar de `jsdom`, pero la API de RTL es idéntica). Estos tests **no son opcionales** — hay que escribirlos.
  - Si al correr `npm test` el entorno DOM no está activado (vitest por defecto usa `node`), confirmar que `vitest.config.ts` / `vite.config.ts` del renderer tenga `test.environment: 'happy-dom'`. Si no lo tiene, agregarlo en este mismo paso (es requisito para que `render(...)` funcione).
  - Tests de interacción obligatorios:
    - Con `open=false` no renderiza nada.
    - Con `open=true` renderiza el input y `<h2>Monto general</h2>`.
    - Escribir `"500"` + Enter → llama `onConfirm('500')` y luego `onClose()`.
    - Escribir `"150,50"` + Enter → llama `onConfirm('150.50')` (normalizado con punto) y luego `onClose()`.
    - Escribir `""` + Enter → **no** llama `onConfirm`, **no** llama `onClose`, y aparece mensaje de error visible.
    - Escribir `"-5"` + Enter → no llama `onConfirm`, muestra error.
    - Escribir `"abc"` + Enter → no llama `onConfirm`, muestra error.
    - Escribir `"150.50"` + Enter → llama `onConfirm('150.50')`.
    - Tecla Escape → llama `onClose`, no llama `onConfirm`.
    - Al cambiar de `open=false` a `open=true`, el value del input arranca en `""` y no hay error visible.

- [ ] **Paso 3.3** Correr `npm test`. Verificar verde.

### Fase 4 — Deshabilitar menú nativo de Electron (necesario para F10 en Windows)

- [ ] **Paso 4.1** En [electron/main.ts](electron/main.ts):
  - Importar `Menu` de `electron` (agregar `Menu` al import existente: `import { app, BrowserWindow, ipcMain, Menu } from "electron"`).
  - **Ubicación exacta de la llamada:** dentro del callback de `app.whenReady().then(...)`, **antes** de `createWindow()` y antes de `registerIpcHandlers(ipcMain)`. Es decir:
    ```ts
    app.whenReady().then(() => {
      Menu.setApplicationMenu(null)
      registerIpcHandlers(ipcMain)
      createWindow()
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })
    ```
    Se pone antes de `createWindow()` para que la ventana nazca ya sin menú (evita un parpadeo/flash del menú al iniciar). El estado actual de [electron/main.ts](electron/main.ts) **no** deshabilita el menú en ningún lado, por lo que no hay duplicación.
  - **Verificar** que no haya código existente que dependa del menú (atajos del sistema, "Ayuda", etc.). Si lo hay, detener y reportar antes de continuar. *(Revisado al momento de redactar este plan: no hay.)*

- [ ] **Paso 4.2** Recompilar el main process y reiniciar Electron. Smoke manual: apretar F10 en la app; no debe aparecer ningún menú nativo ni tomar foco ninguna barra del sistema. Si el menú aparece igual, detener y reportar (en ese caso habría que interceptar también el `before-input-event` de `webContents`).

### Fase 5 — Integración en `Sells.tsx` (F10 + render del popup)

- [ ] **Paso 5.1** En [renderer/src/Pages/Sells/Sells.tsx](renderer/src/Pages/Sells/Sells.tsx):
  - Importar `GeneralAmountPopup`.
  - Agregar `const [generalPopupOpen, setGeneralPopupOpen] = useState(false)`.
  - Agregar un `prevGeneralOpenRef = useRef(false)` paralelo al existente `prevOpenRef` para devolver foco al barcode cuando se cierra el popup de monto general (mismo patrón que ya se usa con `popupOpen` / `prevOpenRef`).
  - Reemplazar el `useEffect` de teclas globales (el que hoy maneja F2) para que ambos popups sean mutuamente excluyentes. Quedando así:
    ```ts
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'F2') {
          e.preventDefault()
          setPopupOpen(prev => {
            const next = !prev
            if (next) setGeneralPopupOpen(false)
            return next
          })
        } else if (e.key === 'F10') {
          e.preventDefault()
          setGeneralPopupOpen(prev => {
            const next = !prev
            if (next) setPopupOpen(false)
            return next
          })
        }
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }, [])
    ```
    **Importante:** este cambio es explícito — no dejar el F2 con la forma simple anterior (`setPopupOpen(prev => !prev)`) porque no cerraría el popup general cuando se aprieta F2.
  - Agregar un `useEffect` simétrico al de `popupOpen` para devolver foco al barcode cuando `generalPopupOpen` pasa de `true` a `false`:
    ```ts
    useEffect(() => {
      if (prevGeneralOpenRef.current && !generalPopupOpen) {
        setTimeout(() => barcodeInputRef.current?.focus(), 0)
      }
      prevGeneralOpenRef.current = generalPopupOpen
    }, [generalPopupOpen])
    ```
  - Agregar handler `handleConfirmGeneral(amount: string)` que dispara `dispatch({ type: 'ADD_GENERAL', amount })`. **No** cerrar el popup acá — `GeneralAmountPopup` ya llama `onClose` después de `onConfirm`. Tampoco validar acá — ya vino validado del popup.
  - Renderizar `<GeneralAmountPopup open={generalPopupOpen} onClose={() => setGeneralPopupOpen(false)} onConfirm={handleConfirmGeneral} />` al final del `return`, al lado del `SearchPopup` existente.

- [ ] **Paso 5.2** Smoke test rápido sólo de F10: apretar F10 con el popup cerrado → abre; F10 de nuevo → cierra. F2 con general abierto → cierra general, abre búsqueda. F10 con búsqueda abierta → cierra búsqueda, abre general. Si algo no se comporta así, volver al Paso 5.1.

- [ ] **Paso 5.3** Interacción con `BarcodeInput` — **nota de verificación** (no requiere cambios, pero confirmar):
  - [renderer/src/Pages/Sells/BarcodeInput.tsx](renderer/src/Pages/Sells/BarcodeInput.tsx) **no captura F2 ni F10 en su `onKeyDown`** (solo maneja `Enter`). El botón `F2` dentro de `BarcodeInput` dispara `onRequestSearch` por click, no por tecla. Por lo tanto:
    - El `window.addEventListener('keydown', ...)` agregado en `Sells.tsx` para F2/F10 es la **única** fuente que toggleará los popups via teclado.
    - El `e.preventDefault()` sobre F2/F10 en el listener global **no rompe** nada del flujo del scanner (el scanner manda Enter, no F-keys).
    - No hay riesgo de doble-toggle ni de que el input de barcode "se coma" la tecla: el listener global corre siempre, incluso con foco en el input.
  - Verificar manualmente: con foco dentro del input de barcode, apretar F2 → debe abrir el popup de búsqueda (igual que antes). Apretar F10 → debe abrir el popup de monto general. Si alguno no funciona con foco en barcode, revisar si algún handler de `BarcodeInput` está haciendo `stopPropagation`.

### Fase 6 — Render de fila "general" en `CartList`

- [ ] **Paso 6.1** En [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx), dentro del `map`:
  - Calcular `const name = line.kind === 'product' ? line.product.name : 'General'`.
  - Calcular `const overStock = line.kind === 'product' && line.quantity > line.product.stock`.
  - Renderizar `name` en la primera celda y la warning **solo** si `overStock` (para filas general nunca aparece).
  - Los inputs de cantidad y precio unitario **no cambian** (funcionan igual para ambas variantes porque el reducer ya soporta `SET_QUANTITY` / `SET_UNIT_PRICE` por `lineId`).
  - El botón ✕ y la tecla `Delete` llaman `onRemove(line.lineId)` igual que antes.

- [ ] **Paso 6.2** (Opcional cosmético) En [renderer/src/Pages/Sells/Sells.css](renderer/src/Pages/Sells/Sells.css), agregar una clase visual para distinguir filas general (p.ej. un badge o un color de fondo sutil). **No es requisito funcional** — puede saltearse si se quiere priorizar velocidad.

### Fase 7 — Verificación end-to-end

- [ ] **Paso 7.1** Correr `npm test`. Todos verdes.
- [ ] **Paso 7.2** Correr TypeScript sin emitir (`npx tsc --noEmit` o el script equivalente del renderer). Sin errores.
- [ ] **Paso 7.3** Arrancar la app en dev y ejecutar este **smoke test manual** (checklist):
  1. En la pantalla Sells, con el carrito vacío, apretar **F10** → aparece el popup "Monto general". **El menú nativo de Electron NO aparece** (gracias a la Fase 4).
  2. Apretar **F10** de nuevo → el popup se cierra, el foco vuelve al input de código de barras.
  3. F10 → escribir `500` → Enter → se cierra el popup, aparece una fila **"General"** con cantidad 1, precio unitario 500, total $500. El foco está en el input de barcode.
  4. F10 → escribir `150,50` (con coma) → Enter → agrega fila "General" con precio unitario `150.50` y total $150,50.
  5. F10 → escribir `0` → Enter → **no se agrega nada**, aparece un mensaje de error en el popup y queda abierto.
  6. F10 → escribir `-50` → Enter → no se agrega, error visible.
  7. F10 → escribir `abc` → Enter → no se agrega, error visible.
  8. F10 → Escape → el popup se cierra sin agregar nada, foco vuelve al barcode.
  9. Con fila "General" en el carrito: editar cantidad a 3 → total pasa a `3 × unitPrice`.
  10. Con fila "General" en el carrito: editar el monto (unitPrice) a `200` → total se recalcula.
  11. Click ✕ en la fila General → se elimina.
  12. F10 dos veces (agregar dos filas generales con `100` y `200`) → aparecen **dos filas independientes**. Eliminar una no afecta a la otra.
  13. Con el popup de búsqueda (F2) abierto, apretar F10 → el de búsqueda se cierra y abre el de monto general. Simétrico: con el de monto general abierto, F2 lo cierra y abre el de búsqueda.
  14. Agregar un producto por scanner + agregar una fila general → ambos conviven en el carrito. Editar/eliminar uno no afecta al otro. La fila "General" **nunca** muestra la advertencia "Sin stock suficiente", incluso si el producto sí la muestra.
  15. Ninguna fila "General" muestra nombre de producto ni referencia al barcode.
  16. Click en otra parte de la app (Home/Stock) y volver a Sells → el carrito se resetea (comportamiento conocido, no es un bug).

- [ ] **Paso 7.4** Si algún ítem del smoke test falla, volver al paso correspondiente y corregir antes de marcar la tarea como completa.

---

## Archivos que se van a crear
- `renderer/src/Pages/Sells/lineId.ts`
- `renderer/src/Pages/Sells/amount.ts`
- `renderer/src/Pages/Sells/GeneralAmountPopup.tsx`
- `renderer/src/Pages/Sells/__tests__/lineId.test.ts`
- `renderer/src/Pages/Sells/__tests__/amount.test.ts`
- `renderer/src/Pages/Sells/__tests__/GeneralAmountPopup.test.tsx` *(opcional si no hay RTL — ver Paso 3.2)*

## Archivos que se van a modificar
- [renderer/src/Pages/Sells/types.ts](renderer/src/Pages/Sells/types.ts)
- [renderer/src/Pages/Sells/cartReducer.ts](renderer/src/Pages/Sells/cartReducer.ts)
- [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx)
- [renderer/src/Pages/Sells/Sells.tsx](renderer/src/Pages/Sells/Sells.tsx)
- [renderer/src/Pages/Sells/__tests__/cartReducer.test.ts](renderer/src/Pages/Sells/__tests__/cartReducer.test.ts)
- [electron/main.ts](electron/main.ts) — `Menu.setApplicationMenu(null)` (Fase 4)
- [renderer/src/Pages/Sells/Sells.css](renderer/src/Pages/Sells/Sells.css) *(opcional)*

## Archivos que **no** se tocan
- Nada de `backend/` (el cambio a `SaleItem.productId` opcional es iteración futura, cuando se implemente `createSale`).
- Ningún canal IPC nuevo: las filas "general" son puramente renderer y solo se materializarán cuando se implemente la creación de `Sale`/`SaleItem`.

---

## Notas para el ejecutor
- El riesgo principal está en la **Fase 1** (refactor de `productId` → `lineId`). Si el Paso 1.7 (smoke de regresión) falla, **no avanzar** hasta que el flujo actual vuelva a estar verde. Los pasos 2 en adelante asumen que `lineId` ya funciona.
- Mantener los cambios de cada paso en commits separados facilita revertir si algo se rompe.
- No introducir lógica de "total de la venta" en esta iteración — sigue siendo una iteración aparte (ver `context.md` → "Flujo de creación de una venta").
- No tocar `addProduct`/flujo de scanner salvo para adaptarse al cambio de firmas de dispatch.
- **No** duplicar la validación de monto: siempre a través de `validateGeneralAmount` de `amount.ts`.
