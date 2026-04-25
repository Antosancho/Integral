# Plan — Historial de Ventas (nueva pestaña)

## Objetivos

Implementar la pantalla de historial de ventas con:
- Lista de ventas con información básica (ID, fecha/hora, total, medios de pago)
- Filtros: rango de fechas, franja horaria del día, rango de precio, método de pago
- Modal de detalle al hacer click en una venta (ítems, precios, descuento, pagos)

## Problemas previos que se resuelven en este plan

1. **discountPct no persistido**: el schema no tiene `discountPct` en `Sale`. La pantalla de confirmación tampoco lo envía al backend. Sin este dato, el historial no puede mostrar el descuento aplicado.
2. **Validación de pagos rechaza overpayment**: el backend exige `paymentsSum == total`, pero la UI permite que el cliente pague de más y reciba vuelto. Esto causa error al confirmar ventas con pagos en exceso.
3. **Total no puede tener descuento**: la validación del backend compara `clientTotal` con `sum(items)` directamente. Si hay descuento, el total enviado nunca coincidirá con la suma de ítems → error en toda venta con descuento.

---

## Convenciones

- Ejecutar **`npm test --prefix renderer`** después de cada paso que modifique código del renderer.
- Si un test falla, arreglarlo **antes de avanzar al siguiente paso**.
- No modificar archivos que no estén listados en el paso.
- No agregar comentarios al código.
- Los strings de UI mantienen tildes, mayúsculas y formato ARS.

---

# FASE 0 — Backend: schema + validaciones en saleService

## Paso 0.1 — Agregar `discountPct` al modelo `Sale` en `backend/prisma/schema.prisma`

**Archivo:** `backend/prisma/schema.prisma`

En el modelo `Sale`, agregar el campo `discountPct` después de `total` y antes de `items`:

```
discountPct Decimal @default(0)
```

El modelo queda:
```
model Sale {
  id          Int             @id @default(autoincrement())
  date        DateTime        @default(now())
  total       Decimal
  discountPct Decimal         @default(0)
  items       SaleItem[]
  payments    SalePayment[]
  movements   StockMovement[]
  @@index([date])
}
```

**Verificación:** el archivo compila visualmente correcto (sintaxis Prisma).

---

## Paso 0.2 — Correr la migración de Prisma

Ejecutar desde la raíz del proyecto:
```
npx prisma migrate dev --name add_sale_discount_pct --schema backend/prisma/schema.prisma
```

Si el comando pide nombre interactivo, escribir `add_sale_discount_pct`.

**Verificación:** el comando termina sin errores. El directorio `backend/prisma/migrations/` tiene una nueva carpeta con el SQL de `ALTER TABLE Sale ADD COLUMN discountPct`.

---

## Paso 0.3 — Actualizar `CreateSaleInput` en `backend/services/saleService.ts`

**Archivo:** `backend/services/saleService.ts`

Agregar `discountPct?: number | string` al final de `CreateSaleInput`:

```ts
export interface CreateSaleInput {
  items: CreateSaleItemInput[]
  payments: CreateSalePaymentInput[]
  total: DecimalInput
  date?: Date
  discountPct?: number | string
}
```

**Verificación:** `tsc --noEmit` sin errores de tipo en este archivo.

---

## Paso 0.4 — Actualizar la validación de total en `createSale` para soportar `discountPct`

**Archivo:** `backend/services/saleService.ts`

Dentro de la función `createSale`, reemplazar el bloque donde se calcula y valida `calculatedTotal` con la siguiente lógica (mantener todas las demás partes):

1. Calcular `calculatedSubtotal` como la suma de `unitPrice * quantity` de todos los ítems (renombrar la variable existente de `calculatedTotal` a `calculatedSubtotal`).

2. Parsear `discountPct`:
   - Si `data.discountPct` es `undefined`, usar `new Prisma.Decimal(0)`.
   - Si no, convertirlo con `toDecimal(data.discountPct)`.
   - Si el valor absoluto supera 200 (es decir, es mayor que 200 o menor que -200), lanzar: `new Error("discountPct must be in [-200, 200]")`.

3. Calcular `expectedTotal`:
   - `factor = Decimal(1) - discountPct / Decimal(100)`
   - `raw = calculatedSubtotal * factor`
   - Si `raw < 0`, `expectedTotal = Decimal(0)`, si no `expectedTotal = raw`

4. Comparar `clientTotal` contra `expectedTotal` (en vez de `calculatedSubtotal`):
   - Si `|clientTotal - expectedTotal| > MONEY_EPSILON`, lanzar error descriptivo.

5. El `total` canónico a persistir es `expectedTotal` (la recalculación del servidor, no el input del cliente).

6. Al crear la venta con `tx.sale.create`, incluir `discountPct` en los datos:
   ```ts
   data: {
     total,
     discountPct,
     ...(data.date ? { date: data.date } : {}),
     items: { ... },
     payments: { ... }
   }
   ```

