# Plan — Columna de vencimientos en Stock + info de lotes en el buscador

## Contexto

Agregar una nueva feature a la pantalla **Stock**:

1. Un **botón toggle** en la barra de acciones (`.stock-actions`) que muestra/oculta una nueva columna **"Vencimientos"** al final de la tabla.
2. Esa columna muestra, **por producto**, una **lista vertical compacta** con todos sus lotes (cada lote = un `StockMovement type='IN'` con `expiryDismissedAt = null` y `quantity > 0`).
3. **Orden dentro de la celda**: primero los lotes **con** `expiryDate` ordenados de más cercano a vencer → más lejano; al final los lotes **sin** `expiryDate` (en orden de fecha de carga descendente, los más recientes arriba).
4. El componente compartido **`SearchPopup`** recibe una nueva prop `showExpiry` (default `false`). Cuando es `true` (solo en Stock), agrega una columna **"Vencimientos"** con la misma lista compacta que la tabla principal. En Sells la prop queda en `false` (sin cambios visuales).

**Intencionalmente fuera de scope:** ningún cambio de schema Prisma, ningún cambio en el flujo de "Cargar stock" / `LoadStockModal`, ningún cambio en el `ExpiryAlertWidget` del header. Reutilizamos el dato `StockMovement.expiryDate` que ya existe.

---

## Decisiones tomadas (alineadas con el usuario)

| # | Decisión | Confirmado |
|---|---|---|
| D1 | La columna es **toggleable** mediante un botón en `.stock-actions` | sí |
| D2 | Mostrar lotes **con** vencimiento ordenados ASC, y luego los **sin** vencimiento al final | sí |
| D3 | `SearchPopup` recibe prop `showExpiry`. Solo se usa `true` desde Stock; Sells queda igual | sí |
| D4 | Formato: lista vertical compacta (una línea por lote) tanto en la tabla como en el buscador | sí |
| D5 | Se filtran lotes con `quantity <= 0` (merma) y con `expiryDismissedAt != null` (ya descartados) | implícita en el contrato del feature; aclarar en la descripción visible si surge duda |

---

## Arquitectura — flujo de datos

- **Backend**: una función nueva de repositorio + un canal IPC nuevo. Recibe un array de `productId` y devuelve los lotes (`StockMovement` IN, con vencimientos vivos) de **todos** esos productos en **una sola llamada**, evitando el problema N+1 si la tabla tiene 100 productos.
- **Renderer**: cuando `showExpiryColumn` está activado, `Stock.tsx` llama a la API una vez con los IDs de los productos cargados. Cuando el `SearchPopup` se abre con `showExpiry=true`, hace lo mismo con los IDs de los resultados visibles (refrescándose cuando cambia la query).

---

## Archivos a tocar (resumen)

**Nuevos:**
- `renderer/src/utils/lots.ts` — helper `sortLots` puro y tipado.
- `renderer/src/Components/LotsList/LotsList.tsx` — componente visual compartido (lista vertical compacta).
- `renderer/src/Components/LotsList/LotsList.css` — estilos de la lista.
- `renderer/src/utils/__tests__/lots.test.ts`
- `renderer/src/Components/LotsList/__tests__/LotsList.test.tsx`

**Modificados:**
- `backend/repositories/stockMovementRepository.ts` — nueva función `listLotsByProductIds`.
- `backend/repositories/index.ts` — exportar la nueva función.
- `electron/ipcHandlers.ts` — nuevo handler `stockMovement:listLotsByProductIds`.
- `electron/ipcContract.ts` — agregar método al `ElectronApi`.
- `renderer/src/electron-api.d.ts` — declarar el método en `window.api`.
- `renderer/src/Pages/Stock.tsx` — estado `showExpiryColumn`, botón toggle, fetch de lotes, columna nueva.
- `renderer/src/Pages/Stock.css` — variantes de `grid-template-columns` cuando la columna está activa, estilos del botón toggle.
- `renderer/src/Pages/Sells/SearchPopup.tsx` — prop `showExpiry`, columna condicional, fetch de lotes para los resultados visibles.
- `renderer/src/Pages/Sells/SearchPopup.css` — ancho de la nueva columna.
- Tests: `Stock.test.tsx` (si existe) o test específico nuevo, `SearchPopup.test.tsx`, etc.

---

## Plan paso a paso

### Paso 0 — Verificar el estado del repo

1. Correr el test suite actual y dejarlo en verde:
   ```
   npm test
   ```
2. Si hay tests rojos preexistentes (no relacionados al feature), **anotar cuáles** antes de empezar para no atribuirlos a esta iteración.

