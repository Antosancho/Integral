# Plan: Feature "Estadísticas"

## Decisiones de diseño

### Campo `purchasePriceSnapshot` en `SaleItem`
Se agrega `purchasePriceSnapshot Decimal?` al modelo `SaleItem`. Es nullable para retrocompatibilidad con ventas ya existentes. Al crear una venta nueva, se guarda el `purchasePrice` del producto en ese momento. Los ítems "general" (sin `productId`) quedan con `null`.

### Cálculo de ganancia
`Ganancia = Σ (unitPrice - purchasePriceSnapshot) × quantity` solo para `SaleItem` donde `productId IS NOT NULL` y `purchasePriceSnapshot IS NOT NULL`. Los ítems sin snapshot (ventas antiguas o general) se excluyen sin error.

### Backend: repositorio dedicado
Se crea `backend/repositories/statsRepository.ts` con 6 funciones de agregación. Se usa Prisma ORM sin raw SQL (se agrupa en JS cuando Prisma no lo soporta directamente). Las funciones de fecha usan `Date.getHours()` / `Date.getDay()` del objeto Date de Prisma para evitar dependencia del formato interno SQLite.

### IPC: 6 canales nuevos
`stats:getSummary`, `stats:getTopProductsByQuantity`, `stats:getTopProductsByRevenue`, `stats:getSalesByHour`, `stats:getSalesByWeekday`, `stats:getLowRotationProducts`.

### Comparación contra período anterior
El frontend llama a `stats:getSummary` dos veces en paralelo (período actual + período anterior). La función `getPreviousPeriod` es calendar-aware: para 'month' retorna el mes calendario anterior; para 'week' retrocede 7 días; para el resto usa el mismo rango en milisegundos.

### Frontend: período de análisis
4 presets: **Hoy** | **Esta semana** (lun–dom) | **Este mes** | **Personalizado**. Default al abrir: **Este mes**. Las 7 llamadas de carga se hacen en `Promise.all`.

---

## Archivos nuevos
- `backend/repositories/statsRepository.ts`
- `renderer/src/Pages/Stats/statsUtils.ts`
- `renderer/src/Pages/Stats/Stats.tsx`
- `renderer/src/Pages/Stats/Stats.css`
- `renderer/src/Pages/Stats/__tests__/statsUtils.test.ts`
- `renderer/src/Pages/Stats/__tests__/Stats.test.tsx`

## Archivos modificados
- `backend/prisma/schema.prisma`
- `backend/services/saleService.ts`
- `backend/repositories/index.ts`
- `electron/ipcContract.ts`
- `electron/ipcHandlers.ts`
- `renderer/src/electron-api.d.ts`
- `renderer/src/renderTypes.ts`
- `renderer/src/App.tsx`
- `renderer/src/Pages/Header.tsx`

---

## Pasos

---

### SECCIÓN A — Schema y migración

---

#### Paso 1 — Editar `backend/prisma/schema.prisma`

En el modelo `SaleItem`, agregar el campo **después de `unitPrice`**:

```prisma
model SaleItem {
  id                    Int      @id @default(autoincrement())
  saleId                Int
  productId             Int?
  quantity              Int
  unitPrice             Decimal
  purchasePriceSnapshot Decimal?   // <-- nuevo

  sale    Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product Product? @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([saleId])
  @@index([productId])
}
```

El campo es `Decimal?` (nullable). No tiene `@default`.

---

#### Paso 2 — Ejecutar migración Prisma

```bash
npx prisma migrate dev --name add-purchase-price-snapshot
```

Verificar que termina sin errores y que la columna aparece en la DB.

---

#### Paso 3 — Actualizar `backend/services/saleService.ts`

**Cambio 1**: en la sección donde se hace `tx.product.findMany` (alrededor de la línea 161), el `select` actualmente solo pide `{ id: true }`. Cambiarlo para también pedir `purchasePrice`:

```ts
const existingProducts = await tx.product.findMany({
  where: { id: { in: productIds } },
  select: { id: true, purchasePrice: true }   // agregar purchasePrice
})
```

**Cambio 2**: construir un mapa `productId → purchasePrice` justo después de la validación de existencia (después del `if (existingProducts.length !== productIds.length)`):

```ts
const purchasePriceMap = new Map<number, Prisma.Decimal>()
for (const p of existingProducts) {
  purchasePriceMap.set(p.id, p.purchasePrice)
}
```

**Cambio 3**: en la llamada `tx.sale.create`, dentro del `items.create`, agregar `purchasePriceSnapshot` al payload de cada ítem. El map de ítems actualmente es:

```ts
items: {
  create: normalizedItems.map((item) => ({
    productId: item.productId ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice
  }))
}
```

Reemplazarlo por:

```ts
items: {
  create: normalizedItems.map((item) => ({
    productId: item.productId ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    purchasePriceSnapshot: item.productId != null
      ? purchasePriceMap.get(item.productId) ?? null
      : null
  }))
}
```

**Nota**: el bloque `if (productIds.length > 0)` que contiene el `findMany` existente solo se ejecuta cuando hay ítems con productId. El `purchasePriceMap` debe declararse fuera de ese bloque (con `new Map()` vacío por default) para que el map de ítems no falle en ventas solo-general.

---

### SECCIÓN B — Stats Repository

---

#### Paso 4 — Crear `backend/repositories/statsRepository.ts`

Crear el archivo con los tipos de retorno y 6 funciones exportadas. Import necesario: `import prisma from '../db/client'` y `import { Prisma } from '@prisma/client'`.

