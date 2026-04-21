# Plan: Buscador de productos + carrito para la pantalla de Ventas (MVP iter. 1)

> Plan diseñado para que lo ejecute un modelo de AI de menor potencia. Cada paso es pequeño, concreto y verificable. No se toca el backend.

---

## 0. Resumen del objetivo

Implementar la primera iteración de la pantalla `Sells`: un buscador de productos (por código de barras + por nombre) y un carrito editable con cantidad y precio unitario. No incluye pagos ni confirmación/creación de `Sale` — esos pasos son de iteraciones futuras.

Referencia de decisiones de comportamiento: ver sección **"Iteración actual (en curso): buscador + carrito de productos"** en [context.md](context.md).

---

## 1. Arquitectura propuesta

Crear un módulo nuevo en el renderer bajo [renderer/src/Pages/Sells/](renderer/src/Pages/Sells/):

```
renderer/src/Pages/Sells/
├── Sells.tsx              # Contenedor: layout + orquestación
├── Sells.css              # Estilos
├── BarcodeInput.tsx       # Input superior, maneja Enter (scan) y F2
├── SearchPopup.tsx        # Ventana emergente con buscador y tabla
├── CartList.tsx           # Lista (grid) del carrito
├── searchProducts.ts      # Función que combina getByBarcode + listProducts
├── cartReducer.ts         # Lógica pura del estado del carrito
├── types.ts               # CartLine y tipos auxiliares
└── __tests__/
    ├── cartReducer.test.ts
    └── searchProducts.test.ts
```

Además:
- Modificar [renderer/src/App.tsx](renderer/src/App.tsx) para renderizar `<Sells />` cuando `content === "sells"`.
- Agregar Vitest al proyecto (si todavía no está).

---

## 2. Pasos

### Paso 2.0 — Exportar los tipos del API en `electron-api.d.ts`

**Objetivo:** que `ProductFromApi`, `CategoryFromApi`, `SupplierFromApi`, `BareProductFromApi` y `BareStockMovementFromApi` se puedan importar desde otros archivos del renderer. Hoy están declarados sin `export`, y como el archivo tiene `export {}` al final, no son ni globales ni importables.

**Archivo:** [renderer/src/electron-api.d.ts](renderer/src/electron-api.d.ts)

**Acción concreta:** agregar `export` delante de la declaración `type` de cada uno de estos tipos:
- `CategoryFromApi`
- `SupplierFromApi`
- `BareProductFromApi`
- `ProductFromApi`
- `BareStockMovementFromApi`
- `StockMovementFromApi`

Ejemplo:
```ts
export type ProductFromApi = BareProductFromApi & {
  category: CategoryFromApi
  supplier: SupplierFromApi
}
```

**Verificación:** `tsc --noEmit` dentro de `renderer/` debe seguir pasando y un archivo cualquiera del renderer debe poder hacer `import type { ProductFromApi } from './electron-api'` sin error.

> Nota: hay que importar desde `'./electron-api'` (sin la extensión `.d.ts`). Los archivos `.d.ts` son resueltos automáticamente por TypeScript.

---

### Paso 2.1 — Configurar Vitest en el renderer

**Objetivo:** poder correr tests unitarios con `npm test`.

**Archivos que se tocan:**
- [renderer/package.json](renderer/package.json)
- [renderer/vite.config.ts](renderer/vite.config.ts) (o crear `vitest.config.ts` si preferís aislarlo)
- Nuevo: `renderer/src/setupTests.ts`

**Acciones concretas:**
1. En la carpeta `renderer/`, instalar las dependencias de desarrollo:
   ```
   npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event happy-dom
   ```
2. En `renderer/package.json`, agregar en `"scripts"`:
   ```json
   "test": "vitest run",
   "test:watch": "vitest"
   ```
3. En `renderer/vite.config.ts`:
   - Cambiar el import `import { defineConfig } from 'vite'` por `import { defineConfig } from 'vitest/config'` (así el tipo de config incluye `test` y TypeScript no se queja).
   - Agregar el bloque `test` dentro de la llamada a `defineConfig`:
   ```ts
   test: {
     environment: 'happy-dom',
     globals: true,
     setupFiles: ['./src/setupTests.ts'],
     include: ['src/**/*.test.{ts,tsx}']
   }
   ```