---

### Paso 1 — Helper puro `sortLots` en `renderer/src/utils/lots.ts`

**Objetivo:** una función pura que aplique la regla de ordenamiento (D2) y se pueda testear sin React ni IPC.

1. Crear el archivo `renderer/src/utils/lots.ts`.
2. Definir el tipo de entrada apoyándose en `StockMovementFromApi`:
   ```ts
   import type { StockMovementFromApi } from '../electron-api'
   ```
3. Exportar la función `sortLots(lots: StockMovementFromApi[]): StockMovementFromApi[]` con esta semántica **explícita**:
   - **Particionar** en dos arrays:
     - `withExpiry` = `expiryDate !== null`
     - `withoutExpiry` = `expiryDate === null`
   - `withExpiry` se ordena por `expiryDate` **ascendente** (`a.expiryDate.getTime() - b.expiryDate.getTime()`).
   - `withoutExpiry` se ordena por `date` **descendente** (más recientes primero).
   - Devolver `[...withExpiry, ...withoutExpiry]` (concatenados).
   - **No mutar** el array de entrada (usar `slice()` antes de `sort`).
4. Exportar también un helper `groupLotsByProduct(lots: StockMovementFromApi[]): Map<number, StockMovementFromApi[]>` que agrupa por `productId` y aplica `sortLots` a cada grupo.

**Pseudocódigo (no implementar literal, es para guía):**
```ts
export function sortLots(lots) {
  const withE = lots.filter(l => l.expiryDate !== null)
                    .slice()
                    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
  const noE  = lots.filter(l => l.expiryDate === null)
                   .slice()
                   .sort((a, b) => b.date.getTime() - a.date.getTime())
  return [...withE, ...noE]
}
```

---

### Paso 2 — Tests de `sortLots` y `groupLotsByProduct`

Archivo: `renderer/src/utils/__tests__/lots.test.ts`. Incluir estos casos **explícitamente**:

1. Array vacío → devuelve `[]`.
2. Solo lotes con vencimiento → orden ASC por `expiryDate`.
3. Solo lotes sin vencimiento → orden DESC por `date`.
4. Mezclados → primero todos los `withExpiry` (ASC), luego los `withoutExpiry` (DESC). Verificar la **frontera** (que ningún `null` se intercale).
5. Empate en `expiryDate` → orden estable (cualquier orden relativo aceptable; testear que ambos aparezcan contiguos).
6. **Inmutabilidad**: que `sortLots` no mute el array de entrada (snapshot antes y después).
7. `groupLotsByProduct` con lotes de 3 productos distintos → devuelve un Map con 3 entradas, cada una ya ordenada.

---

### Paso 3 — Componente `LotsList` (visual)

Archivos: `renderer/src/Components/LotsList/LotsList.tsx` + `LotsList.css`.

1. **Props**:
   ```ts
   type Props = {
     lots: StockMovementFromApi[]   // ya viene ordenado por sortLots
     emptyText?: string             // default "—"
   }
   ```
2. **Render**:
   - Si `lots.length === 0` → renderizar un `<span>` con `emptyText`.
   - Si hay lotes → un `<ul className="lots-list">` con un `<li>` por lote.
   - Cada `<li>` contiene dos partes:
     - **Cantidad** (`{l.quantity} u.`)
     - **Fecha** — usar `formatExpiryInput(l.expiryDate)` del util `renderer/src/utils/expiry.ts`. Si es `null` mostrar `"sin vencimiento"`.
   - Formato sugerido por `<li>`: `{quantity} u. — {fecha o "sin vencimiento"}`.
3. **CSS**:
   - `.lots-list` → `list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px;`
   - `.lots-list__item` → `font-size: 12px; line-height: 1.3;`
   - Variante visual para lotes vencidos / vencen hoy (opcional pero recomendado): aplicar `.lots-list__item--expired` o `--today` reutilizando `classifyExpiry` de `utils/expiry.ts`. El estilo es leve (color rojo o naranja en el texto). **No** es la alerta principal, eso lo cubre `ExpiryAlertWidget`; acá es solo realce informativo.

**Decisión clave de implementación:** `LotsList` **no** hace fetch propio. Solo renderiza lo que recibe por props. Esto lo hace reutilizable y testeable.

---

### Paso 4 — Tests del componente `LotsList`

Archivo: `renderer/src/Components/LotsList/__tests__/LotsList.test.tsx` con Vitest + Testing Library.