**Verificación:** `tsc --noEmit` sin errores.

---

## Paso 0.5 — Relajar la validación de `paymentsSum` para aceptar overpayment

**Archivo:** `backend/services/saleService.ts`

Localizar el bloque de validación de `paymentsSum` (actualmente valida igualdad exacta con `MONEY_EPSILON`):

Reemplazar:
```ts
if (paymentsSum.sub(total).abs().gt(MONEY_EPSILON)) {
  throw new Error(
    `Payments sum (${paymentsSum.toString()}) must equal sale total (${total.toString()})`
  )
}
```

por:
```ts
if (total.sub(paymentsSum).gt(MONEY_EPSILON)) {
  throw new Error(
    `Payments sum (${paymentsSum.toString()}) is less than sale total (${total.toString()})`
  )
}
```

Esto permite que los pagos superen el total (el exceso es el vuelto en efectivo), pero sigue rechazando pagos insuficientes.

**Verificación:** `tsc --noEmit` sin errores.

---

## Paso 0.6 — Agregar filtros `minTotal` / `maxTotal` a `ListSalesFilters`

**Archivo:** `backend/services/saleService.ts`

Agregar `minTotal?: DecimalInput` y `maxTotal?: DecimalInput` a `ListSalesFilters`:

```ts
export interface ListSalesFilters extends PaginationInput {
  fromDate?: Date
  toDate?: Date
  method?: SalePaymentMethod | string
  productId?: number
  minTotal?: DecimalInput
  maxTotal?: DecimalInput
}
```

**Verificación:** `tsc --noEmit` sin errores.

---

## Paso 0.7 — Actualizar `buildSaleWhere` para filtrar por rango de precio

**Archivo:** `backend/services/saleService.ts`

En la función `buildSaleWhere`, agregar dentro del objeto retornado el filtro de `total`:

```ts
...((filters.minTotal !== undefined || filters.maxTotal !== undefined) ? {
  total: {
    ...(filters.minTotal !== undefined ? { gte: toDecimal(filters.minTotal) } : {}),
    ...(filters.maxTotal !== undefined ? { lte: toDecimal(filters.maxTotal) } : {})
  }
} : {})
```

Agregarlo junto a los filtros existentes de `date`, `payments`, `items`.

**Verificación:** `tsc --noEmit` sin errores en todo el backend.

---

## Paso 0.8 — Compilar el backend completo

Ejecutar:
```
npx tsc --noEmit --project tsconfig.json
```
o el comando de build equivalente del proyecto.

**Verificación:** cero errores de TypeScript.

---

# FASE 1 — Contratos IPC: actualizar tipos

## Paso 1.1 — Actualizar `electron/ipcContract.ts`

**Archivo:** `electron/ipcContract.ts`

**Cambio A:** agregar `discountPct: string` a `SaleFromApi` (después de `total`):
```ts
export interface SaleFromApi {
  id: number
  date: Date
  total: string
  discountPct: string
  items: SaleItemFromApi[]
  payments: SalePaymentFromApi[]
}
```

**Cambio B:** agregar `discountPct?: number | string` a `CreateSalePayload`:
```ts
export interface CreateSalePayload {
  items: CreateSaleItemPayload[]
  payments: CreateSalePaymentPayload[]
  total: number | string
  discountPct?: number | string
  date?: Date
}
```

**Cambio C:** agregar `minTotal?: number | string` y `maxTotal?: number | string` a `ListSalesFiltersPayload`:
```ts
export interface ListSalesFiltersPayload {
  skip?: number
  take?: number
  fromDate?: Date
  toDate?: Date
  method?: string
  productId?: number
  minTotal?: number | string
  maxTotal?: number | string
}
```

**Verificación:** `tsc --noEmit` sin errores en `electron/`.

---

## Paso 1.2 — Actualizar `renderer/src/electron-api.d.ts` (espejo de ipcContract.ts)

**Archivo:** `renderer/src/electron-api.d.ts`

Aplicar exactamente los mismos tres cambios del paso 1.1 en los tipos correspondientes del archivo:

**Cambio A:** agregar `discountPct: string` a `SaleFromApi`:
```ts
export type SaleFromApi = {
  id: number
  date: Date
  total: string
  discountPct: string
  items: SaleItemFromApi[]
  payments: SalePaymentFromApi[]
}
```

**Cambio B:** agregar `discountPct?: number | string` a `CreateSalePayload`:
```ts
export type CreateSalePayload = {
  items: CreateSaleItemPayload[]
  payments: CreateSalePaymentPayload[]
  total: number | string
  discountPct?: number | string
  date?: Date
}
```