**Tipos de retorno** (definir al principio del archivo):

```ts
export type StatsSummary = {
  totalRevenue: string
  saleCount: number
  averageTicket: string
  totalProfit: string
}

export type TopProductResult = {
  productId: number
  productName: string
  value: string   // unidades (como string) o monto (Decimal.toString())
}

export type SalesByPeriodResult = {
  label: string          // '00'–'23' para hora; '0'–'6' para weekday (0=Dom)
  saleCount: number
  totalRevenue: string
}

export type LowRotationResult = {
  productId: number
  productName: string
  totalQuantity: number
}
```

---

**Función 1 — `getSalesSummary(from: Date, to: Date): Promise<StatsSummary>`**

Ejecutar dos queries en paralelo con `Promise.all`:

- Query A: `prisma.sale.aggregate` con `_sum: { total: true }` y `_count: { id: true }`, filtrado por `date: { gte: from, lte: to }`.

- Query B: `prisma.saleItem.findMany` con:
  ```ts
  where: {
    sale: { date: { gte: from, lte: to } },
    productId: { not: null },
    purchasePriceSnapshot: { not: null }
  },
  select: { quantity: true, unitPrice: true, purchasePriceSnapshot: true }
  ```

Con los resultados:
- `totalRevenue = aggResult._sum.total?.toString() ?? '0'`
- `saleCount = aggResult._count.id`
- Calcular `totalProfit` iterando sobre los SaleItems de Query B:
  ```ts
  let profit = new Prisma.Decimal(0)
  for (const item of profitItems) {
    const margin = new Prisma.Decimal(item.unitPrice).sub(item.purchasePriceSnapshot!)
    profit = profit.add(margin.mul(item.quantity))
  }
  ```
- `averageTicket`: si `saleCount === 0`, retornar `'0'`. Si no: `new Prisma.Decimal(totalRevenue).div(saleCount).toDecimalPlaces(2).toString()`.
- Retornar el objeto `StatsSummary` con todos los campos como `string`.

---

**Función 2 — `getTopProductsByQuantity(from: Date, to: Date, limit: number): Promise<TopProductResult[]>`**

```ts
const grouped = await prisma.saleItem.groupBy({
  by: ['productId'],
  where: {
    sale: { date: { gte: from, lte: to } },
    productId: { not: null }
  },
  _sum: { quantity: true },
  orderBy: { _sum: { quantity: 'desc' } },
  take: limit
})
```

Luego:
1. Extraer `productIds = grouped.map(g => g.productId!)`.
2. Si está vacío, retornar `[]`.
3. `prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })`.
4. Construir un `Map<number, string>` de id → name.
5. Retornar `grouped.map(g => ({ productId: g.productId!, productName: nameMap.get(g.productId!) ?? 'Desconocido', value: (g._sum.quantity ?? 0).toString() }))`.

---

**Función 3 — `getTopProductsByRevenue(from: Date, to: Date, limit: number): Promise<TopProductResult[]>`**

No usar `groupBy` aquí porque Prisma no puede agregar `unitPrice * quantity` directamente. En cambio:

1. Traer todos los SaleItems del período con productId:
   ```ts
   const items = await prisma.saleItem.findMany({
     where: {
       sale: { date: { gte: from, lte: to } },
       productId: { not: null }
     },
     select: { productId: true, quantity: true, unitPrice: true }
   })
   ```

2. Agrupar en JS con un `Map<number, Prisma.Decimal>` de `productId → revenueAcumulado`. Para cada item: `map.set(id, (map.get(id) ?? Decimal(0)).add(Decimal(unitPrice).mul(quantity)))`.

3. Convertir a array, ordenar por revenue desc, tomar `limit`.

4. Traer nombres con `prisma.product.findMany` sobre los ids resultantes.

5. Retornar `TopProductResult[]` con `value: revenue.toDecimalPlaces(2).toString()`.

---

**Función 4 — `getSalesByHour(from: Date, to: Date): Promise<SalesByPeriodResult[]>`**

1. Traer todas las ventas del período:
   ```ts
   const sales = await prisma.sale.findMany({
     where: { date: { gte: from, lte: to } },
     select: { date: true, total: true }
   })
   ```

2. Agrupar en JS por hora (`sale.date.getHours()`):
   ```ts
   const byHour = new Map<number, { count: number; total: Prisma.Decimal }>()
   for (const sale of sales) {
     const h = sale.date.getHours()
     const prev = byHour.get(h) ?? { count: 0, total: new Prisma.Decimal(0) }
     byHour.set(h, { count: prev.count + 1, total: prev.total.add(sale.total) })
   }
   ```

3. Convertir a `SalesByPeriodResult[]` con `label = hour.toString().padStart(2, '0')`, ordenar por label ASC.

---

**Función 5 — `getSalesByWeekday(from: Date, to: Date): Promise<SalesByPeriodResult[]>`**

Igual que `getSalesByHour` pero usando `sale.date.getDay()` (0=Domingo, 6=Sábado) en lugar de `getHours()`. El `label` es `weekday.toString()` (sin padding).

---

**Función 6 — `getLowRotationProducts(from: Date, to: Date, limit: number): Promise<LowRotationResult[]>`**