1. Sin lotes → renderiza el `emptyText` por defecto (`"—"`) y no renderiza `<ul>`.
2. Con `emptyText` custom → respeta el override.
3. Con 3 lotes (mix) → renderiza 3 `<li>` con texto que contiene cantidad y fecha.
4. Lote con `expiryDate = null` → muestra `"sin vencimiento"` en lugar de fecha.
5. Lote vencido (fecha pasada) → la fila tiene la clase `--expired` (si decidiste implementar la variante visual).
6. Lote que vence hoy → fila con clase `--today`.

---

### Paso 5 — Backend: función de repositorio `listLotsByProductIds`

Archivo: `backend/repositories/stockMovementRepository.ts`.

1. Agregar la función exportada:
   ```ts
   export async function listLotsByProductIds(productIds: number[]) {
     if (productIds.length === 0) return []
     return prisma.stockMovement.findMany({
       where: {
         productId: { in: productIds },
         type: 'IN',
         expiryDismissedAt: null,
         quantity: { gt: 0 }
       },
       orderBy: { expiryDate: 'asc' },  // mejor esfuerzo; el sort fino vive en el renderer (sortLots)
       include: { product: true }
     })
   }
   ```
2. Asegurarse de **no** romper el shape de `StockMovementFromApi` — Prisma incluye el `product` en `include`, igual que `listStockMovements`.
3. Exportar desde `backend/repositories/index.ts` (agregar línea de re-export).

**Nota:** el ordenamiento final lo hace el renderer con `sortLots` para mantener la lógica de "sin vencimiento al final" en un solo lugar (consistente entre la tabla y el buscador). El `orderBy` del repo es solo una optimización para evitar ordenar dos veces lo mismo en queries grandes.

---

### Paso 6 — Backend: tests del repositorio

Si existe un test runner para repositorios (revisar `backend/__tests__/`), agregar `listLotsByProductIds.test.ts` o equivalente. Casos:

1. Array vacío → devuelve `[]` sin tocar la DB.
2. Producto con varios lotes IN → devuelve todos con su `product` incluido.
3. Excluye lotes con `expiryDismissedAt != null`.
4. Excluye lotes con `quantity <= 0` (merma).
5. Excluye movimientos con `type` distinto de `'IN'`.
6. Mezcla de productos: dos productos, cada uno con 2 lotes → devuelve 4 ítems.

Si el proyecto **no** corre tests de repositorios contra una DB real, saltear este paso y cubrir la lógica solo desde el renderer / scripts integrales (`test:ipc-bridge`).

---

### Paso 7 — IPC: handler nuevo

Archivo: `electron/ipcHandlers.ts`.

1. Importar `listLotsByProductIds` de `../backend/repositories`.
2. Registrar el handler con el canal `'stockMovement:listLotsByProductIds'`. La firma del payload es `{ productIds: number[] }`. Aplicar el mismo patrón de serialización que ya usa `stockMovement:list` (pasar el resultado por `serializeForIpc` o como esté implementado).
3. Validar el payload mínimamente: si `productIds` no es array, devolver `[]` o tirar error explicativo (alinear con el patrón de los demás handlers del archivo).

---

### Paso 8 — IPC: contrato y tipos del renderer

1. **`electron/ipcContract.ts`**:
   - Agregar al `ElectronApi`:
     ```ts
     listLotsByProductIds: (productIds: number[]) => Promise<StockMovementFromApi[]>
     ```
   - En `buildElectronApi`:
     ```ts
     listLotsByProductIds: (productIds) =>
       call<StockMovementFromApi[]>('stockMovement:listLotsByProductIds', { productIds }),
     ```
2. **`renderer/src/electron-api.d.ts`**:
   - Agregar la firma del método en la interfaz expuesta por `window.api`. (Mismo nombre, mismos tipos.)

---

### Paso 9 — `SearchPopup` recibe `showExpiry`

Archivo: `renderer/src/Pages/Sells/SearchPopup.tsx`.

1. Extender la prop interface:
   ```ts
   type Props = {
     open: boolean
     onClose: () => void
     onSelect: (product: ProductFromApi) => void
     allowNumericEnter?: boolean
     showExpiry?: boolean   // default false
   }
   ```
2. Cuando `showExpiry === true`, agregar un nuevo `<th>Vencimientos</th>` al final del header de la tabla y un `<td>` por fila con `<LotsList lots={lotsByProduct.get(product.id) ?? []} />`.
3. Estado nuevo:
   ```ts
   const [lotsByProduct, setLotsByProduct] = useState<Map<number, StockMovementFromApi[]>>(new Map())
   ```