**Cambio C:** agregar `minTotal?: number | string` y `maxTotal?: number | string` a `ListSalesFiltersPayload`:
```ts
export type ListSalesFiltersPayload = {
  skip?: number
  take?: number
  fromDate?: Date
  toDate?: Date
  method?: string
  productId?: number
  minTotal?: number | string
  maxTotal?: number | string
}
```

**Verificación:** `npm run build --prefix renderer` sin errores de tipo.

---

# FASE 2 — Actualizar flujo de confirmación en `Sells.tsx`

## Paso 2.1 — Pasar `discountPct` en `createSale`

**Archivo:** `renderer/src/Pages/Sells/Sells.tsx`

En `handleConfirmSale`, localizar la línea:
```ts
await window.api.createSale({ items, payments: paymentsPayload, total })
```

Reemplazar por:
```ts
await window.api.createSale({ items, payments: paymentsPayload, total, discountPct })
```

El valor `discountPct` ya existe en el scope de `Sells.tsx` como estado.

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 2.2 — Actualizar el `fakeSale` en tests que usan `SaleFromApi`

**Archivo:** `renderer/src/Pages/Sells/__tests__/Sells.confirm.test.tsx`

Localizar la definición de `fakeSale`:
```ts
const fakeSale: SaleFromApi = {
  id: 1,
  date: new Date(),
  total: '1000',
  items: [],
  payments: []
}
```

Agregar `discountPct: '0'`:
```ts
const fakeSale: SaleFromApi = {
  id: 1,
  date: new Date(),
  total: '1000',
  discountPct: '0',
  items: [],
  payments: []
}
```

**Verificación:** `npm test --prefix renderer` — todos en verde.

---

## Paso 2.3 — Agregar test: `discountPct` se envía al confirmar con descuento

**Archivo:** `renderer/src/Pages/Sells/__tests__/Sells.confirm.test.tsx`

Agregar dentro del `describe('Sells — flujo de confirmación de venta', ...)`:

```ts
it('confirmar con descuento del 10% envía discountPct=10 en el payload', async () => {
  const user = userEvent.setup()
  render(<Sells />)
  await addOneProduct()
  // total sin descuento = 1000; con 10% descuento = 900
  // El input de descuento está en el PaymentPanel; usar fireEvent para cambiarlo
  const discountInput = screen.getByRole('spinbutton', { name: /descuento/i }) as HTMLInputElement
  fireEvent.change(discountInput, { target: { value: '10' } })
  fireEvent.blur(discountInput)
  fireEvent.change(screen.getByRole('textbox', { name: 'EFECTIVO' }), { target: { value: '900' } })
  const approve = screen.getByRole('button', { name: 'APROBAR VENTA' })
  await waitFor(() => expect(approve).not.toBeDisabled())
  await user.click(approve)
  await waitFor(() => expect(createSale).toHaveBeenCalledTimes(1))
  const arg = createSale.mock.calls[0][0] as CreateSalePayload
  expect(Number(arg.discountPct)).toBe(10)
  expect(Number(arg.total)).toBeCloseTo(900, 1)
})
```

**Verificación:** `npm test --prefix renderer` — todos en verde (si el test falla por el selector del input de descuento, ajustar el selector según el aria-label real en PaymentPanel).

---

# FASE 3 — Navegación: nueva pestaña "Historial"

## Paso 3.1 — Agregar `'history'` al tipo `Cont`

**Archivo:** `renderer/src/renderTypes.ts`

Reemplazar:
```ts
export type Cont = 'sells' | 'stock' | null
```
por:
```ts
export type Cont = 'sells' | 'stock' | 'history' | null
```

**Verificación:** sin errores de compilación.

---

## Paso 3.2 — Agregar botón "Historial" en el Header

**Archivo:** `renderer/src/Pages/Header.tsx`

Dentro del `<ul className="Header__nav">`, agregar después del botón "Sells":
```tsx
<button
  className="header-button"
  onClick={() => handleClick("history")}
  aria-pressed={content === "history"}
>
  Historial
</button>
```

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 3.3 — Agregar render de `SalesHistory` en `App.tsx`

**Archivo:** `renderer/src/App.tsx`

Importar el componente (se creará en el paso 3.4):
```ts
import SalesHistory from "./Pages/SalesHistory/SalesHistory"
```

Agregar dentro del `<main className="app-content">`:
```tsx
{content === "history" && <SalesHistory />}
```

junto a los renders existentes de `sells` y `stock`.

**Verificación:** `npm run build --prefix renderer` va a fallar hasta que se cree el archivo del paso 3.4. Avanzar al siguiente paso.

---

## Paso 3.4 — Crear `SalesHistory.tsx` mínimo (placeholder)

**Archivo:** `renderer/src/Pages/SalesHistory/SalesHistory.tsx` (crear nuevo)

```tsx
export default function SalesHistory() {
  return <div>Historial de ventas — en construcción</div>
}
```

**Verificación:** `npm run build --prefix renderer` compila sin errores. Al hacer click en "Historial" en la nav, se muestra el placeholder.