4. Crear [renderer/src/setupTests.ts](renderer/src/setupTests.ts) con:
   ```ts
   import '@testing-library/jest-dom/vitest'
   ```
5. En [renderer/tsconfig.app.json](renderer/tsconfig.app.json), agregar `"vitest/globals"` al array `types` de `compilerOptions`. Hoy el array es `["vite/client"]`; debe quedar `["vite/client", "vitest/globals"]`.

> Nota: no tocar el `tsconfig.json` raíz — es sólo un orquestador con `references` y no tiene `compilerOptions`.

**Verificación:** correr `npm test` en `renderer/`. Debe imprimir "No test files found" sin error de configuración.

---

### Paso 2.2 — Definir tipos del carrito

**Archivo:** crear [renderer/src/Pages/Sells/types.ts](renderer/src/Pages/Sells/types.ts).

**Contenido:**
```ts
import type { ProductFromApi } from '../../electron-api'

export type CartLine = {
  productId: number
  product: ProductFromApi
  quantity: number
  unitPrice: string   // string para respetar la serialización Decimal -> string
}

export type CartState = {
  lines: CartLine[]
}
```

> **Prerrequisito:** este import requiere que el Paso 2.0 ya haya agregado `export` a `ProductFromApi` en [renderer/src/electron-api.d.ts](renderer/src/electron-api.d.ts).

---

### Paso 2.3 — Implementar `cartReducer` (lógica pura del carrito)

**Archivo:** crear [renderer/src/Pages/Sells/cartReducer.ts](renderer/src/Pages/Sells/cartReducer.ts).

**Contrato:**
```ts
export type CartAction =
  | { type: 'ADD'; product: ProductFromApi }
  | { type: 'REMOVE'; productId: number }
  | { type: 'SET_QUANTITY'; productId: number; quantity: number }
  | { type: 'SET_UNIT_PRICE'; productId: number; unitPrice: string }

export const initialCart: CartState = { lines: [] }

export function cartReducer(state: CartState, action: CartAction): CartState
```

**Reglas de implementación (muy explícitas):**

- `ADD`:
  - Si existe una `line` con `productId === action.product.id` → devolver nuevo estado con esa `line` con `quantity + 1` (no mutar).
  - Si no existe → agregar nueva `line` con:
    - `productId: action.product.id`
    - `product: action.product`
    - `quantity: 1`
    - `unitPrice: action.product.salePrice` (tal cual llega, string)

- `REMOVE`:
  - Devolver estado con `lines` filtradas sacando la de `productId`.

- `SET_QUANTITY` (el orden de estas reglas importa — aplicarlas en este orden):
  1. **Validar primero:** si `Number.isFinite(quantity) === false` (cubre `NaN` e `Infinity`) → devolver el state sin cambios.
  2. **Después normalizar `REMOVE`:** si `quantity < 1` → tratar como `REMOVE` (no permitir 0 ni negativos).
  3. Si pasó ambas validaciones: redondear con `Math.floor(quantity)` (cantidades enteras) y actualizar solo la línea correspondiente.

  > No invertir el orden: si se chequea `quantity < 1` antes de `Number.isFinite`, `NaN < 1` es `false` y el caso NaN se cuela al resto de la lógica.

- `SET_UNIT_PRICE`:
  - Si `unitPrice` es `''` → aceptar string vacío (el input puede estar vacío mientras el usuario edita).
  - Si `unitPrice` no es vacío y `Number(unitPrice)` no es finito o es negativo → devolver state sin cambios.
  - Actualizar solo la línea correspondiente.

**Helper adicional** (exportar desde el mismo archivo):
```ts
export function lineTotal(line: CartLine): number {
  const price = Number(line.unitPrice)
  if (!Number.isFinite(price)) return 0
  return price * line.quantity
}
```

---

### Paso 2.4 — Tests de `cartReducer`

**Archivo:** crear [renderer/src/Pages/Sells/__tests__/cartReducer.test.ts](renderer/src/Pages/Sells/__tests__/cartReducer.test.ts).