4. **Fetch de lotes** — un `useEffect` que se dispara cuando `showExpiry` y `results` cambian:
   - Si `!showExpiry` o `results.length === 0` → setear el Map vacío y salir.
   - Si hay resultados → llamar `window.api.listLotsByProductIds(results.map(r => r.id))`, pasar la respuesta por `groupLotsByProduct` (del Paso 1) y guardarla en el state.
   - Manejar `cancelled` con el patrón habitual (variable cerrada en cleanup).
5. **Default de la prop** en el componente: `showExpiry = false`. La firma de uso desde `Sells.tsx` no cambia (queda implícitamente `false`).

**Cuidado de UX:** si la tabla tiene `showExpiry`, asegurarse de que la nueva celda no rompa el `flex` o el layout de filas seleccionadas. Verificar la clase `search-popup__row--selected` y los estilos de `td`.

---

### Paso 10 — `SearchPopup.css`

Agregar:
- `.search-popup__col-expiry` (o el selector que uses) con `width: 240px;` o `max-width: 240px;` para que la columna no haga estallar la tabla cuando un producto tiene muchos lotes.
- `overflow-y: auto; max-height: 120px;` en la celda si se decide acotar la altura.

---

### Paso 11 — Stock.tsx: estado, botón, fetch y columna

Archivo: `renderer/src/Pages/Stock.tsx`.

1. **Imports** nuevos: `LotsList`, `sortLots`, `groupLotsByProduct`, tipo `StockMovementFromApi`.
2. **Estado nuevo**:
   ```ts
   const [showExpiryColumn, setShowExpiryColumn] = useState(false)
   const [lotsByProduct, setLotsByProduct] = useState<Map<number, StockMovementFromApi[]>>(new Map())
   ```
3. **Botón toggle** dentro de `.stock-actions`:
   - Texto dinámico: `showExpiryColumn ? 'Ocultar vencimientos' : 'Mostrar vencimientos'`.
   - Clase nueva `stock-actions__btn-expiry` para estilarlo.
4. **Fetch de lotes** con un `useEffect` cuya dependencia sea `[showExpiryColumn, products]`:
   - Si `!showExpiryColumn || products.length === 0` → `setLotsByProduct(new Map())` y salir.
   - Si activado → llamar `window.api.listLotsByProductIds(products.map(p => p.id))`, agrupar con `groupLotsByProduct`, setear estado.
   - Patrón `cancelled` igual que en el `useEffect` de carga de productos.
5. **Columna nueva** condicional dentro del array `columns`:
   ```ts
   ...(showExpiryColumn ? [{
     key: 'expiry',
     label: 'Vencimientos',
     render: (p) => <LotsList lots={lotsByProduct.get(p.id) ?? []} />
   }] : [])
   ```
   Insertarla **antes** de la columna `actions` para que "Editar" siga siendo la última.
6. **Reload key**: el `useEffect` de carga ya reacciona a `reloadKey`. Cuando se carga stock o se edita un producto, los lotes deberían recargarse también. Para eso agregar `reloadKey` a las dependencias del nuevo `useEffect` de lotes (junto a `[showExpiryColumn, products, reloadKey]`).

---

### Paso 12 — Stock.css: grid dinámico + estilo del botón

Archivo: `renderer/src/Pages/Stock.css`.

1. La grilla pasa de `repeat(7, 1fr)` a usar una **clase modificadora**:
   - Default (sin la columna extra): `.stock-grid { grid-template-columns: repeat(7, 1fr); }` (queda como está).
   - Con la columna: `.stock-grid--with-expiry { grid-template-columns: repeat(8, 1fr); }`.
2. Aplicar la clase condicionalmente en `Stock.tsx`:
   ```tsx
   <section className={`stock-grid ${showExpiryColumn ? 'stock-grid--with-expiry' : ''}`}>
   ```
3. **Media queries**: actualizar las dos reglas existentes (`@media (max-width: 1024px)` y `@media (max-width: 640px)`) para que el modificador `--with-expiry` se reduzca proporcionalmente (ej. en 1024px usar `repeat(4, 1fr)` con la columna activa, en 640px ya colapsa a 1 columna y no hace falta tocar nada).
4. **Botón toggle**: agregar `.stock-actions__btn-expiry` con un color distinto (sugerido: `#8b5cf6` violeta) para distinguirlo del resto y un hover correspondiente.

---

### Paso 13 — Activar `showExpiry` en el `SearchPopup` de Stock