---

# FASE 4 — Lógica de filtros: `salesHistoryFilters.ts`

## Paso 4.1 — Crear `renderer/src/Pages/SalesHistory/salesHistoryFilters.ts`

**Archivo:** `renderer/src/Pages/SalesHistory/salesHistoryFilters.ts` (crear nuevo)

Debe contener:

**1. Tipo `SalesHistoryFilters`:**
```ts
export interface SalesHistoryFilters {
  fromDate: string      // "YYYY-MM-DD" o vacío
  toDate: string        // "YYYY-MM-DD" o vacío
  fromTime: string      // "HH:MM" o vacío
  toTime: string        // "HH:MM" o vacío
  minTotal: string      // número como string o vacío
  maxTotal: string      // número como string o vacío
  method: string        // PaymentMethod o '' para "todas"
}

export const initialFilters: SalesHistoryFilters = {
  fromDate: '',
  toDate: '',
  fromTime: '',
  toTime: '',
  minTotal: '',
  maxTotal: '',
  method: ''
}
```

**2. Función `getSaleLocalTime(date: Date): string`:**
- Devuelve la hora local en formato "HH:MM" usando `Intl.DateTimeFormat` con `timeZone: 'America/Argentina/Buenos_Aires'`, `hour: '2-digit'`, `minute: '2-digit'`, `hour12: false`.
- Exportar para testear.

**3. Función `filterByTime(sales: SaleFromApi[], fromTime: string, toTime: string): SaleFromApi[]`:**
- Si ambos `fromTime` y `toTime` están vacíos, devolver `sales` sin filtrar.
- Si solo `fromTime`, incluir las ventas con hora `>= fromTime`.
- Si solo `toTime`, incluir las ventas con hora `<= toTime`.
- Si ambos, incluir las ventas con hora `>= fromTime && <= toTime`.
- El cruce de medianoche (ej: 22:00 a 02:00) **no se maneja en esta versión**; si `fromTime > toTime`, devolver `sales` sin filtrar (tratar como sin filtro de tiempo).
- La comparación es lexicográfica sobre strings "HH:MM" (funciona porque el formato está normalizado).
- Exportar.

**4. Función `buildApiFilters(filters: SalesHistoryFilters): ListSalesFiltersPayload`:**
- Devuelve un objeto con solo los campos definidos (sin claves con `undefined`).
- `fromDate`: si no está vacío, crear `new Date(filters.fromDate + 'T00:00:00')` → campo `fromDate`.
- `toDate`: si no está vacío, crear `new Date(filters.toDate + 'T23:59:59')` → campo `toDate`.
- `method`: si no está vacío → campo `method`.
- `minTotal`: si no está vacío y es un número válido → campo `minTotal` como string.
- `maxTotal`: si no está vacío y es un número válido → campo `maxTotal` como string.
- Los filtros `fromTime` y `toTime` **no se envían al backend** (se aplican en el cliente con `filterByTime`).
- Exportar.

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 4.2 — Crear tests de `salesHistoryFilters.ts`

**Archivo:** `renderer/src/Pages/SalesHistory/__tests__/salesHistoryFilters.test.ts` (crear nuevo)

**Tests de `filterByTime`:**

Usar un helper para crear un `SaleFromApi` mínimo con una fecha:
```ts
function makeSale(isoDate: string): SaleFromApi {
  return {
    id: 1,
    date: new Date(isoDate),
    total: '100',
    discountPct: '0',
    items: [],
    payments: []
  }
}
```

Tests:
1. `'sin filtros → devuelve todo'`: `filterByTime([sale1, sale2], '', '')` devuelve ambas.
2. `'solo fromTime: excluye ventas anteriores'`: venta a las 10:00 y venta a las 15:00, `fromTime='12:00'` → solo devuelve la de 15:00.
3. `'solo toTime: excluye ventas posteriores'`: venta a las 10:00 y venta a las 15:00, `toTime='12:00'` → solo devuelve la de 10:00.
4. `'rango normal: incluye ventas dentro del rango'`: tres ventas a 09:00, 14:00, 20:00. Rango 12:00-16:00 → solo la de 14:00.
5. `'fromTime == toTime: solo venta exacta'`: venta a 14:00. Rango 14:00-14:00 → la incluye.
6. `'fromTime > toTime (cruce de medianoche): sin filtro'`: `fromTime='22:00', toTime='02:00'` → devuelve todo sin filtrar.
7. `'lista vacía → devuelve lista vacía'`: `filterByTime([], '10:00', '20:00')` → `[]`.

**Tests de `buildApiFilters`:**