**Casos de prueba obligatorios** (uno `it` por caso):

1. `ADD` agrega una nueva línea con `quantity = 1` cuando el carrito está vacío.
2. `ADD` incrementa `quantity` en +1 cuando el producto ya existe (no crea fila nueva).
3. `ADD` al agregar un producto distinto, lo agrega como fila nueva y mantiene la anterior.
4. `REMOVE` elimina la línea correspondiente y deja intactas las demás.
5. `REMOVE` con un `productId` inexistente no cambia el estado.
6. `SET_QUANTITY` con valor positivo actualiza la cantidad.
7. `SET_QUANTITY` con `0` elimina la línea.
8. `SET_QUANTITY` con `-3` elimina la línea.
9. `SET_QUANTITY` con `NaN` no modifica el estado.
10. `SET_QUANTITY` con `2.7` guarda `2` (Math.floor).
11. `SET_UNIT_PRICE` con string vacío deja `unitPrice: ''` en la línea.
12. `SET_UNIT_PRICE` con `"150.50"` actualiza el precio.
13. `SET_UNIT_PRICE` con `"-1"` no cambia el estado.
14. `SET_UNIT_PRICE` con `"abc"` no cambia el estado.
15. `lineTotal` devuelve `quantity * Number(unitPrice)` con precio válido.
16. `lineTotal` devuelve `0` cuando `unitPrice === ''`.
17. **Inmutabilidad:** verificar con `toBe` / `not.toBe` que el estado devuelto es un objeto distinto al de entrada (en los casos que sí cambian).

**Fixture helper sugerido** (dentro del test):
```ts
const mockProduct = (id: number, overrides: Partial<ProductFromApi> = {}): ProductFromApi => ({
  id,
  name: `Producto ${id}`,
  barcode: BigInt(1000 + id),
  purchasePrice: '50.00',
  salePrice: '100.00',
  stock: 10,
  minStock: 0,
  createdAt: new Date(),
  categoryId: 1,
  supplierId: 1,
  category: { id: 1, name: 'Cat' },
  supplier: { id: 1, name: 'Prov', phone: null, notes: null },
  ...overrides
})
```

**Verificación:** `npm test` debe pasar todos los casos antes de seguir.

---

### Paso 2.5 — Implementar `searchProducts` (combina barcode + nombre)

**Archivo:** crear [renderer/src/Pages/Sells/searchProducts.ts](renderer/src/Pages/Sells/searchProducts.ts).

**Firma:**
```ts
export async function searchProducts(query: string): Promise<ProductFromApi[]>
```

**Lógica exacta:**
1. Si `query.trim() === ''` → devolver `[]`.
2. Ejecutar siempre `const byName = await window.api.listProducts({ nameContains: query.trim(), take: 50 })`.
3. Si `/^\d+$/.test(query.trim())` (sólo dígitos) → ejecutar además `await window.api.getProductByBarcode(query.trim())` dentro de un `try/catch` (si falla, ignorar).
4. Si `getProductByBarcode` devolvió un producto y su `id` **no** está ya en `byName`, anteponerlo: `return [byBarcode, ...byName]`.
5. Si no, devolver `byName` tal cual.

> **Por qué el `try/catch`:** `getProductByBarcode` puede tirar si el barcode excede el rango de `BigInt` esperado; silenciamos y caemos al resultado por nombre.

---

### Paso 2.6 — Tests de `searchProducts`

**Archivo:** crear [renderer/src/Pages/Sells/__tests__/searchProducts.test.ts](renderer/src/Pages/Sells/__tests__/searchProducts.test.ts).

**Setup:** `happy-dom` ya provee un `window` funcional; hay que **adjuntar** `api` como propiedad sin reemplazar el objeto entero. En `beforeEach`:

```ts
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  (window as any).api = {
    listProducts: vi.fn(),
    getProductByBarcode: vi.fn()
  }
})
```

> **No usar** `vi.stubGlobal('window', { api: ... })`: eso sustituye el objeto `window` completo y rompe el DOM provisto por happy-dom (se pierden `document`, `addEventListener`, etc.). Mutar la propiedad `window.api` es suficiente y seguro.