```ts
// Paso A: todos los productos
const allProducts = await prisma.product.findMany({
  select: { id: true, name: true }
})

// Paso B: productos vendidos en el período con su cantidad total
const soldGroups = await prisma.saleItem.groupBy({
  by: ['productId'],
  where: {
    sale: { date: { gte: from, lte: to } },
    productId: { not: null }
  },
  _sum: { quantity: true }
})

// Paso C: construir mapa productId → totalQuantity
const soldMap = new Map<number, number>()
for (const g of soldGroups) {
  soldMap.set(g.productId!, g._sum.quantity ?? 0)
}

// Paso D: merge con todos los productos (0 para los no vendidos)
const results: LowRotationResult[] = allProducts.map(p => ({
  productId: p.id,
  productName: p.name,
  totalQuantity: soldMap.get(p.id) ?? 0
}))

// Paso E: ordenar ASC por cantidad (los de menor rotación primero), tomar limit
results.sort((a, b) => a.totalQuantity - b.totalQuantity)
return results.slice(0, limit)
```

---

#### Paso 5 — Actualizar `backend/repositories/index.ts`

Agregar la re-exportación del nuevo repositorio al final del archivo:

```ts
export * from './statsRepository'
```

---

### SECCIÓN C — IPC

---

#### Paso 6 — Actualizar `electron/ipcContract.ts`

**Parte 1**: agregar los 6 tipos de output al archivo, junto a los tipos existentes de `SaleFromApi`, etc.:

```ts
export interface StatsSummaryFromApi {
  totalRevenue: string
  saleCount: number
  averageTicket: string
  totalProfit: string
}

export interface TopProductFromApi {
  productId: number
  productName: string
  value: string
}

export interface SalesByPeriodFromApi {
  label: string
  saleCount: number
  totalRevenue: string
}

export interface LowRotationFromApi {
  productId: number
  productName: string
  totalQuantity: number
}
```

**Parte 2**: agregar los 6 métodos al final de la interfaz `ElectronApi` (después de `getSaleById`):

```ts
getSalesSummary(input: { from: Date; to: Date }): Promise<StatsSummaryFromApi>
getTopProductsByQuantity(input: { from: Date; to: Date; limit: number }): Promise<TopProductFromApi[]>
getTopProductsByRevenue(input: { from: Date; to: Date; limit: number }): Promise<TopProductFromApi[]>
getSalesByHour(input: { from: Date; to: Date }): Promise<SalesByPeriodFromApi[]>
getSalesByWeekday(input: { from: Date; to: Date }): Promise<SalesByPeriodFromApi[]>
getLowRotationProducts(input: { from: Date; to: Date; limit: number }): Promise<LowRotationFromApi[]>
```

**Parte 3**: agregar los 6 métodos al objeto retornado por `buildElectronApi`, siguiendo exactamente el mismo patrón que los de `sale:*`:

```ts
getSalesSummary: (input) => call<StatsSummaryFromApi>('stats:getSummary', input),
getTopProductsByQuantity: (input) => call<TopProductFromApi[]>('stats:getTopProductsByQuantity', input),
getTopProductsByRevenue: (input) => call<TopProductFromApi[]>('stats:getTopProductsByRevenue', input),
getSalesByHour: (input) => call<SalesByPeriodFromApi[]>('stats:getSalesByHour', input),
getSalesByWeekday: (input) => call<SalesByPeriodFromApi[]>('stats:getSalesByWeekday', input),
getLowRotationProducts: (input) => call<LowRotationFromApi[]>('stats:getLowRotationProducts', input),
```

---

#### Paso 7 — Actualizar `electron/ipcHandlers.ts`

**Import**: agregar las 6 funciones del repositorio al bloque de imports de `../backend/repositories`:

```ts
import {
  // ... imports existentes ...
  getSalesSummary,
  getTopProductsByQuantity,
  getTopProductsByRevenue,
  getSalesByHour,
  getSalesByWeekday,
  getLowRotationProducts
} from '../backend/repositories'
```

**Handlers**: agregar los 6 al objeto retornado por `buildIpcHandlers()`, después de los handlers de `sale:*`. Seguir exactamente el patrón `withChannelError`:

```ts
'stats:getSummary': withChannelError<{ from: Date; to: Date }>(
  'stats:getSummary',
  ({ from, to }) => getSalesSummary(from, to)
),
'stats:getTopProductsByQuantity': withChannelError<{ from: Date; to: Date; limit: number }>(
  'stats:getTopProductsByQuantity',
  ({ from, to, limit }) => getTopProductsByQuantity(from, to, limit)
),
'stats:getTopProductsByRevenue': withChannelError<{ from: Date; to: Date; limit: number }>(
  'stats:getTopProductsByRevenue',
  ({ from, to, limit }) => getTopProductsByRevenue(from, to, limit)
),
'stats:getSalesByHour': withChannelError<{ from: Date; to: Date }>(
  'stats:getSalesByHour',
  ({ from, to }) => getSalesByHour(from, to)
),
'stats:getSalesByWeekday': withChannelError<{ from: Date; to: Date }>(
  'stats:getSalesByWeekday',
  ({ from, to }) => getSalesByWeekday(from, to)
),
'stats:getLowRotationProducts': withChannelError<{ from: Date; to: Date; limit: number }>(
  'stats:getLowRotationProducts',
  ({ from, to, limit }) => getLowRotationProducts(from, to, limit)
),
```

---

#### Paso 8 — Actualizar `renderer/src/electron-api.d.ts`

Agregar los 4 tipos de output y los 6 métodos. El archivo `electron-api.d.ts` es el que usa el renderer; sus tipos son los `*FromApi`. Simplemente copiar las interfaces definidas en el Paso 6 (`StatsSummaryFromApi`, `TopProductFromApi`, `SalesByPeriodFromApi`, `LowRotationFromApi`) al archivo, exportadas. Luego agregar los 6 métodos a la interfaz `ElectronApi` del archivo (con los mismos tipos).