1. `'filtros vacíos → objeto vacío (sin campos undefined)'`: `buildApiFilters(initialFilters)` devuelve `{}`.
2. `'fromDate y toDate → incluye fromDate como inicio del día y toDate como fin del día'`: `buildApiFilters({ ...initialFilters, fromDate: '2024-03-01', toDate: '2024-03-31' })` → `fromDate` es Date a medianoche inicio, `toDate` es Date a 23:59:59.
3. `'method → incluye method'`: `buildApiFilters({ ...initialFilters, method: 'CASH' })` → `{ method: 'CASH' }`.
4. `'minTotal y maxTotal → incluye como string'`: `buildApiFilters({ ...initialFilters, minTotal: '500', maxTotal: '2000' })` → `{ minTotal: '500', maxTotal: '2000' }`.
5. `'fromTime y toTime → NO aparecen en el resultado'`: el objeto retornado no tiene propiedades `fromTime` ni `toTime`.

**Verificación:** `npm test --prefix renderer` — todos en verde.

---

# FASE 5 — Componente `SalesHistory`: panel de filtros + lista

## Paso 5.1 — Implementar estado y estructura base en `SalesHistory.tsx`

**Archivo:** `renderer/src/Pages/SalesHistory/SalesHistory.tsx`

Reemplazar el placeholder por la estructura completa:

**Estado del componente:**
- `filters: SalesHistoryFilters` — estado de los controles de filtro, inicializado con `initialFilters`.
- `sales: SaleFromApi[]` — lista de resultados, inicialmente `[]`.
- `loading: boolean` — inicialmente `false`.
- `selectedSale: SaleFromApi | null` — venta seleccionada para el modal, inicialmente `null`.

**Función `loadSales()`:**
```ts
async function loadSales() {
  setLoading(true)
  try {
    const apiFilters = buildApiFilters(filters)
    const result = await window.api.listSales(apiFilters)
    const filtered = filterByTime(result, filters.fromTime, filters.toTime)
    setSales(filtered)
  } finally {
    setLoading(false)
  }
}
```

**`useEffect` de carga inicial:** llamar `loadSales()` una sola vez al montar el componente (array de dependencias vacío `[]`).

**Estructura JSX:**
```tsx
return (
  <section className="sales-history">
    {/* Panel de filtros */}
    <div className="sales-history__filters">
      {/* — pasos 5.2 y 5.3 — */}
    </div>
    {/* Tabla de resultados */}
    <div className="sales-history__list">
      {/* — paso 5.4 — */}
    </div>
    {/* Modal de detalle */}
    {/* — integrar en Fase 6 — */}
  </section>
)
```

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 5.2 — Implementar panel de filtros

**Archivo:** `renderer/src/Pages/SalesHistory/SalesHistory.tsx`

Reemplazar el comentario del panel de filtros por los controles:

**Fila 1 — Fechas:**
- Label + `<input type="date">` para `fromDate` (desde fecha)
- Label + `<input type="date">` para `toDate` (hasta fecha)

**Fila 2 — Franjas horarias:**
- Label + `<input type="time">` para `fromTime` (desde hora)
- Label + `<input type="time">` para `toTime` (hasta hora)

**Fila 3 — Precios:**
- Label + `<input type="number" min="0" step="0.01">` para `minTotal` (precio mínimo)
- Label + `<input type="number" min="0" step="0.01">` para `maxTotal` (precio máximo)

**Fila 4 — Método de pago:**
- `<select>` con las opciones:
  - `value=""` → "Todos los medios"
  - `value="CASH"` → "EFECTIVO"
  - `value="DEBIT"` → "DÉBITO"
  - `value="CREDIT"` → "CRÉDITO"
  - `value="TRANSFER"` → "TRANSFERENCIA"
  - `value="OTHER"` → "OTROS"

**Botón:** `<button type="button" onClick={loadSales}>Buscar</button>`

Cada control llama a `setFilters(prev => ({ ...prev, [campo]: valor }))` en su `onChange`.

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 5.3 — Implementar tabla de lista de ventas

**Archivo:** `renderer/src/Pages/SalesHistory/SalesHistory.tsx`

Reemplazar el comentario de la tabla por:

Si `loading === true`, mostrar `<p>Cargando...</p>`.

Si `sales.length === 0`, mostrar `<p className="sales-history__empty">No se encontraron ventas con los filtros aplicados.</p>`.

Si hay ventas, mostrar una tabla con:
- Header: `ID | Fecha y hora | Total | Medios de pago`
- Por cada `sale` en `sales`:
  - Fila clickable: `onClick={() => setSelectedSale(sale)}` y `tabIndex={0}` y `onKeyDown` que dispara click en Enter/Space.
  - `sale.id`
  - Fecha y hora formateada: `new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(sale.date))`
  - Total: usar `formatMoney` importado de `renderer/src/utils/format.ts` con `Number(sale.total)`.
  - Medios de pago: `sale.payments.map(p => PAYMENT_LABELS[p.method as PaymentMethod] ?? p.method).join(', ')`.
    - `PAYMENT_LABELS` es el Record importado de `renderer/src/Pages/Sells/payments.ts`.
    - Si `sale.payments` está vacío, mostrar `—`.

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 5.4 — Crear `SalesHistory.css`