Dentro de cada test, castear para leer los mocks: `(window.api.listProducts as ReturnType<typeof vi.fn>).mockResolvedValue([...])`.

**Casos obligatorios:**
1. Query vacía → devuelve `[]` sin llamar a la API.
2. Query con sólo letras (`"leche"`) → llama sólo a `listProducts` con `{ nameContains: 'leche', take: 50 }`, **no** llama a `getProductByBarcode`.
3. Query numérica (`"1234"`) → llama a ambos. Si `getProductByBarcode` devuelve un producto nuevo, queda **primero** en el array.
4. Query numérica → si el producto devuelto por barcode también aparece en `byName`, no se duplica.
5. `getProductByBarcode` tira error → no rompe, devuelve `byName`.
6. Query con espacios (`"  leche  "`) → se trimmean antes de consultar.
7. Query mixta (`"leche 1L"`) → tratada como nombre (no se llama a barcode).

**Verificación:** `npm test` pasa todos.

---

### Paso 2.7 — Implementar `BarcodeInput`

**Archivo:** crear [renderer/src/Pages/Sells/BarcodeInput.tsx](renderer/src/Pages/Sells/BarcodeInput.tsx).

**Props:**
```ts
type Props = {
  onScan: (barcode: string) => void       // disparado al apretar Enter
  onRequestSearch: () => void             // disparado al apretar F2 o el botón
}
```

**Comportamiento:**
- Un `<input type="text">` con `autoFocus` y `placeholder="Código de barras"`.
- Estado interno controlado `value`.
- `onKeyDown`:
  - `Enter`: si `value.trim()` no vacío → llamar `onScan(value.trim())` y limpiar el input (`setValue('')`).
  - **No** manejar `F2` acá. El toggle del popup lo maneja únicamente el listener global de `Sells` (ver Paso 2.10). Si acá también llamáramos `onRequestSearch()` + el listener global toggleara, los dos updates se batchean y el popup termina cerrado.
- `<button type="button">F2</button>` al lado que llama `onRequestSearch()` (el padre lo tiene definido como toggle, así que el botón abre y cierra).
- Exponer un método para que el padre pueda re-enfocar el input tras cerrar el popup. **Implementación:** usar `forwardRef` + `useImperativeHandle` para exponer `{ focus(): void }`.

---

### Paso 2.8 — Implementar `SearchPopup`

**Archivo:** crear [renderer/src/Pages/Sells/SearchPopup.tsx](renderer/src/Pages/Sells/SearchPopup.tsx).

**Props:**
```ts
type Props = {
  open: boolean
  onClose: () => void
  onSelect: (product: ProductFromApi) => void
}
```

**Estructura visual** (coincide con el sketch):
- Overlay fijo a pantalla completa, fondo semi-transparente.
- Contenedor centrado con:
  - Título "Buscador".
  - Input de búsqueda (`autoFocus` cuando `open` pasa de `false` a `true`).
  - Tabla con encabezados `Código de barras | Nombre | Stock`.
  - Filas de resultados. La fila seleccionada (índice `selectedIndex`) tiene clase `search-popup__row--selected`.

**Estado interno:**
- `query: string`
- `results: ProductFromApi[]`
- `selectedIndex: number` (empieza en `0`; resetear a `0` cada vez que cambia `results`)
- `loading: boolean`
- `error: string | null`

**Búsqueda con debounce:**
- `useEffect` con dependencia `[query]`.
- Dentro: `setTimeout(async () => { ... }, 250)`. Cancelar con `clearTimeout` en la cleanup function.
- Dentro del timeout: `setLoading(true)`, llamar `searchProducts(query)`, setear resultados, `setLoading(false)`. Capturar errores en `error`.
- Usar flag `cancelled` para evitar setear estado tras unmount.