**Nota**: este archivo duplica manualmente los tipos del backend. No importar desde `../electron/ipcContract`.

---

### SECCIÓN D — Routing frontend

---

#### Paso 9 — Actualizar `renderer/src/renderTypes.ts`

Agregar `'stats'` al tipo `Cont`. El tipo actual es:

```ts
type Cont = 'sells' | 'stock' | 'history' | null
```

Debe quedar:

```ts
type Cont = 'sells' | 'stock' | 'history' | 'stats' | null
```

---

#### Paso 10 — Actualizar `renderer/src/App.tsx`

1. Agregar el import del nuevo componente junto a los imports existentes:
   ```ts
   import Stats from './Pages/Stats/Stats'
   ```

2. Agregar el case en el render condicional, siguiendo el mismo patrón que `'history'` y `'stock'`:
   ```tsx
   {content === 'stats' && <Stats />}
   ```

---

#### Paso 11 — Actualizar `renderer/src/Pages/Header.tsx`

Agregar el botón "Estadísticas" en la barra de nav, siguiendo exactamente el mismo patrón que los botones existentes. Ubicarlo después del botón de "Historial":

```tsx
<button
  className={content === 'stats' ? 'header__nav-btn--active' : 'header__nav-btn'}
  onClick={() => setContent('stats')}
>
  Estadísticas
</button>
```

---

### SECCIÓN E — Frontend Stats Page

---

#### Paso 12 — Crear `renderer/src/Pages/Stats/statsUtils.ts`

Archivo de funciones puras. Sin imports de React ni de `window.api`.

**Tipos exportados:**

```ts
export type PeriodPreset = 'today' | 'week' | 'month' | 'custom'
export type DateRange = { from: Date; to: Date }
```

**`getStartOfDay(d: Date): Date`** — retorna un nuevo `Date` con `.setHours(0, 0, 0, 0)`.

**`getEndOfDay(d: Date): Date`** — retorna un nuevo `Date` con `.setHours(23, 59, 59, 999)`.

**`getPeriodDates(preset: PeriodPreset, customFrom?: Date, customTo?: Date): DateRange`**

- `'today'`: `{ from: getStartOfDay(new Date()), to: getEndOfDay(new Date()) }`
- `'week'`: calcular el lunes de la semana actual. `getDay()` retorna 0=Dom, 1=Lun...6=Sáb. El offset al lunes es `(getDay() + 6) % 7` días hacia atrás. El domingo de fin de semana es `lunes + 6` días.
  ```ts
  const today = new Date()
  const dayOfWeek = today.getDay()
  const offsetToMonday = (dayOfWeek + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - offsetToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: getStartOfDay(monday), to: getEndOfDay(sunday) }
  ```
- `'month'`: primer día del mes actual y último día del mes actual.
  ```ts
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: getStartOfDay(firstDay), to: getEndOfDay(lastDay) }
  ```
- `'custom'`: retornar `{ from: customFrom!, to: customTo! }` sin modificar. El caller garantiza que no son `undefined`.

**`getPreviousPeriod(range: DateRange, preset: PeriodPreset): DateRange`**

- `'month'`: el mes calendario anterior.
  ```ts
  const refDate = range.from
  const firstDayPrev = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1)
  const lastDayPrev = new Date(refDate.getFullYear(), refDate.getMonth(), 0)
  return { from: getStartOfDay(firstDayPrev), to: getEndOfDay(lastDayPrev) }
  ```
- `'week'`: restar 7 días a ambos extremos.
  ```ts
  const from = new Date(range.from); from.setDate(from.getDate() - 7)
  const to = new Date(range.to);     to.setDate(to.getDate() - 7)
  return { from, to }
  ```
- `'today'` y `'custom'`: misma duración en ms corrida hacia atrás.
  ```ts
  const durationMs = range.to.getTime() - range.from.getTime() + 1
  return {
    from: new Date(range.from.getTime() - durationMs),
    to:   new Date(range.from.getTime() - 1)
  }
  ```

**`calcPctChange(current: number, previous: number): number | null`**

- Si `previous === 0`: retornar `null`.
- Si no: retornar `((current - previous) / previous) * 100`.

**`formatPctChange(pct: number | null): string`**

- `null` → `'N/A'`
- `>= 0` → `'+' + pct.toFixed(1) + '%'`
- `< 0` → `pct.toFixed(1) + '%'` (el signo negativo ya lo incluye `toFixed`)

**`formatMoney`** — **no definir aquí**. Importar desde el util compartido existente:

```ts
export { formatMoney } from '../../utils/format'
```

**`WEEKDAY_LABELS`** — constante exportada:

```ts
export const WEEKDAY_LABELS: Record<string, string> = {
  '0': 'Domingo', '1': 'Lunes', '2': 'Martes',
  '3': 'Miércoles', '4': 'Jueves', '5': 'Viernes', '6': 'Sábado'
}
```

**`PERIOD_LABELS`** — constante exportada:

```ts
export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
  custom: 'Personalizado'
}
```

---

#### Paso 13 — Crear `renderer/src/Pages/Stats/Stats.css`