**Archivo:** `renderer/src/Pages/SalesHistory/SalesHistory.css` (crear nuevo)

Estilos mínimos:

```css
.sales-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  flex: 1 1 auto;
  min-height: 0;
  box-sizing: border-box;
  overflow: auto;
}

.sales-history__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: flex-end;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
}

.sales-history__filters label {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  font-weight: 600;
  gap: 4px;
}

.sales-history__filters input,
.sales-history__filters select {
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.sales-history__list table {
  width: 100%;
  border-collapse: collapse;
}

.sales-history__list th {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 2px solid #e5e7eb;
  font-size: 13px;
  color: #6b7280;
}

.sales-history__row {
  cursor: pointer;
}

.sales-history__row:hover {
  background: #f0f4ff;
}

.sales-history__row td {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

.sales-history__empty {
  color: #6b7280;
  text-align: center;
  padding: 32px;
}
```

Importar el CSS en `SalesHistory.tsx`:
```ts
import './SalesHistory.css'
```

**Verificación:** visual — la pantalla se ve ordenada.

---

# FASE 6 — Componente `SaleDetailModal`

## Paso 6.1 — Crear `SaleDetailModal.tsx` con estructura básica

**Archivo:** `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx` (crear nuevo)

Props:
```ts
interface SaleDetailModalProps {
  sale: SaleFromApi | null
  onClose: () => void
}
```

- Si `sale === null`, el componente devuelve `null` (no renderiza nada).
- Estructura cuando hay venta:
  ```tsx
  <div className="modal-overlay" onClick={onClose}>
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Venta #${sale.id}`}
      onClick={e => e.stopPropagation()}
    >
      <button className="modal__close" type="button" onClick={onClose} aria-label="Cerrar">✕</button>
      <h2 className="modal__title">Venta #{sale.id}</h2>
      {/* — contenido — pasos 6.2 a 6.4 — */}
    </div>
  </div>
  ```

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 6.2 — Agregar header del modal: fecha, hora e ID

**Archivo:** `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx`

Después del `<h2>`, agregar un párrafo con la fecha/hora de la venta:
```tsx
<p className="modal__date">
  {new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(new Date(sale.date))}
</p>
```

---

## Paso 6.3 — Sección de ítems del modal

**Archivo:** `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx`

Agregar debajo del header una tabla de ítems:

- Header de tabla: `Producto | Cantidad | Precio unitario | Subtotal`
- Por cada `item` en `sale.items`:
  - Nombre: `item.product.name`
  - Cantidad: `item.quantity`
  - Precio unitario: `formatMoney(Number(item.unitPrice))`
  - Subtotal línea: `formatMoney(item.quantity * Number(item.unitPrice))`

---

## Paso 6.4 — Sección de pie del modal: totales y pagos

**Archivo:** `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx`

Calcular y mostrar:

**Subtotal** (suma de todas las líneas):
```ts
const subtotal = sale.items.reduce((acc, item) => acc + item.quantity * Number(item.unitPrice), 0)
```

**Descuento/Recargo:**
```ts
const pct = Number(sale.discountPct)
```
- Si `pct > 0`: mostrar fila "Descuento: X%"
- Si `pct < 0`: mostrar fila "Recargo: X%"
- Si `pct === 0`: no mostrar fila de descuento

**Total final:** `formatMoney(Number(sale.total))`

**Pagos desglosados:** por cada `payment` en `sale.payments`:
- Método en español: `PAYMENT_LABELS[payment.method as PaymentMethod] ?? payment.method`
- Monto: `formatMoney(Number(payment.amount))`

Agregar una sección `<div className="modal__totals">` para este bloque.

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 6.5 — Accesibilidad: foco y Escape

**Archivo:** `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx`

Agregar:

1. Un `ref` al div `.modal` y un `useEffect` que haga `focus()` sobre él cuando `sale !== null`:
   ```ts
   const modalRef = useRef<HTMLDivElement>(null)
   useEffect(() => {
     if (sale !== null) modalRef.current?.focus()
   }, [sale])
   ```
   Agregar `tabIndex={-1}` al div `.modal` para que sea enfocable.

2. Un `useEffect` que escucha `keydown` en el documento y llama `onClose` cuando `key === 'Escape'` y `sale !== null`:
   ```ts
   useEffect(() => {
     const handler = (e: KeyboardEvent) => {
       if (e.key === 'Escape') onClose()
     }
     if (sale !== null) {
       document.addEventListener('keydown', handler)
       return () => document.removeEventListener('keydown', handler)
     }
   }, [sale, onClose])
   ```

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 6.6 — Crear estilos del modal en `SaleDetailModal.css`

**Archivo:** `renderer/src/Pages/SalesHistory/SaleDetailModal.css` (crear nuevo)

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  outline: none;
}

.modal__close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #6b7280;
}

.modal__title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px;
}

.modal__date {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 16px;
}

.modal table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.modal th {
  text-align: left;
  padding: 8px;
  border-bottom: 2px solid #e5e7eb;
  font-size: 13px;
  color: #6b7280;
}

.modal td {
  padding: 8px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
}

.modal__totals {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  border-top: 2px solid #e5e7eb;
  padding-top: 12px;
}

.modal__totals-row {
  display: flex;
  gap: 16px;
  font-size: 14px;
}

.modal__totals-row--total {
  font-size: 16px;
  font-weight: 700;
}
```