**Teclado (handler `onKeyDown` en el input):**
- `ArrowDown`: `setSelectedIndex(i => Math.min(i + 1, results.length - 1))`; `preventDefault`.
- `ArrowUp`: `setSelectedIndex(i => Math.max(i - 1, 0))`; `preventDefault`.
- `Enter`:
  - Si `/^\d+$/.test(query.trim())` (query puramente numérica — caso típico del scanner dentro del popup) → **no hacer nada**. El producto queda listado en los resultados; si el usuario lo quiere en el carrito debe hacer click sobre la fila.
  - En caso contrario, si `results[selectedIndex]` existe → `onSelect(results[selectedIndex])` y `onClose()`.
- `Escape`: `onClose()`.
- `Tab`: dejar comportamiento default (permite mover foco fuera si el usuario quiere).

> **Por qué:** el scanner emite `Enter` al final del barcode. Si ese `Enter` auto-seleccionara, escanear algo "sólo para buscarlo" siempre lo sumaría al carrito. Con esta regla, la query numérica queda listada pero no se agrega automáticamente; el usuario decide con click si finalmente lo carga.

**Mouse:**
- Click en una fila → `onSelect(row)` + `onClose()`.
- Hover (opcional): actualiza `selectedIndex` para que el resaltado siga al mouse.
- Click fuera del contenedor (sobre el overlay) → `onClose()`.

**Limpieza al cerrar:**
- Cuando `open` pasa a `false`, limpiar `query` y `results` en un `useEffect`.

**Render cuando `!open`:** retornar `null`.

---

### Paso 2.8b — Extraer `formatMoney` a un util compartido

**Objetivo:** evitar duplicar el formateador de moneda entre Stock y Sells.

**Archivo nuevo:** crear [renderer/src/utils/format.ts](renderer/src/utils/format.ts) con:
```ts
export function formatMoney(value: string | number): string {
  const asNumber = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(asNumber)) return String(value)

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2
  }).format(asNumber)
}
```

**Modificar** [renderer/src/Pages/Stock.tsx](renderer/src/Pages/Stock.tsx):
- Borrar la función local `formatMoney` (líneas ~12-21).
- Agregar `import { formatMoney } from '../utils/format'`.
- El resto de Stock queda igual (ya usaba `formatMoney(p.salePrice)` — string).

**Verificación:** `npm run dev` debe mostrar la pantalla Stock con los precios formateados igual que antes.

---

### Paso 2.9 — Implementar `CartList`

**Archivo:** crear [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx).

**Props:**
```ts
type Props = {
  lines: CartLine[]
  onQuantityChange: (productId: number, quantity: number) => void
  onUnitPriceChange: (productId: number, unitPrice: string) => void
  onRemove: (productId: number) => void
}
```

**Helper compartido:** importar `formatMoney` desde `'../../utils/format'` (ya extraído en el Paso 2.8b).

**Layout:** grid CSS de 4 columnas: `Nombre | Cantidad | Precio unitario | Total del producto`.

**Cada fila:**
- `<div tabIndex={0}>` que contiene los 4 campos.
- Columna **Nombre:** texto; si `line.quantity > line.product.stock` → agregar un ícono/etiqueta roja con texto "⚠ Sin stock suficiente" (clase `cart-row__warn`).
- Columna **Cantidad:** `<input type="number" min="1" step="1">` con `value={line.quantity}`; `onChange` → `onQuantityChange(productId, Number(e.target.value))`.
- Columna **Precio unitario:** `<input type="number" min="0" step="0.01">` con `value={line.unitPrice}`; `onChange` → `onUnitPriceChange(productId, e.target.value)`.
- Columna **Total:** texto calculado con `formatMoney(lineTotal(line))`.

**Tecla Delete para eliminar la línea completa:**

> **Semántica:** `Delete` elimina la fila entera (con toda su cantidad), no decrementa. Para bajar cantidades se usa el input numérico de la columna Cantidad (valor inicial siempre `1` al agregar).

- `onKeyDown` en el `<div>` de la fila:
  - Si `e.key === 'Delete'` → llamar `onRemove(productId)`, **salvo** que el foco esté dentro de un input editable (cantidad o precio), donde Delete tiene su significado natural. La condición exacta:
    ```ts
    if (e.key !== 'Delete') return
    if (document.activeElement instanceof HTMLInputElement) return
    e.preventDefault()
    onRemove(productId)
    ```