Crear el archivo de estilos. Seguir la paleta de colores del proyecto (azul #3b82f6, grises, blanco).

**Clases a definir:**

- `.stats-page` — `padding: 24px; max-width: 1200px; margin: 0 auto`
- `.stats-period-selector` — `display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap`
- `.stats-period-btn` — mismo estilo base que `.stock-actions__btn-new` del proyecto
- `.stats-period-btn--active` — fondo azul (#3b82f6), texto blanco
- `.stats-custom-range` — `display: flex; align-items: center; gap: 8px; margin-bottom: 16px`
- `.stats-custom-range input[type="date"]` — `padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px`
- `.stats-loading` — `text-align: center; color: #64748b; margin-top: 48px`
- `.stats-error` — `color: #dc2626; font-weight: 600`
- `.stats-section` — `margin-bottom: 32px`
- `.stats-section__title` — `font-size: 1.1rem; font-weight: 600; margin-bottom: 12px; color: #1e293b`
- `.stats-cards` — `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 8px`. En pantallas < 900px: `grid-template-columns: repeat(2, 1fr)`
- `.stat-card` — `background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px`
- `.stat-card__label` — `font-size: 0.8rem; color: #64748b; margin: 0 0 4px 0`
- `.stat-card__value` — `font-size: 1.4rem; font-weight: 700; margin: 0 0 4px 0; color: #1e293b`
- `.stat-card__change` — `font-size: 0.8rem; margin: 0`
- `.stat-card__change--positive` — `color: #16a34a`
- `.stat-card__change--negative` — `color: #dc2626`
- `.stat-card__change--neutral` — `color: #64748b`
- `.stats-tables-row` — `display: flex; gap: 24px; flex-wrap: wrap`
- `.stats-table-container` — `flex: 1; min-width: 280px`
- `.stats-table-container h3` — `font-size: 0.95rem; font-weight: 600; margin: 0 0 8px 0; color: #334155`
- `.stats-table` — `width: 100%; border-collapse: collapse; font-size: 0.9rem`
- `.stats-table th` — `text-align: left; padding: 6px 8px; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0`
- `.stats-table td` — `padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b`
- `.stats-table tbody tr:hover` — `background: #f8fafc`
- `.stats-temporal-tabs` — `display: flex; gap: 4px; margin-bottom: 10px`
- `.stats-temporal-tab` — botón pequeño sin fondo activo, borde ligero
- `.stats-temporal-tab--active` — subrayado o fondo azul claro
- `.stats-empty` — `color: #94a3b8; font-size: 0.9rem; padding: 12px 8px`

---

#### Paso 14 — Crear `renderer/src/Pages/Stats/Stats.tsx`

**Imports:**

```ts
import { useState, useEffect, useCallback } from 'react'
import type {
  StatsSummaryFromApi, TopProductFromApi,
  SalesByPeriodFromApi, LowRotationFromApi
} from '../../electron-api'
import {
  getPeriodDates, getPreviousPeriod, calcPctChange, formatPctChange,
  formatMoney, WEEKDAY_LABELS, PERIOD_LABELS,
  type PeriodPreset, type DateRange
} from './statsUtils'
import './Stats.css'
```

**Componente interno `StatCard`** (definir antes o dentro del componente principal):

```tsx
function StatCard({
  label, value, prevValue, format
}: {
  label: string
  value: number
  prevValue: number
  format: (v: number) => string
}) {
  const pct = calcPctChange(value, prevValue)
  const pctStr = formatPctChange(pct)
  const changeClass =
    pct === null ? 'neutral' : pct > 0 ? 'positive' : pct < 0 ? 'negative' : 'neutral'

  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className="stat-card__value">{format(value)}</p>
      <p className={`stat-card__change stat-card__change--${changeClass}`}>
        {pctStr} vs período anterior
      </p>
    </div>
  )
}
```

**Estado del componente `Stats`:**

```ts
const [preset, setPreset] = useState<PeriodPreset>('month')
const [customFrom, setCustomFrom] = useState('')   // string yyyy-mm-dd
const [customTo, setCustomTo]   = useState('')

const [loading, setLoading]   = useState(false)
const [error, setError]       = useState<string | null>(null)

const [summary, setSummary]         = useState<StatsSummaryFromApi | null>(null)
const [prevSummary, setPrevSummary] = useState<StatsSummaryFromApi | null>(null)
const [topByQty, setTopByQty]       = useState<TopProductFromApi[]>([])
const [topByRev, setTopByRev]       = useState<TopProductFromApi[]>([])
const [byHour, setByHour]           = useState<SalesByPeriodFromApi[]>([])
const [byWeekday, setByWeekday]     = useState<SalesByPeriodFromApi[]>([])
const [lowRot, setLowRot]           = useState<LowRotationFromApi[]>([])

const [temporalTab, setTemporalTab] = useState<'hour' | 'weekday'>('hour')
```

**`getCurrentRange(): DateRange | null`** — función (no hook) que calcula el rango actual:

```ts
function getCurrentRange(): DateRange | null {
  if (preset === 'custom') {
    if (!customFrom || !customTo) return null
    const from = new Date(customFrom + 'T00:00:00')
    const to   = new Date(customTo   + 'T23:59:59.999')
    if (from > to) return null
    return { from, to }
  }
  return getPeriodDates(preset)
}
```

**`loadStats`** — función `useCallback` con dependencia `[preset]`:

```ts
const loadStats = useCallback(async (range: DateRange) => {
  setLoading(true)
  setError(null)
  try {
    const prev = getPreviousPeriod(range, preset)
    const LIMIT = 5
    const LOW_LIMIT = 10
    const [cur, prv, qty, rev, hour, wday, low] = await Promise.all([
      window.api.getSalesSummary({ from: range.from, to: range.to }),
      window.api.getSalesSummary({ from: prev.from,  to: prev.to  }),
      window.api.getTopProductsByQuantity({ from: range.from, to: range.to, limit: LIMIT }),
      window.api.getTopProductsByRevenue(  { from: range.from, to: range.to, limit: LIMIT }),
      window.api.getSalesByHour(           { from: range.from, to: range.to }),
      window.api.getSalesByWeekday(        { from: range.from, to: range.to }),
      window.api.getLowRotationProducts(   { from: range.from, to: range.to, limit: LOW_LIMIT })
    ])
    setSummary(cur);   setPrevSummary(prv)
    setTopByQty(qty);  setTopByRev(rev)
    setByHour(hour);   setByWeekday(wday)
    setLowRot(low)
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Error al cargar estadísticas')
  } finally {
    setLoading(false)
  }
}, [preset])
```

**Nota sobre `preset` en `loadStats`**: `getPreviousPeriod` necesita el `preset` para ser calendar-aware. Por eso `preset` es dependencia del `useCallback`. Esto es correcto; cuando cambia el preset, `loadStats` se recrea y el `useEffect` lo detecta.

**`useEffect` que dispara la carga:**

```ts
useEffect(() => {
  const range = getCurrentRange()
  if (range) loadStats(range)
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [preset, customFrom, customTo, loadStats])
```

**JSX — estructura completa del return:**

```tsx
return (
  <div className="stats-page">

    {/* Selector de período */}
    <div className="stats-period-selector">
      {(['today', 'week', 'month', 'custom'] as PeriodPreset[]).map(p => (
        <button
          key={p}
          className={`stats-period-btn${preset === p ? ' stats-period-btn--active' : ''}`}
          onClick={() => setPreset(p)}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>

    {preset === 'custom' && (
      <div className="stats-custom-range">
        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
        <span>—</span>
        <input type="date" value={customTo}   onChange={e => setCustomTo(e.target.value)} />
      </div>
    )}

    {loading && <p className="stats-loading">Cargando...</p>}
    {error   && <p className="stats-error">{error}</p>}

    {!loading && summary && prevSummary && (
      <>
        {/* Sección 1: Cards de resumen */}
        <section className="stats-section">
          <h2 className="stats-section__title">Resumen del período</h2>
          <div className="stats-cards">
            <StatCard
              label="Ventas Totales"
              value={parseFloat(summary.totalRevenue)}
              prevValue={parseFloat(prevSummary.totalRevenue)}
              format={v => formatMoney(v)}
            />
            <StatCard
              label="Cantidad de Ventas"
              value={summary.saleCount}
              prevValue={prevSummary.saleCount}
              format={v => v.toString()}
            />
            <StatCard
              label="Ticket Promedio"
              value={parseFloat(summary.averageTicket)}
              prevValue={parseFloat(prevSummary.averageTicket)}
              format={v => formatMoney(v)}
            />
            <StatCard
              label="Ganancia Total"
              value={parseFloat(summary.totalProfit)}
              prevValue={parseFloat(prevSummary.totalProfit)}
              format={v => formatMoney(v)}
            />
          </div>
        </section>

        {/* Sección 2: Top productos */}
        <section className="stats-section">
          <h2 className="stats-section__title">Productos</h2>
          <div className="stats-tables-row">

            <div className="stats-table-container">
              <h3>Más vendidos (por unidades)</h3>
              <table className="stats-table">
                <thead><tr><th>#</th><th>Producto</th><th>Unidades</th></tr></thead>
                <tbody>
                  {topByQty.length === 0
                    ? <tr><td colSpan={3} className="stats-empty">Sin datos</td></tr>
                    : topByQty.map((p, i) => (
                        <tr key={p.productId}>
                          <td>{i + 1}</td>
                          <td>{p.productName}</td>
                          <td>{p.value}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            <div className="stats-table-container">
              <h3>Más facturan (por monto)</h3>
              <table className="stats-table">
                <thead><tr><th>#</th><th>Producto</th><th>Facturado</th></tr></thead>
                <tbody>
                  {topByRev.length === 0
                    ? <tr><td colSpan={3} className="stats-empty">Sin datos</td></tr>
                    : topByRev.map((p, i) => (
                        <tr key={p.productId}>
                          <td>{i + 1}</td>
                          <td>{p.productName}</td>
                          <td>{formatMoney(p.value)}</td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

          </div>
        </section>

        {/* Sección 3: Análisis temporal */}
        <section className="stats-section">
          <h2 className="stats-section__title">Horarios y días con más ventas</h2>
          <div className="stats-temporal-tabs">
            <button
              className={`stats-temporal-tab${temporalTab === 'hour' ? ' stats-temporal-tab--active' : ''}`}
              onClick={() => setTemporalTab('hour')}
            >
              Por hora
            </button>
            <button
              className={`stats-temporal-tab${temporalTab === 'weekday' ? ' stats-temporal-tab--active' : ''}`}
              onClick={() => setTemporalTab('weekday')}
            >
              Por día de semana
            </button>
          </div>
          <table className="stats-table">
            <thead>
              <tr>
                <th>{temporalTab === 'hour' ? 'Hora' : 'Día'}</th>
                <th>Cantidad de ventas</th>
                <th>Total facturado</th>
              </tr>
            </thead>
            <tbody>
              {(temporalTab === 'hour' ? byHour : byWeekday).length === 0
                ? <tr><td colSpan={3} className="stats-empty">Sin ventas en el período</td></tr>
                : (temporalTab === 'hour' ? byHour : byWeekday).map(row => (
                    <tr key={row.label}>
                      <td>
                        {temporalTab === 'hour'
                          ? `${row.label}:00`
                          : (WEEKDAY_LABELS[row.label] ?? row.label)
                        }
                      </td>
                      <td>{row.saleCount}</td>
                      <td>{formatMoney(row.totalRevenue)}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </section>

        {/* Sección 4: Baja rotación */}
        <section className="stats-section">
          <h2 className="stats-section__title">Productos con menor rotación</h2>
          <table className="stats-table">
            <thead>
              <tr><th>Producto</th><th>Unidades vendidas en el período</th></tr>
            </thead>
            <tbody>
              {lowRot.length === 0
                ? <tr><td colSpan={2} className="stats-empty">Sin datos</td></tr>
                : lowRot.map(p => (
                    <tr key={p.productId}>
                      <td>{p.productName}</td>
                      <td>{p.totalQuantity}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </section>
      </>
    )}

  </div>
)
```

---

### SECCIÓN F — Tests

---

#### Paso 15 — Crear `renderer/src/Pages/Stats/__tests__/statsUtils.test.ts`

Archivo de tests unitarios puros. Import: `import { describe, it, expect } from 'vitest'` y las funciones de `statsUtils`.

**Grupo `getPeriodDates`:**

1. `'today' retorna from con hora 00:00:00 y to con hora 23:59:59`
   - Verificar `result.from.getHours() === 0` y `result.from.getMinutes() === 0`.
   - Verificar `result.to.getHours() === 23` y `result.to.getSeconds() === 59`.

2. `'week' retorna un lunes como from`
   - Verificar `result.from.getDay() === 1`.

3. `'week' retorna un domingo como to`
   - Verificar `result.to.getDay() === 0`.

4. `'week' el to está exactamente 6 días después del from`
   - Diferencia en días entre `to` y `from` === 6.

5. `'month' el from es el día 1 del mes`
   - Verificar `result.from.getDate() === 1`.

6. `'month' el to es el último día del mes (no igual a 1 del siguiente)`
   - Verificar `new Date(result.to.getTime() + 1).getDate() === 1` (el día siguiente al `to` es el 1° del mes siguiente).

7. `'custom' retorna exactamente los valores pasados`
   - Pasar un `customFrom` y `customTo` concretos. Verificar que son los mismos objetos (o mismos timestamps).

**Grupo `getPreviousPeriod` con preset `'month'`:**

8. `retorna el mes calendario anterior`
   - Pasar un rango de abril. Verificar que `result.from.getMonth()` es marzo (2).

9. `para enero retorna diciembre del año anterior`
   - Pasar un rango de enero 2025. Verificar que `result.from.getFullYear() === 2024` y `result.from.getMonth() === 11`.

**Grupo `getPreviousPeriod` con preset `'week'`:**

10. `retrocede exactamente 7 días`
    - Pasar un rango de 7 días. Verificar que `result.from` es `range.from - 7 días`.

**Grupo `getPreviousPeriod` con preset `'today'`:**

11. `retorna el día anterior`
    - Pasar `{ from: startOfToday, to: endOfToday }`. Verificar que `result.from` es start de ayer y `result.to` es end de ayer.

**Grupo `calcPctChange`:**

12. `(120, 100) → 20`
13. `(80, 100) → -20`
14. `(100, 0) → null`
15. `(0, 0) → null`
16. `(0, 100) → -100`
17. `(100, 100) → 0`

**Grupo `formatPctChange`:**

18. `null → 'N/A'`
19. `20 → '+20.0%'`
20. `-20 → '-20.0%'`
21. `0 → '+0.0%'`

**Grupo `formatMoney`:**

22. `'1000' produce un string que contiene '1.000'` (separador de miles es-AR)
23. `0 produce un string que contiene '0'`

---

#### Paso 16 — Crear `renderer/src/Pages/Stats/__tests__/Stats.test.tsx`

**Imports necesarios:**

```ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Stats from '../Stats'
import type { StatsSummaryFromApi, TopProductFromApi, SalesByPeriodFromApi, LowRotationFromApi } from '../../../electron-api'
```

**Mocks de datos:**

```ts
const mockSummary: StatsSummaryFromApi = {
  totalRevenue: '50000',
  saleCount: 10,
  averageTicket: '5000',
  totalProfit: '20000'
}

const mockTopProduct: TopProductFromApi = {
  productId: 1, productName: 'Coca Cola', value: '100'
}

const mockPeriodRow: SalesByPeriodFromApi = {
  label: '10', saleCount: 3, totalRevenue: '15000'
}

const mockLowRot: LowRotationFromApi = {
  productId: 2, productName: 'Aceite', totalQuantity: 1
}
```

**`beforeEach`:**

```ts
beforeEach(() => {
  ;(window as unknown as { api: unknown }).api = {
    getSalesSummary:          vi.fn().mockResolvedValue(mockSummary),
    getTopProductsByQuantity: vi.fn().mockResolvedValue([mockTopProduct]),
    getTopProductsByRevenue:  vi.fn().mockResolvedValue([mockTopProduct]),
    getSalesByHour:           vi.fn().mockResolvedValue([mockPeriodRow]),
    getSalesByWeekday:        vi.fn().mockResolvedValue([mockPeriodRow]),
    getLowRotationProducts:   vi.fn().mockResolvedValue([mockLowRot])
  }
})
```

**Tests:**

1. `renderiza los 4 botones de período`
   - Verificar que existen los botones con texto 'Hoy', 'Esta semana', 'Este mes', 'Personalizado'.

2. `el preset default "Este mes" está activo al montar`
   - Verificar que el botón 'Este mes' tiene la clase `stats-period-btn--active`.

3. `al montar llama a getSalesSummary exactamente 2 veces (actual + anterior)`
   - `waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(2))`.

4. `al montar llama a las 7 funciones de la API`
   - Verificar que las 6 funciones del mock fueron llamadas al menos 1 vez.

5. `muestra "Cargando..." mientras fetchea`
   - Mockear todas las funciones con `new Promise(() => {})` (que nunca resuelven).
   - Verificar que `screen.getByText('Cargando...')` existe.

6. `después de cargar muestra las 4 cards de resumen`
   - `waitFor(() => screen.getByText('Ventas Totales'))`.
   - También verificar: 'Cantidad de Ventas', 'Ticket Promedio', 'Ganancia Total'.

7. `muestra el valor formateado de totalRevenue en la card`
   - Verificar que aparece un string con `'$'` y el valor de `mockSummary.totalRevenue`.

8. `muestra la tabla "Más vendidos" con el producto mockeado`
   - `waitFor(() => screen.getAllByText('Coca Cola'))` — puede aparecer dos veces (en ambas tablas).
   - Verificar que existe al menos una aparición.

9. `la sección temporal muestra la tabla "Por hora" por default`
   - Verificar que el botón 'Por hora' tiene la clase activa.
   - Verificar que aparece '10:00' (label del mockPeriodRow formateado como hora).

10. `click en "Por día de semana" cambia la tabla temporal`
    - Click en el botón 'Por día de semana'.
    - Verificar que el botón tiene la clase activa.
    - Verificar que '10:00' ya no aparece y en su lugar aparece el label de día (como `WEEKDAY_LABELS['10']` que será `undefined` → se muestra '10', o bien que el contenido cambia).

11. `muestra la tabla de baja rotación con el producto mockeado`
    - `waitFor(() => screen.getByText('Aceite'))`.

12. `click en "Esta semana" recarga todos los datos`
    - Hacer click en 'Esta semana'.
    - Verificar que `getSalesSummary` fue llamado más veces (al menos 4: 2 iniciales + 2 nuevas).

13. `click en "Hoy" recarga todos los datos`
    - Similar al anterior.

14. `al seleccionar "Personalizado" aparecen los dos inputs de fecha`
    - Click en 'Personalizado'.
    - Verificar `screen.getAllByDisplayValue('')` o bien verificar que existen inputs `type="date"`.

15. `con "Personalizado" sin fechas no dispara fetch adicional`
    - Click en 'Personalizado' sin completar fechas.
    - Verificar que `getSalesSummary` no fue llamado más que las veces iniciales.

16. `con "Personalizado" con ambas fechas completas dispara fetch`
    - Click en 'Personalizado'.
    - Completar ambos date inputs con `fireEvent.change`.
    - Verificar que `getSalesSummary` fue llamado más veces.

17. `error de API muestra mensaje de error`
    - Mockear `getSalesSummary` para rechazar con `new Error('Fallo de red')`.
    - `waitFor(() => screen.getByText('Fallo de red'))`.
    - Verificar que las cards de resumen NO se muestran.

18. `la card de cantidad de ventas muestra el saleCount`
    - `waitFor(() => screen.getByText('10'))` — el saleCount del mock.

19. `el cambio % aparece en las cards`
    - Dado que tanto `summary` como `prevSummary` son el mismo mock (mismo `totalRevenue`), el cambio debería ser `+0.0%`.
    - `waitFor(() => screen.getAllByText('+0.0% vs período anterior'))`.

---

#### Paso 17 — Correr los tests

```bash
npx vitest run renderer/src/Pages/Stats/__tests__/statsUtils.test.ts
npx vitest run renderer/src/Pages/Stats/__tests__/Stats.test.tsx
```

Luego verificar que no hay regresiones en el resto:

```bash
npx vitest run
```

Todos los tests deben pasar en verde. No saltear ninguno con `skip`.

---

### Paso 18 — Verificación manual

1. Iniciar la app con `npm run dev`.
2. Verificar que en el header aparece el botón "Estadísticas".
3. Navegar a Estadísticas → se carga con preset "Este mes" por default.
4. Verificar que las 4 cards aparecen con valores (o ceros si no hay ventas en el mes).
5. Cambiar entre los presets (Hoy, Esta semana, Personalizado) y verificar que los datos se recargan.
6. Con "Personalizado": ingresar dos fechas y verificar que la tabla de datos se actualiza.
7. Cambiar tabs "Por hora" / "Por día de semana" y verificar que la tabla cambia.
8. Crear una venta de prueba desde la pantalla de Sells.
9. Volver a Estadísticas y verificar que la venta nueva aparece en los conteos.
10. Verificar que el campo `purchasePriceSnapshot` se guardó correctamente en la DB (abrir Prisma Studio: `npx prisma studio`) y revisar un `SaleItem` de la venta recién creada.

---

## Resumen de dependencias

| Componente | Depende de |
|---|---|
| `statsRepository.ts` | Prisma client, `Prisma.Decimal` |
| `ipcHandlers.ts` (stats) | `statsRepository.ts` |
| `ipcContract.ts` (stats) | tipos locales |
| `electron-api.d.ts` (stats) | tipos duplicados manualmente |
| `Stats.tsx` | `statsUtils.ts`, `window.api.get*` |
| `statsUtils.ts` | sin dependencias externas |

**El schema Prisma cambia** → requiere migración antes de ejecutar cualquier otra cosa. Seguir el orden de las secciones estrictamente: A → B → C → D → E → F.