Importar el CSS en `SaleDetailModal.tsx`:
```ts
import './SaleDetailModal.css'
```

**Verificación:** `npm run build --prefix renderer` sin errores.

---

## Paso 6.7 — Integrar `SaleDetailModal` en `SalesHistory.tsx`

**Archivo:** `renderer/src/Pages/SalesHistory/SalesHistory.tsx`

1. Importar `SaleDetailModal`:
   ```ts
   import SaleDetailModal from './SaleDetailModal'
   ```

2. Agregar el modal al JSX, después del div de la lista y dentro del `<section>`:
   ```tsx
   <SaleDetailModal
     sale={selectedSale}
     onClose={() => setSelectedSale(null)}
   />
   ```

**Verificación:** `npm run build --prefix renderer` sin errores. Hacer click en una fila abre el modal.

---

# FASE 7 — Tests del renderer

## Paso 7.1 — Crear tests del componente `SalesHistory`

**Archivo:** `renderer/src/Pages/SalesHistory/__tests__/SalesHistory.test.tsx` (crear nuevo)

Mockear `window.api.listSales` en `beforeEach`.

**Helper:** crear `makeSale(overrides)` para generar un `SaleFromApi` mínimo:
```ts
function makeSale(overrides: Partial<SaleFromApi> = {}): SaleFromApi {
  return {
    id: 1,
    date: new Date('2024-03-15T14:00:00'),
    total: '1000',
    discountPct: '0',
    items: [],
    payments: [{ id: 1, saleId: 1, method: 'CASH', amount: '1000' }],
    ...overrides
  }
}
```

**Tests a incluir:**

1. `'al montar, llama window.api.listSales y muestra las ventas'`:
   - Mock retorna `[makeSale({ id: 1 }), makeSale({ id: 2 })]`
   - Verificar que aparezcan los IDs 1 y 2 en el DOM.

2. `'muestra mensaje de vacío si no hay ventas'`:
   - Mock retorna `[]`
   - Verificar que aparezca el mensaje de sin resultados.

3. `'click en "Buscar" vuelve a llamar listSales con los filtros aplicados'`:
   - Cambiar el select de método de pago a "CASH".
   - Hacer click en "Buscar".
   - Verificar que `listSales` fue llamada con `{ method: 'CASH' }` (o que incluye ese campo).

4. `'click en una fila abre el modal de detalle'`:
   - Mock retorna `[makeSale({ id: 5 })]`
   - Esperar a que aparezca la fila.
   - Hacer click en la fila.
   - Verificar que aparece "Venta #5" en el DOM.

5. `'cerrar el modal limpia la selección'`:
   - Abrir el modal (igual que el test anterior).
   - Click en el botón ✕ del modal.
   - Verificar que "Venta #5" ya no aparece en el DOM.

6. `'muestra total formateado en ARS en la lista'`:
   - Mock retorna `[makeSale({ total: '15000' })]`
   - Verificar que el texto formateado (con signo ARS o similar) aparece en la tabla.

**Verificación:** `npm test --prefix renderer` — todos en verde.

---

## Paso 7.2 — Crear tests de `SaleDetailModal`

**Archivo:** `renderer/src/Pages/SalesHistory/__tests__/SaleDetailModal.test.tsx` (crear nuevo)

**Helper `makeSale`** (mismo que el anterior, reutilizar o copiar):

**Tests a incluir:**

1. `'no renderiza nada si sale es null'`:
   - Renderizar `<SaleDetailModal sale={null} onClose={vi.fn()} />`.
   - Verificar que el DOM no tiene "Venta #".

2. `'muestra el ID de la venta'`:
   - Renderizar con `makeSale({ id: 42 })`.
   - Verificar que aparece "Venta #42".

3. `'lista los ítems con nombre, cantidad, precio unitario y subtotal'`:
   - Crear una venta con un ítem: `{ quantity: 3, unitPrice: '500', product: { name: 'Aceite', ... } }`.
   - Verificar que aparecen "Aceite", "3", el precio unitario y el subtotal de línea (1500).

4. `'muestra subtotal calculado como suma de líneas'`:
   - Venta con dos ítems: 2×500 y 3×200.
   - Verificar que el subtotal mostrado es 1600 (en alguna forma formateada).