En `Stock.tsx`, donde ya se renderiza `<SearchPopup ... allowNumericEnter={true} />`, agregar `showExpiry={true}`. **No tocar** el `SearchPopup` de Sells — queda con el default `false`.

---

### Paso 14 — Tests UI

#### 14.a — `Stock.tsx` (test específico para esta feature)

Crear `renderer/src/Pages/__tests__/Stock.expiryColumn.test.tsx` (o agregar al test de Stock si existe). Casos:

1. Por defecto, **no** se renderiza ninguna celda con label "Vencimientos".
2. Click en el botón "Mostrar vencimientos" → se renderiza la columna y el texto del botón cambia a "Ocultar vencimientos".
3. Click otra vez → se oculta la columna.
4. Cuando la columna está activa, **se llama** `window.api.listLotsByProductIds` con los IDs de los productos cargados.
5. Cuando un producto tiene 2 lotes (uno con fecha, uno sin), la celda renderiza la lista en el orden correcto (con fecha primero).
6. Cuando un producto **no** tiene lotes, la celda muestra `"—"`.
7. La columna `Acciones` (botón Editar) sigue apareciendo como **última** (verificar orden de columnas).

**Mockear** `window.api.listLotsByProductIds` y `window.api.listProducts` con datos sintéticos. No hace falta DB real.

#### 14.b — `SearchPopup.test.tsx`

Extender el test existente con un `describe('showExpiry')`:

1. Default (sin la prop) → no renderiza la columna "Vencimientos".
2. Con `showExpiry={true}` y resultados → renderiza la columna y llama a `window.api.listLotsByProductIds` con los IDs visibles.
3. Cuando cambia la query (cambian los resultados) → vuelve a llamar a `listLotsByProductIds` con los IDs nuevos.
4. Si la API responde con `[]` para un producto → la celda de ese producto muestra `"—"`.
5. Si `showExpiry={false}` → **nunca** se llama a `listLotsByProductIds` (verificar con `expect(mock).not.toHaveBeenCalled()`).

---

### Paso 15 — Tests de integración / smoke manual

1. Correr `npm test` y verificar que **todos** los tests pasen, incluidos los de `ExpiryAlertWidget` y demás (no debería haber regresiones porque nada del shape de `StockMovement` cambió).
2. Smoke manual end-to-end:
   - Abrir la app en dev.
   - Ir a Stock. Verificar que el botón "Mostrar vencimientos" aparezca.
   - Click → aparece la columna; con datos reales, verificar el orden y que los lotes "merma" (cantidad negativa) no aparezcan.
   - Buscar un producto con F2: en la tabla del popup debe aparecer la columna "Vencimientos" con la misma info.
   - Ir a Sells, abrir F2: verificar que **no** aparece la columna nueva (solo en Stock).
   - Toggle off: la columna desaparece y el grid vuelve a 7 columnas (no quedan huecos).
   - Cargar un nuevo lote con `LoadStockModal` y verificar que al volver a Stock con la columna activa, el lote nuevo aparece.

---

## Resumen de testabilidad

- **Lógica pura** (`sortLots`, `groupLotsByProduct`) → tests unitarios sin React.
- **Componente visual** (`LotsList`) → tests con Testing Library, sin IPC.
- **Backend repo** (`listLotsByProductIds`) → tests con DB si el proyecto los soporta; si no, cubierto vía smoke + tests de UI con mock del IPC.
- **Integración Stock + buscador** → tests de UI que mockean `window.api`.

Esta separación permite que un modelo de menor potencia ejecute paso a paso sin necesidad de razonamiento global; cada paso es local a uno o dos archivos y tiene su test asociado.

---

## Notas y trampas conocidas

- El `SearchPopup` se importa también desde `renderer/src/Pages/Stock.tsx`. **Verificar** que la prop `showExpiry` tenga default `false` para no romper el call site de Sells.
- Si más adelante se agrega edición de la `expiryDate` desde la UI, el `LotsList` ya queda preparado para mostrarla; la edición misma queda fuera de scope.
- Cuidado al cambiar `grid-template-columns`: si se aplica mal la clase modificadora, el header `Acciones` puede quedar mal alineado. El test de orden de columnas (Paso 14.a punto 7) protege contra eso.
- El `useEffect` que dispara el fetch de lotes en `Stock.tsx` debe **no** ejecutarse si `showExpiryColumn === false` (early return), para evitar IPC innecesarios.
- En `SearchPopup`, el fetch debe respetar el debounce ya existente para `results`: como el `useEffect` de lotes depende de `results`, se va a disparar después del debounce sin trabajo extra.