- Adicionalmente agregar un botón visible `<button aria-label="Eliminar">✕</button>` al final de la fila que llama a `onRemove(productId)`. Cubre el caso mouse y sirve también como target alcanzable por `Tab`: una vez que el foco llega al `✕`, apretar `Enter` o `Space` elimina la fila.

**Lista vacía:** si `lines.length === 0` mostrar un mensaje placeholder ("Agregá productos con el lector o F2").

---

### Paso 2.10 — Implementar `Sells` (contenedor)

**Archivo:** crear [renderer/src/Pages/Sells/Sells.tsx](renderer/src/Pages/Sells/Sells.tsx).

**Estado:**
- `const [cart, dispatch] = useReducer(cartReducer, initialCart)`
- `const [popupOpen, setPopupOpen] = useState(false)`
- `const [alert, setAlert] = useState<{ kind: 'not-found' | 'no-stock' | 'no-price'; text: string } | null>(null)`
- `const barcodeInputRef = useRef<{ focus: () => void } | null>(null)`
- `const cartRef = useRef(cart)` — siempre refleja el último estado del carrito, incluso entre renders.
- `const prevOpenRef = useRef(false)` — recuerda el valor previo de `popupOpen` para que el efecto de "devolver foco al cerrar" sólo dispare en la transición `true → false`.

**Sincronizar el ref con el estado:**
```ts
useEffect(() => { cartRef.current = cart }, [cart])
```

**Handlers:**

```ts
async function handleScan(barcode: string) {
  setAlert(null)
  try {
    const product = await window.api.getProductByBarcode(barcode)
    if (!product) {
      setAlert({ kind: 'not-found', text: `Producto con código ${barcode} no encontrado` })
      return
    }
    addProduct(product)
  } catch {
    setAlert({ kind: 'not-found', text: `Código inválido: ${barcode}` })
  }
}

// Decisión 11 del context.md: si el producto no tiene precio válido, no lo agregamos.
// Aceptamos vacío, NaN, <= 0. Devolvemos true si se agregó, false si se rechazó.
function hasValidPrice(product: ProductFromApi): boolean {
  const raw = product.salePrice
  if (raw === '' || raw == null) return false
  const n = Number(raw)
  return Number.isFinite(n) && n > 0
}

// Calcula el próximo estado ANTES de dispatch, usando el reducer como función pura.
// Esto evita la race condition ante scans rápidos: cartRef.current siempre tiene
// el último estado aplicado, aunque React no haya re-renderizado todavía.
function addProduct(product: ProductFromApi) {
  if (!hasValidPrice(product)) {
    setAlert({
      kind: 'no-price',
      text: `"${product.name}" no tiene un precio cargado`
    })
    return
  }

  const action = { type: 'ADD', product } as const
  const nextState = cartReducer(cartRef.current, action)
  const newLine = nextState.lines.find(l => l.productId === product.id)
  cartRef.current = nextState     // avanza el ref sincrónicamente
  dispatch(action)                 // programa el re-render

  if (newLine && newLine.quantity > product.stock) {
    setAlert({
      kind: 'no-stock',
      text: `Sin stock suficiente de "${product.name}" (stock: ${product.stock})`
    })
  }
}

function handleSelectFromPopup(product: ProductFromApi) {
  // Cerramos primero: el useEffect de transición true → false devuelve el foco al
  // input de barcode. addProduct se ejecuta a continuación (sincrónico) y puede
  // levantar la alerta de precio o stock sin sacarle el foco al barcode.
  setPopupOpen(false)
  addProduct(product)
}
```

> **Por qué el ref:** `dispatch` no actualiza `cart` sincrónicamente. Si el scanner dispara dos Enter seguidos en el mismo tick, leer `cart.lines` entre ambas llamadas devuelve el estado viejo dos veces. Usando `cartRef` + avanzando con el reducer pura, la segunda llamada ya ve la primera suma.

**Alerta visible:**
- Si `alert` no es `null`, renderizar un banner arriba del carrito con clase según `alert.kind`. El banner tiene un botón "✕" para cerrarlo. Auto-cerrar con `setTimeout` de 4 segundos usando un `useEffect` dependiente de `alert`.