5. `'muestra descuento cuando discountPct > 0'`:
   - `makeSale({ discountPct: '10' })`.
   - Verificar que el texto "10%" o "Descuento" aparece en el modal.

6. `'no muestra descuento cuando discountPct es 0'`:
   - `makeSale({ discountPct: '0' })`.
   - Verificar que NO aparece "Descuento" ni "Recargo" en el modal.

7. `'muestra los pagos con método en español y monto'`:
   - Venta con `payments: [{ method: 'CASH', amount: '500' }, { method: 'TRANSFER', amount: '500' }]`.
   - Verificar que aparecen "EFECTIVO" y "TRANSFERENCIA".

8. `'Escape llama a onClose'`:
   - Renderizar el modal con venta válida.
   - Disparar `fireEvent.keyDown(document, { key: 'Escape' })`.
   - Verificar que `onClose` fue llamado.

9. `'click en overlay llama onClose'`:
   - Hacer click en el overlay (fuera del modal).
   - Verificar que `onClose` fue llamado.

10. `'click dentro del modal NO llama onClose'`:
    - Hacer click en el div `.modal` interior.
    - Verificar que `onClose` NO fue llamado.

**Verificación:** `npm test --prefix renderer` — todos en verde.

---

# FASE 8 — Verificación final

## Paso 8.1 — Suite completa de tests

Ejecutar:
```
npm test --prefix renderer
```

Esperado: **todos los tests en verde**. Si alguno falla, arreglarlo antes de cerrar.

---

## Paso 8.2 — Verificación visual manual

Ejecutar `npm run dev` desde la raíz y abrir la app.

**Checklist:**

1. El botón "Historial" aparece en el Header y navega a la pantalla correcta.
2. Al abrir "Historial", se carga automáticamente la lista de ventas.
3. El panel de filtros tiene: 2 inputs de fecha, 2 de hora, 2 de precio y 1 selector de método.
4. Cambiar el método de pago y hacer click en "Buscar" filtra los resultados.
5. Ingresar un rango de fechas y hacer click en "Buscar" — los resultados reflejan el filtro.
6. Ingresar una franja horaria (ej: 10:00 a 18:00) y hacer "Buscar" — se aplica en el cliente.
7. Ingresar un rango de precio — filtra por total de venta.
8. Click en una venta abre el modal con todos los datos de la venta.
9. El modal muestra: ID, fecha/hora, tabla de productos (nombre/cantidad/precio/subtotal), subtotal total, descuento si aplica, total final y lista de pagos con métodos en español.
10. Apretar Escape cierra el modal.
11. Click en el overlay cierra el modal.
12. Click en ✕ cierra el modal.
13. Crear una venta desde la pantalla "Sells" con descuento (ej: 10%) → confirmar → ir a "Historial" → la venta aparece con el descuento correcto en el modal.

---

# Resumen de archivos a modificar / crear

| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | Agregar campo `discountPct Decimal @default(0)` a `Sale` |
| `backend/prisma/migrations/…` | Nueva migración generada automáticamente |
| `backend/services/saleService.ts` | `CreateSaleInput` + validación de total con descuento + paymentsSum relax + filtros de precio |
| `electron/ipcContract.ts` | `SaleFromApi.discountPct`, `CreateSalePayload.discountPct`, `ListSalesFiltersPayload` con minTotal/maxTotal |
| `renderer/src/electron-api.d.ts` | Espejo de los cambios de ipcContract.ts |
| `renderer/src/renderTypes.ts` | Agregar `'history'` |
| `renderer/src/Pages/Header.tsx` | Agregar botón "Historial" |
| `renderer/src/App.tsx` | Importar y renderizar `SalesHistory` |
| `renderer/src/Pages/Sells/Sells.tsx` | Pasar `discountPct` en `createSale` |
| `renderer/src/Pages/Sells/__tests__/Sells.confirm.test.tsx` | Actualizar `fakeSale` + agregar test de discountPct |
| `renderer/src/Pages/SalesHistory/SalesHistory.tsx` | Componente nuevo |
| `renderer/src/Pages/SalesHistory/SalesHistory.css` | Estilos nuevos |
| `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx` | Componente nuevo |
| `renderer/src/Pages/SalesHistory/SaleDetailModal.css` | Estilos nuevos |
| `renderer/src/Pages/SalesHistory/salesHistoryFilters.ts` | Lógica de filtros nueva |
| `renderer/src/Pages/SalesHistory/__tests__/salesHistoryFilters.test.ts` | Tests de filtros nuevos |
| `renderer/src/Pages/SalesHistory/__tests__/SalesHistory.test.tsx` | Tests del componente nuevos |
| `renderer/src/Pages/SalesHistory/__tests__/SaleDetailModal.test.tsx` | Tests del modal nuevos |