**Atajo F2 global (único source of truth del toggle):**
- `useEffect` que agrega listener `keydown` en `window`. F2 alterna el popup: abre si está cerrado, cierra si está abierto.
  ```ts
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'F2') {
      e.preventDefault()
      setPopupOpen(prev => !prev)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
  ```
- Este listener es el **único** que maneja F2. `BarcodeInput` ya no lo toca (ver Paso 2.7). El botón "F2" del `BarcodeInput` llama a `onRequestSearch`, que el padre define también como toggle (`setPopupOpen(prev => !prev)`), para que el botón también pueda cerrar el popup.
- **Devolver foco al cerrar** (por F2, Escape, click fuera o selección desde el popup): `useEffect` que escucha cambios de `popupOpen` y sólo dispara el focus en la transición `true → false`. Usar `prevOpenRef` para no ejecutar el `focus()` en el mount inicial (donde `popupOpen === false` desde el principio):
  ```ts
  useEffect(() => {
    if (prevOpenRef.current && !popupOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 0)
    }
    prevOpenRef.current = popupOpen
  }, [popupOpen])
  ```
- Con esto, `handleSelectFromPopup` ya **no necesita** llamar `focus()` manualmente: al hacer `setPopupOpen(false)`, el efecto se encarga.

**Render:**
```
<section className="sells">
  <BarcodeInput
    ref={barcodeInputRef}
    onScan={handleScan}
    onRequestSearch={() => setPopupOpen(prev => !prev)}   // toggle: el botón F2 abre y cierra
  />
  {alert && <AlertBanner ... />}
  <CartList lines={cart.lines}
            onQuantityChange={(id, q) => dispatch({ type: 'SET_QUANTITY', productId: id, quantity: q })}
            onUnitPriceChange={(id, p) => dispatch({ type: 'SET_UNIT_PRICE', productId: id, unitPrice: p })}
            onRemove={(id) => dispatch({ type: 'REMOVE', productId: id })} />
  <SearchPopup open={popupOpen} onClose={() => setPopupOpen(false)} onSelect={handleSelectFromPopup} />
</section>
```

> Cierre del popup: el `onClose` sólo hace `setPopupOpen(false)`; el efecto de transición `true → false` devuelve el foco al barcode automáticamente.

---

### Paso 2.11 — Estilos

**Archivo:** crear [renderer/src/Pages/Sells/Sells.css](renderer/src/Pages/Sells/Sells.css).

Reglas mínimas esperadas:
- `.sells` — padding + display flex column con gap.
- `.barcode-input` — fila con input grande + botón F2.
- `.cart-list` — grid de 4 columnas (o 5 si contás el botón eliminar).
- `.cart-row__warn` — color rojo.
- `.search-popup__overlay` — `position: fixed; inset: 0; background: rgba(0,0,0,0.5)`.
- `.search-popup__container` — centrado, fondo claro, padding, max-width.
- `.search-popup__row--selected` — fondo resaltado.
- `.alert-banner`, `.alert-banner--not-found`, `.alert-banner--no-stock`, `.alert-banner--no-price` — colores diferentes (los tres tipos de alerta del contenedor `Sells`).

Basarse en los estilos ya existentes de [Stock.css](renderer/src/Pages/Stock.css) para mantener coherencia visual (colores `#dde5ee`, `#f5f7fa`, `#fee2e2`).

---

### Paso 2.12 — Integrar en `App.tsx`

**Archivo:** modificar [renderer/src/App.tsx](renderer/src/App.tsx).

**Cambios exactos:**
1. Agregar `import Sells from './Pages/Sells/Sells'` junto a los otros imports.
2. Reemplazar `{content === "sells" && <div>Sells</div>}` por `{content === "sells" && <Sells />}`.

---

### Paso 2.13 — Pruebas manuales de humo (checklist)

Correr `npm run dev` (o el script equivalente del proyecto) y verificar:

**Flujo scanner (golden path):**
- [ ] Input superior está enfocado al abrir la pantalla Sells.
- [ ] Escribir un código de barras existente y apretar Enter agrega el producto al carrito con `quantity = 1`.
- [ ] Escanear el mismo código otra vez incrementa la cantidad a 2 (no crea fila nueva).
- [ ] Tras cada scan, el input de barcode queda vacío y enfocado.

**Flujo buscador (F2):**
- [ ] Apretar `F2` desde cualquier parte de la pantalla abre el popup y el foco cae en su input.
- [ ] Apretar `F2` con el popup abierto lo cierra (toggle). Esto vale tanto con el foco dentro del input de barcode como fuera.
- [ ] El botón "F2" del `BarcodeInput` también abre y cierra (toggle).
- [ ] Escribir texto parcial devuelve productos cuyo nombre contiene el texto (case-insensitive).
- [ ] Escribir dígitos devuelve también el producto con ese barcode (si existe), apareciendo primero.
- [ ] `ArrowDown`/`ArrowUp` cambian la fila seleccionada visualmente.
- [ ] `Enter` con query **alfabética** agrega el producto seleccionado, cierra el popup y devuelve el foco al input de barcode.
- [ ] `Enter` con query **puramente numérica** (simula el `Enter` del scanner) **no** agrega nada: el producto queda listado, el popup sigue abierto. Sólo el click lo agrega.
- [ ] `Escape` cierra el popup sin agregar nada y devuelve el foco al input de barcode.
- [ ] Click sobre una fila agrega el producto, cierra el popup y devuelve el foco al input de barcode.
- [ ] Click fuera del contenedor cierra el popup.

**Carrito:**
- [ ] Editar cantidad con el teclado se refleja en el total de esa fila.
- [ ] Editar precio unitario con el teclado se refleja en el total.
- [ ] Poner cantidad en `0` elimina la fila.
- [ ] Con el foco sobre la fila (no en un input interno) y apretando `Delete`, la fila se elimina.
- [ ] El botón `✕` elimina la fila.
- [ ] `Tab` permite navegar entre campos de la misma fila y entre filas.

**Alertas:**
- [ ] Escanear un código que no existe muestra el banner "Producto no encontrado".
- [ ] Agregar un producto cuya suma de cantidades supere el `stock` muestra el banner "Sin stock suficiente" y **sí** lo agrega al carrito.
- [ ] Intentar agregar un producto cuyo `salePrice` sea `0`, vacío o inválido **no** lo carga y muestra el banner "No tiene un precio cargado". Vale para scanner y para selección desde el popup.
- [ ] Los banners se pueden cerrar manualmente con `✕` y también desaparecen solos tras ~4 s.

**Visual:**
- [ ] La fila del carrito con `quantity > stock` muestra el warning "⚠ Sin stock suficiente" al lado del nombre.

---

## 3. Resumen de tests automáticos incluidos

- [cartReducer.test.ts](renderer/src/Pages/Sells/__tests__/cartReducer.test.ts): 17 casos cubren add/remove/set-quantity/set-unit-price/lineTotal/inmutabilidad.
- [searchProducts.test.ts](renderer/src/Pages/Sells/__tests__/searchProducts.test.ts): 7 casos cubren query vacía, sólo-letras, numérica con y sin duplicado, error en barcode, trim y mixta.

Tests de componente (React Testing Library) quedan opcionales para esta iteración; la lógica crítica vive en funciones puras ya cubiertas. Si más adelante aparece un bug en la UI, sumamos tests de componente en la iteración siguiente.

---

## 4. Criterios de aceptación

1. `npm test` dentro de `renderer/` pasa sin errores.
2. `npm run dev` levanta la app y la checklist manual del Paso 2.13 queda completa.
3. El backend no fue tocado (sólo se consumen APIs existentes de `window.api`).
4. [context.md](context.md) refleja las decisiones de esta iteración (ya actualizado).

---

## 5. Fuera de alcance (explícitamente)

- Formulario de pagos (efectivo/transferencia/débito/crédito).
- Cálculo de vuelto.
- Creación de `Sale` / `SaleItem` / `SalePayment` en la DB (backend aún sin endpoint).
- Historial de ventas.
- Confirmación / impresión del ticket.
- Persistencia del carrito entre sesiones.

Todos estos entran en iteraciones siguientes del módulo Sells.
