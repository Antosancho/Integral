# Planes de la iteración: formulario de producto + filtro horario en Estadísticas

Este archivo junta los dos planes que se ejecutaron en paralelo (ramas `fix/producto-form` y `feat/stats-horario`).

---

# Plan — Estadísticas: filtro horario (Todo el día · Jornada laboral · Personalizado)

> **Para quién es este plan:** un modelo de IA de menor potencia que lo ejecuta paso a paso en el worktree
> `C:\Users\asant\Music\Integral\wt-stats` (rama `feat/stats-horario`). Hacé los pasos **en orden**. Cada paso es chico
> a propósito: hacelo, corré su **checkpoint** y recién ahí seguí. Si un checkpoint falla, arreglalo antes de avanzar
> (ver Apéndice C — Troubleshooting). No improvises: si algo no está en el plan, elegí lo más parecido a lo que ya hace
> el código existente.

**Reglas para el ejecutor**

1. Trabajá **solo** dentro de `C:\Users\asant\Music\Integral\wt-stats`. No toques `C:\Users\asant\Music\Integral\Integral` ni `C:\Users\asant\Music\Integral\wt-producto` (otro agente trabaja ahí en paralelo, en el formulario de producto y en el estilo global de scrollbars).
2. **No hagas commits ni push.** Al final dejá todo sin commitear (Paso 5.7).
3. **No toques:** `design-system/` (solo lectura), `renderer/src/styles/bundle.css`, `renderer/src/styles/tokens.css`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/prisma/dev.db`, `electron/preload.ts`, ni nada de `renderer/src/Pages/SalesHistory/` (su filtro de hora queda como está). No hay migración: el schema no cambia.
4. Prohibido en el renderer: `type="time"`, `type="number"`, colores hardcodeados (siempre `var(--token)`), los glifos `⚠` y `✕`, emojis. Los imports de solo tipos van con `import type` o con el modificador `type` dentro de las llaves (el renderer usa `verbatimModuleSyntax`). Nada de `enum` (`erasableSyntaxOnly`). No dejes imports ni variables sin usar (`noUnusedLocals`).
5. Copiá **literalmente** los textos de UI de este plan (español rioplatense, voseo). La raya de las franjas de hora (`08–09 h`) es `–` (U+2013), la misma que ya usa `HOUR_LABEL`.
6. Ningún test toca `dev.db`: el test de backend nuevo usa `createMigratedTestDb` (DB temporal vacía).
7. CSS nuevo **solo** dentro del bloque delimitado de `app.css` (Paso 4.4). En `CLAUDE.md` **solo** se reemplaza la subsección del módulo de Estadísticas (Paso 5.6).
8. No agregues dependencias. No cambies versiones.
9. Todas las fechas, en código y en tests, se arman con `new Date(año, mes0, día, h, min)` (hora local; el mes empieza en 0: octubre = 9). Nunca sumes milisegundos para armar una fecha nueva (restar dos fechas para **contar** días, como hace `countDays`, sí está bien). `getPreviousPeriod` no se toca.

---

## 0. Supuestos y preguntas abiertas

El plan ya aplica la recomendación de cada fila. Si el usuario elige otra cosa, se ajusta el paso indicado.

| # | Tema | Qué hace este plan (recomendación) | Alternativa | Pasos afectados |
|---|---|---|---|---|
| P1 | ¿Se recuerda el **modo** horario elegido? | **No.** Al abrir Estadísticas arranca siempre en **Todo el día** (decisión del usuario: es el default). Lo que sí se recuerda es la **franja de la jornada** (localStorage). | Guardar también el último modo (una clave más). | 4.5 |
| P2 | Tope del período con filtro horario | Con una franja activa el período puede tener **hasta 366 días** (`MAX_FILTERED_DAYS`). Solo se puede exceder en "Personalizado": no se consulta y aparece un aviso. Medido: 31 días ≈ 10 ms por consulta, 366 días ≈ 0,3–0,8 s; el costo crece con el cuadrado de los días. Sin franja no hay tope (como hoy). | Subir el tope (más lento) o un segundo camino de cálculo en JS (más código). | 3.7, 4.6 |
| P3 | "Hoy" entre `hasta` y `desde` (ej. 05:00 con jornada 08→02) | "Hoy" = el día comercial que **empieza hoy** a las 08:00 (todavía sin ventas) y "vs. ayer" compara con la noche anterior. Solo entre las 00:00 y `hasta` (01:59) "Hoy" es el día comercial de ayer, que sigue en curso. | Que entre 02:00 y 08:00 "Hoy" siga mostrando el día que cerró a las 02:00. | 3.7 |
| P4 | `desde == hasta` | Día comercial de **24 h** que empieza en `desde` (06:00 → 06:00 del día siguiente). | Tratarlo como inválido. | 3.7 |
| P5 | `hasta` inclusivo o exclusivo | **Exclusivo** (`desde` inclusivo). Con 08:00→02:00 la venta de las 02:00:00 no entra; la de las 01:59 sí. | — | 1.2, 3.7 |
| P6 | Horas de "Personalizado" | Arrancan **vacías** (como las fechas personalizadas). No se consulta hasta tener las dos horas válidas. | Precargarlas con la jornada. | 4.5 |
| P7 | Alcance | Solo el panel de Estadísticas. Ventas › Historial y el resumen de caja no cambian. | Usar la jornada también en Historial (otra iteración). | — |
| P8 | Textos | "Horario" · "Todo el día" / "Jornada laboral" / "Personalizado" · "Cambiar jornada" · "Abre" / "Cierra" · "Guardar jornada" / "Cancelar" · "Desde hora" / "Hasta hora" (igual que en Historial) · "De 08:00 a 02:00 del día siguiente". | — | 4.2 |

---

## 1. Contexto

### 1.1 Qué hay que hacer

En el panel de Estadísticas (`renderer/src/Pages/Stats/Stats.tsx`) agregar, debajo del selector de período, una fila **"Horario"** con un segmentado **Todo el día | Jornada laboral | Personalizado** que filtra **todo** el panel por franja horaria, incluida una franja que cruza la medianoche (ej. de 08:00 a 02:00 del día siguiente).

### 1.2 Decisiones del usuario (no re-discutir)

- El filtro horario se suma al de período y afecta a **todo**: los 4 KPIs, la comparación con el período anterior (misma franja aplicada al período anterior), los rankings, "Por hora" / "Por día de semana" y "Menor rotación".
- Opciones: **"Todo el día"** (default, comportamiento actual), **"Jornada laboral"** (franja predeterminada, configurable y recordada en localStorage; default **08:00 → 02:00**) y **"Personalizado"** (desde / hasta en `HH:MM`).
- "Si estás filtrando solo por días, la venta del martes a la 01:00 cuenta para el martes; si estás filtrando por días comerciales (franja que cruza la medianoche), cuenta para el lunes."
- Horas con texto enmascarado `HH:MM` (como `DateField`), nunca `type="time"`.

### 1.3 Semántica exacta de las franjas (reglas R1–R11)

| Regla | Detalle |
|---|---|
| **R1** | Una franja (`TimeWindow`) es `{ startMinute, endMinute }` en minutos desde las 00:00 (0–1439). `desde` (start) es **inclusivo**; `hasta` (end) es **exclusivo**. |
| **R2** | **"Todo el día"** = sin franja: el período son días calendario `[D 00:00:00.000, D 23:59:59.999]`, **exactamente como hoy**. El payload **no** lleva la clave `intervals`. |
| **R3** | Franja del **mismo día** (`start < end`, ej. 09:00→13:00): por cada día D del período, intervalo `[D start, D end)`. |
| **R4** | Franja que **cruza la medianoche** (`end <= start`, ej. 08:00→02:00): cada día D del período es un **día comercial** `[D start, D+1 end)`. Bordes: `end == start` → 24 h exactas (`[D 08:00, D+1 08:00)`); `end = 00:00` → hasta la medianoche (`[D 08:00, D+1 00:00)`). |
| **R5** | **Día ancla**: cada intervalo pertenece al día D en el que **empieza**. La venta cuenta para ese día, tanto para entrar en el período como en "Por día de semana". Con 08→02, la venta del martes 01:00 es del **lunes**. |
| **R6** | **Día comercial en curso** (`getBusinessToday(now, franja)`): si la franja cruza la medianoche y la hora actual (`h*60+min`) es **menor que `end`** → ayer; en cualquier otro caso → hoy. "Hoy", "Esta semana" y "Este mes" se calculan desde ese día (domingo 1/11 a la 01:00 con 08→02 → "Hoy" = sábado 31/10, "Este mes" = octubre). Los atajos "Últimos 7 días" y "Mes pasado" también. |
| **R7** | **Período anterior**: `getPreviousPeriod` sin cambios (trabaja sobre días ancla) + la **misma** franja. |
| **R8** | **"Por hora"**: hora real de la venta (`getHours()`, como hoy). Con franja, las filas se ordenan empezando por la hora de `start` (08, 09, …, 23, 00, 01). Sin franja: 00→23 (como hoy). |
| **R9** | "Personalizado" con alguna hora vacía, incompleta o fuera de rango → **no se consulta** (igual que las fechas personalizadas incompletas). El error se muestra solo si la hora está completa (5 caracteres) y es inválida. |
| **R10** | Con franja: máximo **366** días ancla por período (`MAX_FILTERED_DAYS`). Si se excede, no se consulta y se avisa. Backend: tope técnico **400** intervalos (`MAX_STATS_INTERVALS`). |
| **R11** | Todo en hora local de la PC (igual que hoy). Intervalos armados con `new Date(y, m, d, h, min)`. |

### 1.4 Arquitectura elegida y por qué

**El renderer calcula un intervalo `[from, to)` por día ancla y lo manda en un campo nuevo y opcional `intervals` de los 6 canales `stats:*`. El backend filtra con un `OR` de rangos dentro de un rango envolvente.**

1. La semántica de calendario (presets, "Hoy" anclado al día comercial, período anterior) ya vive en el renderer (`statsUtils.ts`). Armar los intervalos ahí deja **una sola fuente de verdad**, testeable con Vitest (rápido, tablas `it.each`). El backend queda genérico: "contá las ventas que caen en alguno de estos intervalos".
2. **Retrocompatible**: sin `intervals` el backend arma exactamente el mismo `where` de hoy (`{ date: { gte: from, lte: to } }`). "Todo el día" da resultados idénticos y las llamadas actuales siguen funcionando.
3. Las 6 funciones del repositorio no cambian de estructura (siguen usando `aggregate` / `groupBy`): solo cambia el `where`.
4. "Por día de semana" necesita el día ancla: el backend busca el intervalo que contiene a cada venta (búsqueda binaria) y usa el día en que ese intervalo empieza. No hace falta mandar la franja.
5. **Medido** (Prisma 5.22 + SQLite, 58.400 ventas / 175.200 ítems): con el rango envolvente (`date >= primer inicio AND date < último fin AND (OR …)`), un mes (31 intervalos) ≈ 10 ms por consulta y un año (366) 0,3–0,8 s. **Sin** el rango envolvente las consultas sobre `SaleItem` recorren toda la tabla (0,5 s con solo 31 intervalos): **el rango envolvente es obligatorio**. Límite duro de SQLite: profundidad de expresión 10.000 (~10.000 intervalos); el tope de 400 está muy lejos.
6. Descartadas: (a) mandar `{ from, to, startMinute, endMinute }` y resolver en el backend: duplica la lógica de calendario o exige reescribir los agregados en JS; (b) traer ids de venta y filtrar con `saleId IN (…)`: Prisma lo rechaza ("Query parameter limit exceeded … negation filters") con más de ~999 ids; (c) SQL crudo con `strftime(…, 'localtime')`: frágil (formato y zona).
7. Payload chico: un mes = 31 pares de `Date` (el IPC usa structured clone, que conserva `Date`). Prisma guarda `DateTime` en SQLite como INTEGER de milisegundos (verificado): las comparaciones son por instante.

### 1.5 Contratos (100 % explícitos)

**1.5.1 Payload IPC** — los mismos dos tipos, con los mismos nombres, en `backend/repositories/statsIntervals.ts` y en `renderer/src/electron-api.d.ts`; `electron/ipcContract.ts` los importa del backend:

```ts
/** Intervalo semiabierto [from, to) en hora local. */
export type StatsInterval = { from: Date; to: Date }

/**
 * Payload de los 6 canales stats:*.
 * - Sin `intervals` (o vacío): rango [from, to] de siempre (días calendario).
 * - Con `intervals`: solo cuentan las ventas con from <= date < to de algún intervalo;
 *   `from`/`to` se ignoran para filtrar.
 */
export type StatsRangeInput = { from: Date; to: Date; intervals?: StatsInterval[] }
```

| Canal | Payload |
|---|---|
| `stats:getSummary` | `StatsRangeInput` |
| `stats:getTopProductsByQuantity` | `StatsRangeInput & { limit: number }` |
| `stats:getTopProductsByRevenue` | `StatsRangeInput & { limit: number }` |
| `stats:getSalesByHour` | `StatsRangeInput` |
| `stats:getSalesByWeekday` | `StatsRangeInput` |
| `stats:getLowRotationProducts` | `StatsRangeInput & { limit: number }` |

Ejemplo — "Hoy" a la 01:00 del martes 20/10/2026 con jornada 08→02 (día comercial del lunes 19):

```ts
{
  from: new Date(2026, 9, 19, 0, 0, 0, 0),
  to: new Date(2026, 9, 19, 23, 59, 59, 999),
  intervals: [{ from: new Date(2026, 9, 19, 8, 0), to: new Date(2026, 9, 20, 2, 0) }]
}
```

"Todo el día" → `{ from, to }` (sin la clave `intervals`).

**1.5.2 Backend** (`backend/repositories/`):

```ts
// statsIntervals.ts (nuevo, puro)
export const MAX_STATS_INTERVALS = 400
export function normalizeStatsIntervals(intervals: unknown): StatsInterval[]
export function buildSaleDateWhere(from: Date, to: Date, intervals?: StatsInterval[]): Prisma.SaleWhereInput
export function findIntervalIndex(sorted: StatsInterval[], date: Date): number

// statsRepository.ts (se agrega el último parámetro, opcional)
getSalesSummary(from: Date, to: Date, intervals?: StatsInterval[]): Promise<StatsSummary>
getTopProductsByQuantity(from: Date, to: Date, limit: number, intervals?: StatsInterval[]): Promise<TopProductResult[]>
getTopProductsByRevenue(from: Date, to: Date, limit: number, intervals?: StatsInterval[]): Promise<TopProductResult[]>
getSalesByHour(from: Date, to: Date, intervals?: StatsInterval[]): Promise<SalesByPeriodResult[]>
getSalesByWeekday(from: Date, to: Date, intervals?: StatsInterval[]): Promise<SalesByPeriodResult[]>
getLowRotationProducts(from: Date, to: Date, limit: number, intervals?: StatsInterval[]): Promise<LowRotationResult[]>
```

**1.5.3 Renderer**:

```ts
// renderer/src/utils/time.ts (nuevo)
export const TIME_RANGE_ERROR = 'Ingresá una hora entre 00:00 y 23:59.'
export const TIME_INCOMPLETE_ERROR = 'Completá la hora (HH:MM).'
export function maskTimeInput(raw: string): string
export function parseTimeHM(input: string): number | null        // "08:30" → 510
export function formatMinutesHM(minutes: number): string         // 510 → "08:30"
export function timeFieldError(text: string, submitted: boolean): string | null

// renderer/src/Pages/Stats/statsUtils.ts (se agrega)
export function getPeriodDatesAt(preset: Exclude<PeriodPreset, 'custom'>, ref: Date): DateRange

// renderer/src/Pages/Stats/hourFilter.ts (nuevo, puro)
export type HourFilterMode = 'all' | 'workday' | 'custom'
export type TimeWindow = { startMinute: number; endMinute: number }
export type HourFilterState =
  | { kind: 'all' }                          // "Todo el día": sin franja
  | { kind: 'window'; window: TimeWindow }   // franja válida (jornada o personalizada)
  | { kind: 'incomplete' }                   // "Personalizado" con horas vacías o inválidas: no se consulta
export const DEFAULT_WORKDAY: Readonly<TimeWindow>   // { startMinute: 480, endMinute: 120 }
export const MAX_FILTERED_DAYS = 366
export function crossesMidnight(w: TimeWindow): boolean
export function getBusinessToday(now: Date, w: TimeWindow | null): Date
export function countDays(range: DateRange): number
export function buildIntervals(range: DateRange, w: TimeWindow): StatsInterval[]
export function toStatsInput(range: DateRange, w: TimeWindow | null): StatsRangeInput
export function orderHourRows(rows: SalesByPeriodFromApi[], w: TimeWindow | null): SalesByPeriodFromApi[]
export function describeWindow(w: TimeWindow): string
export function resolveHourFilter(mode: HourFilterMode, workday: TimeWindow, customStart: string, customEnd: string): HourFilterState

// renderer/src/Pages/Stats/workdayStorage.ts (nuevo)
export const WORKDAY_STORAGE_KEY = 'integral.stats.workday'
export function loadWorkday(): TimeWindow
export function saveWorkday(w: TimeWindow): void
```

**1.5.4 localStorage**: clave **`integral.stats.workday`**, valor JSON **`{"start":"08:00","end":"02:00"}`** (horas `HH:MM`). Sin clave, JSON corrupto, horas inválidas o storage que lanza → default 08:00 → 02:00. Escritura dentro de `try/catch` (sin storage, el cambio vale solo para la sesión). Mismo patrón que `renderer/src/utils/theme.ts`.

**1.5.5 Textos de UI** (copiar tal cual):

| Dónde | Texto |
|---|---|
| Etiqueta visible y `aria-label` del segmentado | `Horario` |
| Opciones | `Todo el día` · `Jornada laboral` · `Personalizado` (con ícono `Clock`) |
| Descripción de una franja | `describeWindow`: `De 09:00 a 13:00` · `De 08:00 a 02:00 del día siguiente` · `De 08:00 a 08:00 del día siguiente (24 h)` |
| Botón para editar la jornada | `Cambiar jornada` (ghost, sm, ícono `Pencil`) |
| Campos del editor | `Abre` · `Cierra` |
| Botones del editor | `Guardar jornada` (secondary, sm) · `Cancelar` (ghost, sm) |
| Campos de Personalizado | `Desde hora` · `Hasta hora` |
| Ayuda de Personalizado incompleto | `Completá las dos horas para aplicar el filtro.` |
| Error hora fuera de rango | `Ingresá una hora entre 00:00 y 23:59.` |
| Error hora incompleta (solo al guardar la jornada) | `Completá la hora (HH:MM).` |
| Aviso de período largo | `Con un filtro horario el período puede tener hasta 366 días. Acortá las fechas o elegí «Todo el día».` |

### 1.6 Mapa de archivos

**Nuevos**

```
backend/repositories/statsIntervals.ts
backend/__tests__/statsRepository.test.ts
renderer/src/utils/time.ts
renderer/src/utils/__tests__/time.test.ts
renderer/src/ui/TimeField.tsx
renderer/src/ui/__tests__/TimeField.test.tsx
renderer/src/Pages/Stats/hourFilter.ts
renderer/src/Pages/Stats/workdayStorage.ts
renderer/src/Pages/Stats/HourFilterBar.tsx
renderer/src/Pages/Stats/__tests__/hourFilter.test.ts
renderer/src/Pages/Stats/__tests__/workdayStorage.test.ts
renderer/src/Pages/Stats/__tests__/HourFilterBar.test.tsx
renderer/src/Pages/Stats/__tests__/StatsHourFilter.test.tsx
```

**Modificados**

```
backend/repositories/statsRepository.ts       (parámetro intervals? + where compartido + día ancla)
electron/ipcHandlers.ts                       (pasa intervals)
electron/ipcContract.ts                       (tipos StatsRangeInput)
electron/ipcContract.types-test.ts            (chequeo de tipos del payload nuevo)
renderer/src/electron-api.d.ts                (espejo de los tipos)
renderer/src/Pages/Stats/statsUtils.ts        (getPeriodDatesAt)
renderer/src/Pages/Stats/Stats.tsx            (estado del filtro, consultas, fila Horario, aviso)
renderer/src/Pages/Stats/__tests__/statsUtils.test.ts
renderer/src/Pages/Stats/__tests__/Stats.test.tsx   (solo: buscar "Personalizado" dentro del tablist "Período")
renderer/src/styles/app.css                   (un bloque delimitado)
package.json                                  (script test:stats-repository)
CLAUDE.md                                     (solo la subsección de Estadísticas)
```

### 1.7 Cómo correr cosas y estado inicial (baseline medido)

- **Renderer** (desde `C:\Users\asant\Music\Integral\wt-stats\renderer`): `npx vitest run` (toda la suite) o `npx vitest run src/Pages/Stats` (una carpeta) o `npx vitest run src/utils/__tests__/time.test.ts` (un archivo). Baseline: **66 archivos, 850 tests OK**; `src/Pages/Stats`: **4 archivos, 77 tests OK**.
- **Typecheck** (desde la raíz del worktree): `npm run typecheck`. Baseline: sin errores. Solo backend/electron: `npx tsc --noEmit`.
- **Lint** (desde la raíz): `npm run lint --workspace renderer`. Baseline: **falla con 7 errores preexistentes** (no son de este trabajo, no los arregles): 1 en `src/Pages/SalesHistory/__tests__/salesHistoryFilters.test.ts`, 1 en `src/Pages/SalesHistory/cajaUtils.ts`, 5 en `src/Pages/Sells/__tests__/confirmSaleItems.test.ts`. Criterio final: **los mismos 7 y ninguno más**.
- **Backend** (desde la raíz): `npm run test:<nombre>` (ts-node + DB temporal). Baseline: `npm run test:backend` completo pasa (≈ 3 min).
- En PowerShell encadená con `;` (`cd renderer; npx vitest run`); en Bash con `&&`.
- La PC está en `America/Buenos_Aires` (sin horario de verano). Los tests arman fechas con el constructor local, así que no dependen de la zona.

---

## Fase 0 — Preparación

### Paso 0.1 — Ubicación y rama

- **Qué hacer:** confirmá que estás en el worktree correcto.
- **Checkpoint:** `git -C C:\Users\asant\Music\Integral\wt-stats status` → `On branch feat/stats-horario`; el único cambio es `plan.md` (este archivo). `git -C C:\Users\asant\Music\Integral\wt-stats worktree list` muestra `wt-stats` en `feat/stats-horario`.

### Paso 0.2 — Baseline de tests y chequeos

- **Checkpoint:** corré los comandos de la sección 1.7 y anotá: suite del renderer (850 OK), `src/Pages/Stats` (77 OK), `npm run typecheck` (OK), lint (7 errores preexistentes), `npm run test:saleService-create` (PASS). Si algo de esto no coincide **antes** de tocar nada, frená y reportalo.

### Paso 0.3 — Leer (sin modificar) los archivos de referencia

- `CLAUDE.md` (secciones "UI / Design system en el código", "Módulo de Estadísticas", "Convenciones").
- `backend/repositories/statsRepository.ts`, `backend/__tests__/saleService-create.test.ts`, `backend/__tests__/helpers/testDb.ts`.
- `electron/ipcHandlers.ts`, `electron/ipcContract.ts`, `electron/ipcContract.types-test.ts`, `renderer/src/electron-api.d.ts`.
- `renderer/src/Pages/Stats/Stats.tsx`, `statsUtils.ts` y sus tests en `__tests__/`.
- `renderer/src/ui/DateField.tsx`, `ui/Field.tsx`, `ui/Segmented.tsx`, `ui/Button.tsx`, `ui/InlineAlert.tsx`, `utils/parse.ts`, `utils/theme.ts` (+ su test).
- `design-system/components/Input/README.md`, `Segmented/README.md`, `ScreenStats/README.md`, `design-system/guia/03-estados-y-copy.md`.

---

## Fase 1 — Backend: intervalos en el repositorio de Estadísticas

### Paso 1.1 — Test de backend con los casos "como hoy" (ANTES de tocar el repositorio)

Objetivo: fijar con datos reales el comportamiento actual, para comprobar después que "Todo el día" no cambió.

- **Archivos:** crear `backend/__tests__/statsRepository.test.ts`; modificar `package.json`.
- **Qué hacer:**
  1. Crear el archivo con este esqueleto (mismo patrón que `saleService-create.test.ts`):

```ts
/**
 * backend/__tests__/statsRepository.test.ts
 *
 * Repositorio de Estadísticas con y sin filtro horario (`intervals`).
 * DB temporal VACÍA creada desde las migraciones (helpers/testDb.ts): nunca toca dev.db.
 *
 * Fechas con `new Date(año, mes0, día, h, min)` = hora LOCAL de la PC, igual que el
 * renderer y que `getHours()` / `getDay()` del repositorio.
 * Octubre 2026: dom 18, lun 19, mar 20, mié 21.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import { createMigratedTestDb } from "./helpers/testDb"

type StatsModule = typeof import("../repositories/statsRepository")

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/** Compara por JSON (el repositorio devuelve strings y números). */
function assertEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${message}\n  esperado: ${e}\n  obtenido: ${a}`)
}

async function assertRejects(fn: () => Promise<unknown>, includes: string, message: string): Promise<void> {
  try {
    await fn()
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    assert(text.includes(includes), `${message}: el error "${text}" no incluye "${includes}"`)
    return
  }
  throw new Error(`${message}: se esperaba un error y no hubo`)
}

function logStep(step: string): void {
  console.log(`PASS: ${step}`)
}

/** Fecha local de octubre 2026. */
const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute)
/** Días calendario completos de octubre 2026: [d1 00:00:00.000, d2 23:59:59.999]. */
const days = (d1: number, d2: number = d1) => ({
  from: new Date(2026, 9, d1, 0, 0, 0, 0),
  to: new Date(2026, 9, d2, 23, 59, 59, 999)
})

const DOM = days(18)
const LUN = days(19)
const MAR = days(20)
const LUN_MAR = days(19, 20)
// Intervalos [from, to) que armaría el renderer (ver Apéndice B)
const DOM_W = { from: at(18, 8, 0), to: at(19, 2, 0) } // jornada 08→02 del domingo
const LUN_W = { from: at(19, 8, 0), to: at(20, 2, 0) } // jornada 08→02 del lunes
const MAR_W = { from: at(20, 8, 0), to: at(21, 2, 0) } // jornada 08→02 del martes
const LUN_W2 = { from: at(19, 9, 0), to: at(19, 13, 0) } // franja 09→13 del lunes
const MAR_W2 = { from: at(20, 9, 0), to: at(20, 13, 0) } // franja 09→13 del martes
const LUN_W24 = { from: at(19, 8, 0), to: at(20, 8, 0) } // franja 08→08 (24 h) del lunes
const MAR_W24 = { from: at(20, 8, 0), to: at(21, 8, 0) } // franja 08→08 (24 h) del martes

/** "Producto:valor" para comparar rankings sin depender de ids. */
const topNames = (rows: { productName: string; value: string }[]) => rows.map((r) => `${r.productName}:${r.value}`)
const lowNames = (rows: { productName: string; totalQuantity: number }[]) =>
  rows.map((r) => `${r.productName}:${r.totalQuantity}`)

async function seed(prisma: PrismaClient): Promise<void> {
  // ... ver Apéndice B (código completo)
}

async function testLegacy(stats: StatsModule): Promise<void> {
  // ... casos A y B del Apéndice B
}

async function main() {
  // La DB se crea ANTES de los require(): el Prisma client singleton lee DATABASE_URL al
  // cargarse. Por eso los require son tardíos.
  const testDb = createMigratedTestDb("stats-repository")
  process.env.DATABASE_URL = testDb.databaseUrl

  const stats = require("../repositories/statsRepository") as StatsModule
  const prisma = (require("../db/client") as { default: PrismaClient }).default

  try {
    await seed(prisma)
    await testLegacy(stats)
    console.log("PASS: statsRepository — todos los casos")
  } finally {
    // Desconectar antes de borrar: en Windows el archivo abierto da EBUSY.
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
```

  2. Completar `seed` con el código del **Apéndice B.1** y `testLegacy` con los casos **A** y **B** del **Apéndice B.2** (en el Apéndice está el caso A escrito completo como modelo). En este paso `testLegacy` llama a las funciones **sin** tercer/cuarto parámetro.
  3. `package.json`: agregar al final de `"scripts"` (después de `"test:license"`, cuidando las comas):
     `"test:stats-repository": "npx ts-node backend/__tests__/statsRepository.test.ts"`
     y agregar al **final** del string de `"test:backend"`: ` && npm run test:stats-repository`.
- **Checkpoint:** `npm run test:stats-repository` → imprime `PASS: caso A …`, `PASS: caso B …`, `PASS: statsRepository — todos los casos` y termina con código 0, **sin haber tocado el repositorio**. Además `backend/prisma/` no tiene archivos `test-stats-repository.*` sobrantes. Si un valor esperado no coincide, **no cambies el repositorio**: revisá el seed contra el Apéndice B.1.

### Paso 1.2 — `backend/repositories/statsIntervals.ts` (nuevo, puro)

- **Archivos:** crear `backend/repositories/statsIntervals.ts`.
- **Qué hacer:** pegar este contenido (es el núcleo del filtro; respetalo tal cual):

```ts
/**
 * backend/repositories/statsIntervals.ts
 *
 * Filtro horario de Estadísticas: intervalos semiabiertos [from, to) en hora local.
 * El renderer arma un intervalo por día ancla del período (renderer/src/Pages/Stats/hourFilter.ts
 * › buildIntervals) y los manda en `intervals`. Módulo puro: no importa el Prisma client.
 */

import type { Prisma } from "@prisma/client"

/** Intervalo semiabierto [from, to) en hora local. */
export type StatsInterval = { from: Date; to: Date }

/**
 * Payload de los 6 canales stats:*.
 * - Sin `intervals` (o vacío): rango [from, to] de siempre (días calendario).
 * - Con `intervals`: solo cuentan las ventas con from <= date < to de algún intervalo;
 *   `from`/`to` se ignoran para filtrar.
 */
export type StatsRangeInput = { from: Date; to: Date; intervals?: StatsInterval[] }

/** Tope técnico por consulta. La UI corta antes: 366 días (MAX_FILTERED_DAYS del renderer). */
export const MAX_STATS_INTERVALS = 400

/**
 * Valida `intervals` y devuelve una COPIA ordenada por `from` (no muta la entrada).
 * undefined / null / [] → [] (sin filtro horario).
 * @throws Error si no es un array, si supera MAX_STATS_INTERVALS, si un elemento no tiene
 *   `from` y `to` de tipo Date válidos, o si `from >= to`.
 */
export function normalizeStatsIntervals(intervals: unknown): StatsInterval[] {
  if (intervals === undefined || intervals === null) return []
  if (!Array.isArray(intervals)) throw new Error("intervals debe ser un array")
  if (intervals.length > MAX_STATS_INTERVALS) {
    throw new Error(`intervals admite hasta ${MAX_STATS_INTERVALS} intervalos (llegaron ${intervals.length})`)
  }
  const out = intervals.map((item: unknown, i: number): StatsInterval => {
    const from = (item as { from?: unknown } | null)?.from
    const to = (item as { to?: unknown } | null)?.to
    if (
      !(from instanceof Date) || Number.isNaN(from.getTime()) ||
      !(to instanceof Date) || Number.isNaN(to.getTime())
    ) {
      throw new Error(`intervals[${i}] necesita from y to de tipo Date`)
    }
    if (from.getTime() >= to.getTime()) {
      throw new Error(`intervals[${i}]: from tiene que ser anterior a to`)
    }
    return { from, to }
  })
  return out.sort((a, b) => a.from.getTime() - b.from.getTime())
}

/**
 * `where` de Sale.date para las consultas de Estadísticas.
 * - Sin intervalos: `{ date: { gte: from, lte: to } }` (IDÉNTICO al de siempre).
 * - Con intervalos: rango envolvente + OR de los intervalos. El rango envolvente es OBLIGATORIO:
 *   deja que SQLite use el índice de Sale.date y evalúe el OR solo sobre esas filas (sin él, las
 *   consultas sobre SaleItem recorren toda la tabla).
 * Sirve para `prisma.sale.*` (`where: saleWhere`) y como filtro de relación en `prisma.saleItem.*`
 * (`where: { sale: saleWhere, ... }`).
 */
export function buildSaleDateWhere(from: Date, to: Date, intervals?: StatsInterval[]): Prisma.SaleWhereInput {
  const list = normalizeStatsIntervals(intervals)
  if (list.length === 0) return { date: { gte: from, lte: to } }
  let outerTo = list[0].to
  for (const interval of list) {
    if (interval.to.getTime() > outerTo.getTime()) outerTo = interval.to
  }
  return {
    date: { gte: list[0].from, lt: outerTo },
    OR: list.map((interval) => ({ date: { gte: interval.from, lt: interval.to } }))
  }
}

/**
 * Índice del intervalo que contiene `date` (from <= date < to), o -1.
 * `sorted` tiene que venir ordenado por `from` y sin solapamientos (salida de normalizeStatsIntervals).
 * Búsqueda binaria: O(log n).
 */
export function findIntervalIndex(sorted: StatsInterval[], date: Date): number {
  const t = date.getTime()
  let lo = 0
  let hi = sorted.length - 1
  let candidate = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].from.getTime() <= t) {
      candidate = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (candidate === -1) return -1
  return t < sorted[candidate].to.getTime() ? candidate : -1
}
```

- **Checkpoint:** `npx tsc --noEmit` (raíz) sin errores.

### Paso 1.3 — Tests de los helpers puros

- **Archivos:** `backend/__tests__/statsRepository.test.ts`.
- **Qué hacer:**
  1. En `main()`, después del `require` de `statsRepository`, agregar:
     `const intervalsLib = require("../repositories/statsIntervals") as typeof import("../repositories/statsIntervals")`
  2. Agregar `async function testPureHelpers(lib: typeof import("../repositories/statsIntervals"))` con los casos **J** del Apéndice B.2 y llamarla en `main()` **antes** de `testLegacy`.
- **Checkpoint:** `npm run test:stats-repository` → aparecen los `PASS` de J, A y B.

### Paso 1.4 — `statsRepository.ts`: imports y `getSalesSummary`

- **Archivos:** `backend/repositories/statsRepository.ts`.
- **Qué hacer:**
  1. Debajo de los imports actuales agregar (el archivo usa comillas simples en los imports: mantenelas):

```ts
import { buildSaleDateWhere, findIntervalIndex, normalizeStatsIntervals, type StatsInterval } from './statsIntervals'

// Tipos del payload de los canales stats:* (se re-exportan para electron/ y para el índice de repositorios)
export type { StatsInterval, StatsRangeInput } from './statsIntervals'
```

  2. `getSalesSummary`: nueva firma `getSalesSummary(from: Date, to: Date, intervals?: StatsInterval[])`. Como **primera línea** del cuerpo: `const saleWhere = buildSaleDateWhere(from, to, intervals)`. En el `aggregate`: `where: saleWhere`. En el `findMany` de ítems: `where: { sale: saleWhere, productId: { not: null }, purchasePriceSnapshot: { not: null } }`. El resto queda igual.
  3. Actualizar el JSDoc: "Con `intervals`, solo cuentan las ventas dentro de algún intervalo [from, to) (filtro horario)".
- **Checkpoint:** `npx tsc --noEmit` sin errores y `npm run test:stats-repository` sigue en verde (A y B iguales).

### Paso 1.5 — Las otras 5 funciones

- **Archivos:** `backend/repositories/statsRepository.ts`.
- **Qué hacer** (en todas: agregar `intervals?: StatsInterval[]` como **último** parámetro, primera línea `const saleWhere = buildSaleDateWhere(from, to, intervals)` y actualizar el JSDoc):
  - `getTopProductsByQuantity(from, to, limit, intervals?)`: en el `groupBy`, `where: { sale: saleWhere, productId: { not: null } }`.
  - `getTopProductsByRevenue(from, to, limit, intervals?)`: en el `findMany`, `where: { sale: saleWhere, productId: { not: null } }`.
  - `getSalesByHour(from, to, intervals?)`: en el `findMany`, `where: saleWhere`. La agrupación por `getHours()` y el orden 00→23 **no cambian** (el orden desde la apertura lo hace el renderer, R8).
  - `getLowRotationProducts(from, to, limit, intervals?)`: en el `groupBy`, `where: { sale: saleWhere, productId: { not: null } }`.
  - `getSalesByWeekday(from, to, intervals?)` — día ancla (R5). Reemplazar el cuerpo por:

```ts
  const sorted = normalizeStatsIntervals(intervals)
  const sales = await prisma.sale.findMany({
    where: buildSaleDateWhere(from, to, sorted),
    select: { date: true, total: true }
  })

  const byWeekday = new Map<number, { count: number; total: Prisma.Decimal }>()
  for (const sale of sales) {
    let d = sale.date.getDay()
    if (sorted.length > 0) {
      // Día ancla = día en que EMPIEZA el intervalo: con jornada 08→02, la venta del
      // martes 01:00 cae en el intervalo del lunes y cuenta como lunes.
      const idx = findIntervalIndex(sorted, sale.date)
      if (idx === -1) continue // no debería pasar: el where ya filtró por los intervalos
      d = sorted[idx].from.getDay()
    }
    const prev = byWeekday.get(d) ?? { count: 0, total: new Prisma.Decimal(0) }
    byWeekday.set(d, { count: prev.count + 1, total: prev.total.add(sale.total) })
  }

  return Array.from(byWeekday.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekday, data]) => ({
      label: weekday.toString(),
      saleCount: data.count,
      totalRevenue: data.total.toDecimalPlaces(2).toString()
    }))
```

  JSDoc de `getSalesByWeekday`: "Con `intervals`, el día de semana es el del día ancla (el día en que empieza el intervalo que contiene la venta)".
- **Checkpoint:** `npx tsc --noEmit` sin errores; `npm run test:stats-repository` en verde. Buscá en el archivo `gte: from, lte: to`: **no** tiene que quedar ninguna aparición (todas pasan por `buildSaleDateWhere`).

### Paso 1.6 — Tests con intervalos

- **Archivos:** `backend/__tests__/statsRepository.test.ts`.
- **Qué hacer:**
  1. En `testLegacy`, agregar al caso A la verificación "idéntico con `[]` y con `undefined`" (Apéndice B.2, caso A, último bloque).
  2. Agregar `async function testWithIntervals(stats: StatsModule)` con los casos **C, D, E, F, G y H** del Apéndice B.2 y llamarla en `main()` después de `testLegacy`.
- **Checkpoint:** `npm run test:stats-repository` → `PASS` de J, A, B, C, D, E, F, G, H.

### Paso 1.7 — Tests de validación

- **Archivos:** `backend/__tests__/statsRepository.test.ts`.
- **Qué hacer:** agregar `async function testValidation(stats: StatsModule)` con los casos **I** del Apéndice B.2 (usa `assertRejects`) y llamarla después de `testWithIntervals`.
- **Checkpoint:** `npm run test:stats-repository` en verde.

---

## Fase 2 — IPC y contrato

### Paso 2.1 — `electron/ipcHandlers.ts`

- **Qué hacer:**
  1. En el import de `"../backend/repositories"` agregar `type StatsRangeInput` (junto a los otros `type …`).
  2. Reemplazar los 6 handlers `stats:*` por:

```ts
    "stats:getSummary": withChannelError<StatsRangeInput>(
      "stats:getSummary",
      ({ from, to, intervals }) => getSalesSummary(from, to, intervals)
    ),
    "stats:getTopProductsByQuantity": withChannelError<StatsRangeInput & { limit: number }>(
      "stats:getTopProductsByQuantity",
      ({ from, to, limit, intervals }) => getTopProductsByQuantity(from, to, limit, intervals)
    ),
    "stats:getTopProductsByRevenue": withChannelError<StatsRangeInput & { limit: number }>(
      "stats:getTopProductsByRevenue",
      ({ from, to, limit, intervals }) => getTopProductsByRevenue(from, to, limit, intervals)
    ),
    "stats:getSalesByHour": withChannelError<StatsRangeInput>(
      "stats:getSalesByHour",
      ({ from, to, intervals }) => getSalesByHour(from, to, intervals)
    ),
    "stats:getSalesByWeekday": withChannelError<StatsRangeInput>(
      "stats:getSalesByWeekday",
      ({ from, to, intervals }) => getSalesByWeekday(from, to, intervals)
    ),
    "stats:getLowRotationProducts": withChannelError<StatsRangeInput & { limit: number }>(
      "stats:getLowRotationProducts",
      ({ from, to, limit, intervals }) => getLowRotationProducts(from, to, limit, intervals)
    )
```

  La validación de `intervals` la hace el repositorio (`normalizeStatsIntervals`); `withChannelError` ya convierte el error en `[canal] mensaje`.

### Paso 2.2 — `electron/ipcContract.ts`

- **Qué hacer:**
  1. En el `import type { … } from "../backend/repositories"` agregar `StatsRangeInput`.
  2. En `ElectronApi`, reemplazar las 6 firmas de stats por:

```ts
  getSalesSummary: (input: StatsRangeInput) => Promise<StatsSummaryFromApi>
  getTopProductsByQuantity: (input: StatsRangeInput & { limit: number }) => Promise<TopProductFromApi[]>
  getTopProductsByRevenue: (input: StatsRangeInput & { limit: number }) => Promise<TopProductFromApi[]>
  getSalesByHour: (input: StatsRangeInput) => Promise<SalesByPeriodFromApi[]>
  getSalesByWeekday: (input: StatsRangeInput) => Promise<SalesByPeriodFromApi[]>
  getLowRotationProducts: (input: StatsRangeInput & { limit: number }) => Promise<LowRotationFromApi[]>
```

  3. `buildElectronApi` **no cambia** (ya pasa `input` entero al canal).

### Paso 2.3 — `electron/ipcContract.types-test.ts`

- **Qué hacer:** al final del archivo (después de `void api`) agregar:

```ts
// El input de stats sigue aceptando { from, to } y acepta `intervals` opcional (filtro horario).
const statsInputLegacy: Parameters<ElectronApi["getSalesSummary"]>[0] = { from: new Date(), to: new Date() }
const statsInputWithIntervals: Parameters<ElectronApi["getTopProductsByQuantity"]>[0] = {
  from: new Date(),
  to: new Date(),
  limit: 5,
  intervals: [{ from: new Date(), to: new Date() }]
}
void statsInputLegacy
void statsInputWithIntervals
```

- **Checkpoint (2.1–2.3):** `npx tsc --noEmit` sin errores.

### Paso 2.4 — Test del puente IPC con intervalos

- **Archivos:** `backend/__tests__/statsRepository.test.ts`.
- **Qué hacer:**
  1. En `main()`, junto a los otros `require` tardíos:

```ts
  const { buildIpcHandlers, invokeIpcHandler } = require("../../electron/ipcHandlers") as typeof import("../../electron/ipcHandlers")
  const { buildElectronApi } = require("../../electron/ipcContract") as typeof import("../../electron/ipcContract")
```

  2. Arriba del archivo, junto al otro `import type`, agregar `import type { ElectronApi } from "../../electron/ipcContract"` (es solo de tipos: no carga el módulo antes de tiempo).
  3. Agregar `async function testIpc(api: ElectronApi, call: (channel: string, payload: unknown) => Promise<unknown>)` con los casos **K** del Apéndice B.2. En `main()`, después de `testValidation`:

```ts
    const handlers = buildIpcHandlers()
    const call = (channel: string, payload: unknown) => invokeIpcHandler(handlers, channel, payload)
    await testIpc(buildElectronApi(call), call)
```
- **Checkpoint:** `npm run test:stats-repository` en verde (incluye `PASS` de K).

### Paso 2.5 — Regresión del backend

- **Checkpoint:** `npm run test:ipc-bridge` y `npm run test:backend-db` → ambos PASS. `git status` no muestra archivos `backend/prisma/test-*.db`.

### Paso 2.6 — Espejo de tipos en el renderer (`renderer/src/electron-api.d.ts`)

- **Qué hacer:**
  1. Después de `LowRotationFromApi`, agregar (con `export`, igual que los otros tipos de salida):

```ts
/** Intervalo semiabierto [from, to) en hora local (filtro horario de Estadísticas). */
export type StatsInterval = { from: Date; to: Date }

/**
 * Payload de los canales stats:*. Sin `intervals` → rango [from, to] de siempre.
 * Con `intervals` (no vacío) → solo cuentan las ventas dentro de algún intervalo; from/to se ignoran para filtrar.
 */
export type StatsRangeInput = { from: Date; to: Date; intervals?: StatsInterval[] }
```

  2. En `type ElectronApi`, reemplazar las 6 firmas de stats por las **mismas** del Paso 2.2.
- **Checkpoint:** `npm run typecheck` (raíz) sin errores; `npx vitest run src/Pages/Stats` (desde `renderer`) → 77 OK.

---

## Fase 3 — Utilidades del renderer

### Paso 3.1 — `renderer/src/utils/time.ts` (nuevo)

- **Qué hacer:** crear el archivo con este contenido:

```ts
/**
 * Horas tipeadas por el usuario en formato "HH:MM" (24 h).
 * Como las fechas (`DateField`): texto con máscara, nunca `type="time"`.
 * Los minutos se cuentan desde las 00:00 (0–1439).
 */

export const TIME_RANGE_ERROR = 'Ingresá una hora entre 00:00 y 23:59.'
export const TIME_INCOMPLETE_ERROR = 'Completá la hora (HH:MM).'

/**
 * Máscara mientras se tipea: deja solo dígitos (máx. 4) e inserta ":" → "0800" → "08:00", "083" → "08:3".
 * Si empieza con un dígito seguido de ":" ("8:", "8:3") se asume hora de un dígito → "08", "08:3".
 */
export function maskTimeInput(raw: string): string {
  const fixed = /^\d:/.test(raw) ? `0${raw}` : raw
  const digits = fixed.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/** "HH:MM" exacto (00–23 : 00–59) → minutos desde las 00:00; cualquier otra cosa → null. Ignora espacios alrededor. */
export function parseTimeHM(input: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(input.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutos desde las 00:00 (0–1439) → "HH:MM". */
export function formatMinutesHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Error a mostrar en un campo HH:MM.
 * - Válida → null.
 * - Completa (5 caracteres) pero fuera de rango ("25:00", "12:60") → TIME_RANGE_ERROR.
 * - Vacía o incompleta → TIME_INCOMPLETE_ERROR solo si `submitted` (se intentó guardar); si no, null.
 */
export function timeFieldError(text: string, submitted: boolean): string | null {
  if (parseTimeHM(text) !== null) return null
  if (text.length === 5) return TIME_RANGE_ERROR
  return submitted ? TIME_INCOMPLETE_ERROR : null
}
```

### Paso 3.2 — `renderer/src/utils/__tests__/time.test.ts` (nuevo)

- **Qué hacer:** tests con `it.each` (imports desde `'../time'`):

| Función | Entrada → salida esperada |
|---|---|
| `maskTimeInput` | `''`→`''` · `'0'`→`'0'` · `'08'`→`'08'` · `'080'`→`'08:0'` · `'0800'`→`'08:00'` · `'08001'`→`'08:00'` · `'8:'`→`'08'` · `'8:3'`→`'08:3'` · `'08:30'`→`'08:30'` · `'ab12cd34'`→`'12:34'` · `'2500'`→`'25:00'` (la máscara no valida rangos) |
| `parseTimeHM` (válidas) | `'00:00'`→`0` · `'08:00'`→`480` · `'02:00'`→`120` · `'12:30'`→`750` · `'23:59'`→`1439` · `' 08:00 '`→`480` |
| `parseTimeHM` (→ `null`) | `'24:00'`, `'23:60'`, `'8:00'`, `'08:0'`, `'0800'`, `''`, `'ab:cd'`, `'08:00:00'`, `'-1:00'` |
| `formatMinutesHM` | `0`→`'00:00'` · `120`→`'02:00'` · `480`→`'08:00'` · `750`→`'12:30'` · `1439`→`'23:59'` |
| `timeFieldError(text, submitted)` | `('08:00', false)`→`null` · `('08:00', true)`→`null` · `('', false)`→`null` · `('08', false)`→`null` · `('', true)`→`TIME_INCOMPLETE_ERROR` · `('08:3', true)`→`TIME_INCOMPLETE_ERROR` · `('25:00', false)`→`TIME_RANGE_ERROR` · `('12:60', true)`→`TIME_RANGE_ERROR` |

  Además: un test que verifica los textos exactos de `TIME_RANGE_ERROR` y `TIME_INCOMPLETE_ERROR` (sección 1.5.5) y uno de ida y vuelta `parseTimeHM(formatMinutesHM(n)) === n` para `n` en `[0, 1, 59, 60, 479, 480, 1439]`.
- **Checkpoint:** `npx vitest run src/utils/__tests__/time.test.ts` en verde.

### Paso 3.3 — `renderer/src/ui/TimeField.tsx` (nuevo)

- **Qué hacer:** espejo de `DateField.tsx` (mismas props, mismo `Field`):

```tsx
import { Field } from './Field'
import { maskTimeInput } from '../utils/time'

type TimeFieldProps = {
  id: string
  label: string
  /** Texto con máscara `HH:MM` (puede estar incompleto mientras se tipea). */
  value: string
  /** Recibe el texto ya enmascarado. */
  onChange: (masked: string) => void
  error?: string | null
  help?: string
  required?: boolean
  className?: string
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

/**
 * Campo de hora como texto con máscara `HH:MM` (24 h). No usa `type="time"`: igual que `DateField`,
 * se opera entero con teclado y se ve igual en todas las PCs.
 */
export function TimeField({ id, label, value, onChange, error, help, required, className, inputRef, onKeyDown }: TimeFieldProps) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined
  return (
    <Field label={label} htmlFor={id} required={required} help={help} error={error} className={className}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        maxLength={5}
        className={error ? 'ig-input is-error' : 'ig-input'}
        value={value}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        onChange={(e) => onChange(maskTimeInput(e.target.value))}
        onKeyDown={onKeyDown}
      />
    </Field>
  )
}
```

### Paso 3.4 — `renderer/src/ui/__tests__/TimeField.test.tsx` (nuevo)

- **Qué hacer** (mismo estilo que `DateField.test.tsx`):
  1. Tiene `placeholder="HH:MM"`, `type="text"`, `inputmode="numeric"`, `maxlength="5"` y el label asociado (`getByLabelText('Abre')`).
  2. `fireEvent.change(input, { target: { value: '0800' } })` → `onChange` llamado con `'08:00'`.
  3. Con `error="Ingresá una hora entre 00:00 y 23:59."`: `aria-invalid="true"`, `aria-describedby="<id>-error"` y el texto visible.
  4. Con `help="HH:MM"` y sin error: `aria-describedby="<id>-help"`.
  5. `onKeyDown` se reenvía: `fireEvent.keyDown(input, { key: 'Enter' })` → el mock se llamó una vez.
- **Checkpoint:** `npx vitest run src/ui/__tests__/TimeField.test.tsx` en verde.

### Paso 3.5 — `statsUtils.ts`: `getPeriodDatesAt`

- **Archivos:** `renderer/src/Pages/Stats/statsUtils.ts`.
- **Qué hacer:**
  1. Agregar, encima de `getPeriodDates`:

```ts
/**
 * Rango de días ancla del preset tomando `ref` como "hoy".
 * Con filtro horario, `ref` es el día comercial en curso (ver hourFilter.ts › getBusinessToday).
 */
export function getPeriodDatesAt(preset: Exclude<PeriodPreset, 'custom'>, ref: Date): DateRange {
  switch (preset) {
    case 'today':
      return { from: getStartOfDay(ref), to: getEndOfDay(ref) }
    case 'week': {
      // getDay() retorna 0=Dom ... 6=Sáb; el offset al lunes es (day + 6) % 7
      const offsetToMonday = (ref.getDay() + 6) % 7
      const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - offsetToMonday)
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
      return { from: getStartOfDay(monday), to: getEndOfDay(sunday) }
    }
    case 'month': {
      const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1)
      // Día 0 del mes siguiente = último día del mes actual
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
      return { from: getStartOfDay(firstDay), to: getEndOfDay(lastDay) }
    }
  }
}
```

  2. Reemplazar el cuerpo de `getPeriodDates` (misma firma, sigue exportada para los tests existentes) por:

```ts
  if (preset === 'custom') return { from: customFrom!, to: customTo! }
  return getPeriodDatesAt(preset, new Date())
```

### Paso 3.6 — Tests de `getPeriodDatesAt`

- **Archivos:** `renderer/src/Pages/Stats/__tests__/statsUtils.test.ts` (agregar `getPeriodDatesAt` al import y un `describe('getPeriodDatesAt')`).
- **Qué hacer:** `it.each` con `[preset, ref, from, to]`, comparando con `toEqual` contra `new Date(...)` (mes 0-based):

| preset | ref | from | to |
|---|---|---|---|
| `today` | `new Date(2026, 9, 20, 1, 0)` | `new Date(2026, 9, 20, 0, 0, 0, 0)` | `new Date(2026, 9, 20, 23, 59, 59, 999)` |
| `week` | `new Date(2026, 9, 25, 12, 0)` (domingo) | `new Date(2026, 9, 19, 0, 0, 0, 0)` | `new Date(2026, 9, 25, 23, 59, 59, 999)` |
| `week` | `new Date(2026, 9, 19, 0, 0)` (lunes) | `new Date(2026, 9, 19, 0, 0, 0, 0)` | `new Date(2026, 9, 25, 23, 59, 59, 999)` |
| `week` | `new Date(2026, 9, 26, 10, 0)` (lunes) | `new Date(2026, 9, 26, 0, 0, 0, 0)` | `new Date(2026, 10, 1, 23, 59, 59, 999)` |
| `month` | `new Date(2026, 9, 31, 23, 0)` | `new Date(2026, 9, 1, 0, 0, 0, 0)` | `new Date(2026, 9, 31, 23, 59, 59, 999)` |
| `month` | `new Date(2028, 1, 10)` (bisiesto) | `new Date(2028, 1, 1, 0, 0, 0, 0)` | `new Date(2028, 1, 29, 23, 59, 59, 999)` |
| `month` | `new Date(2026, 11, 15)` | `new Date(2026, 11, 1, 0, 0, 0, 0)` | `new Date(2026, 11, 31, 23, 59, 59, 999)` |

- **Checkpoint:** `npx vitest run src/Pages/Stats/__tests__/statsUtils.test.ts` → todos los tests (los viejos y los nuevos) en verde.

### Paso 3.7 — `renderer/src/Pages/Stats/hourFilter.ts` (nuevo, puro)

- **Qué hacer:** crear el archivo con este contenido (es la semántica R1–R11; respetalo tal cual):

```ts
// Filtro horario del panel de Estadísticas: funciones puras (sin React ni window.api).
// Semántica: ver CLAUDE.md › Módulo de Estadísticas › Filtro horario.

import type { SalesByPeriodFromApi, StatsInterval, StatsRangeInput } from '../../electron-api'
import { formatMinutesHM, parseTimeHM } from '../../utils/time'
import { getStartOfDay, type DateRange } from './statsUtils'

/** Opción elegida en el segmentado "Horario". */
export type HourFilterMode = 'all' | 'workday' | 'custom'

/**
 * Franja diaria en minutos desde las 00:00 (0–1439). `startMinute` inclusivo, `endMinute` EXCLUSIVO.
 * - start < end  → franja del mismo día: [D start, D end)
 * - end <= start → cruza la medianoche ("día comercial"): [D start, D+1 end). end == start = 24 h.
 */
export type TimeWindow = { startMinute: number; endMinute: number }

/** Resultado de resolver el filtro elegido. */
export type HourFilterState =
  | { kind: 'all' } // "Todo el día": sin franja (comportamiento de siempre)
  | { kind: 'window'; window: TimeWindow } // franja válida (jornada laboral o personalizada)
  | { kind: 'incomplete' } // "Personalizado" con horas vacías, incompletas o inválidas: no se consulta

/** Jornada laboral por defecto: 08:00 → 02:00 del día siguiente. */
export const DEFAULT_WORKDAY: Readonly<TimeWindow> = Object.freeze({ startMinute: 8 * 60, endMinute: 2 * 60 })

/** Con franja, máximo de días por período (más que esto tarda demasiado). */
export const MAX_FILTERED_DAYS = 366

/** true si la franja termina al día siguiente (incluye end == start, 24 h). */
export function crossesMidnight(w: TimeWindow): boolean {
  return w.endMinute <= w.startMinute
}

/**
 * Día comercial en curso (00:00 de ese día). Con una franja que cruza la medianoche, antes de la
 * hora de cierre todavía corre el día comercial de AYER (martes 01:00 con 08→02 → lunes).
 * Sin franja o con franja del mismo día → hoy.
 */
export function getBusinessToday(now: Date, w: TimeWindow | null): Date {
  const today = getStartOfDay(now)
  if (!w || !crossesMidnight(w)) return today
  const nowMinute = now.getHours() * 60 + now.getMinutes()
  if (nowMinute < w.endMinute) return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  return today
}

/** Cantidad de días ancla del rango (from y to inclusive). */
export function countDays(range: DateRange): number {
  const a = getStartOfDay(range.from)
  const b = getStartOfDay(range.to)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

/**
 * Un intervalo [from, to) por cada día ancla D del rango, en hora local:
 * franja del mismo día → [D start, D end); cruza medianoche → [D start, D+1 end).
 * Siempre con new Date(y, m, d, h, min): nunca sumando milisegundos.
 */
export function buildIntervals(range: DateRange, w: TimeWindow): StatsInterval[] {
  const first = getStartOfDay(range.from)
  const n = countDays(range)
  const sh = Math.floor(w.startMinute / 60)
  const sm = w.startMinute % 60
  const eh = Math.floor(w.endMinute / 60)
  const em = w.endMinute % 60
  const endDayOffset = crossesMidnight(w) ? 1 : 0
  const out: StatsInterval[] = []
  for (let i = 0; i < n; i++) {
    const y = first.getFullYear()
    const m = first.getMonth()
    const d = first.getDate() + i
    out.push({ from: new Date(y, m, d, sh, sm), to: new Date(y, m, d + endDayOffset, eh, em) })
  }
  return out
}

/** Payload de los canales stats:*. Sin franja: { from, to } exactamente como siempre (sin la clave intervals). */
export function toStatsInput(range: DateRange, w: TimeWindow | null): StatsRangeInput {
  if (!w) return { from: range.from, to: range.to }
  return { from: range.from, to: range.to, intervals: buildIntervals(range, w) }
}

/**
 * "Por hora" con franja: ordena empezando por la hora de apertura (08…23, 00, 01).
 * Sin franja devuelve el mismo array (orden 00→23 del backend). No muta la entrada.
 */
export function orderHourRows(rows: SalesByPeriodFromApi[], w: TimeWindow | null): SalesByPeriodFromApi[] {
  if (!w) return rows
  const startHour = Math.floor(w.startMinute / 60)
  const pos = (label: string) => (Number(label) - startHour + 24) % 24
  return [...rows].sort((a, b) => pos(a.label) - pos(b.label))
}

/** "De 09:00 a 13:00" · "De 08:00 a 02:00 del día siguiente" · "De 08:00 a 08:00 del día siguiente (24 h)". */
export function describeWindow(w: TimeWindow): string {
  const a = formatMinutesHM(w.startMinute)
  const b = formatMinutesHM(w.endMinute)
  if (!crossesMidnight(w)) return `De ${a} a ${b}`
  if (w.startMinute === w.endMinute) return `De ${a} a ${b} del día siguiente (24 h)`
  return `De ${a} a ${b} del día siguiente`
}

/** Traduce lo elegido en pantalla a un estado único. */
export function resolveHourFilter(
  mode: HourFilterMode,
  workday: TimeWindow,
  customStart: string,
  customEnd: string
): HourFilterState {
  if (mode === 'all') return { kind: 'all' }
  if (mode === 'workday') return { kind: 'window', window: workday }
  const startMinute = parseTimeHM(customStart)
  const endMinute = parseTimeHM(customEnd)
  if (startMinute === null || endMinute === null) return { kind: 'incomplete' }
  return { kind: 'window', window: { startMinute, endMinute } }
}
```

- **Checkpoint:** `npm run typecheck` sin errores.

### Paso 3.8 — `renderer/src/Pages/Stats/__tests__/hourFilter.test.ts` (nuevo)

- **Qué hacer:** implementar **todas** las tablas del **Apéndice A** (A.1 a A.9) con `it.each`. Imports: funciones de `'../hourFilter'` y `getPeriodDatesAt`, `getPreviousPeriod` de `'../statsUtils'`. Constante `const W = { startMinute: 480, endMinute: 120 }` (jornada 08→02). Helpers sugeridos:

```ts
const day = (y: number, m: number, d: number) => ({ from: new Date(y, m, d, 0, 0, 0, 0), to: new Date(y, m, d, 23, 59, 59, 999) })
const days = (y: number, m: number, d: number, y2: number, m2: number, d2: number) =>
  ({ from: new Date(y, m, d, 0, 0, 0, 0), to: new Date(y2, m2, d2, 23, 59, 59, 999) })
const iv = (from: Date, to: Date) => ({ from, to })
```

  Comparar fechas con `toEqual` (compara el instante).
- **Checkpoint:** `npx vitest run src/Pages/Stats/__tests__/hourFilter.test.ts` en verde.

### Paso 3.9 — `renderer/src/Pages/Stats/workdayStorage.ts` (nuevo)

- **Qué hacer:**

```ts
/**
 * Jornada laboral de Estadísticas recordada en localStorage (mismo patrón que utils/theme.ts).
 * Valor: {"start":"08:00","end":"02:00"}. Ante cualquier problema se usa DEFAULT_WORKDAY.
 */
import { formatMinutesHM, parseTimeHM } from '../../utils/time'
import { DEFAULT_WORKDAY, type TimeWindow } from './hourFilter'

/** Clave de localStorage donde se recuerda la jornada laboral. */
export const WORKDAY_STORAGE_KEY = 'integral.stats.workday'

/** Lee la jornada guardada. Sin clave, JSON corrupto, horas inválidas o storage inaccesible → 08:00 → 02:00. */
export function loadWorkday(): TimeWindow {
  try {
    const raw = localStorage.getItem(WORKDAY_STORAGE_KEY)
    if (raw === null) return { ...DEFAULT_WORKDAY }
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_WORKDAY }
    const { start, end } = data as { start?: unknown; end?: unknown }
    const startMinute = typeof start === 'string' ? parseTimeHM(start) : null
    const endMinute = typeof end === 'string' ? parseTimeHM(end) : null
    if (startMinute === null || endMinute === null) return { ...DEFAULT_WORKDAY }
    return { startMinute, endMinute }
  } catch {
    return { ...DEFAULT_WORKDAY }
  }
}

/** Guarda la jornada. Si no hay storage, el cambio vale solo para esta sesión. */
export function saveWorkday(w: TimeWindow): void {
  try {
    localStorage.setItem(
      WORKDAY_STORAGE_KEY,
      JSON.stringify({ start: formatMinutesHM(w.startMinute), end: formatMinutesHM(w.endMinute) })
    )
  } catch {
    /* sin storage: solo esta sesión */
  }
}
```

### Paso 3.10 — `renderer/src/Pages/Stats/__tests__/workdayStorage.test.ts` (nuevo)

- **Qué hacer** (patrón de `utils/__tests__/theme.test.ts`: `beforeEach(() => localStorage.clear())`, `afterEach(() => vi.restoreAllMocks())`):
  1. `WORKDAY_STORAGE_KEY === 'integral.stats.workday'`.
  2. Sin nada guardado → `{ startMinute: 480, endMinute: 120 }`.
  3. Guardado `'{"start":"09:30","end":"03:00"}'` → `{ startMinute: 570, endMinute: 180 }`.
  4. `it.each` de valores inválidos → default `{ 480, 120 }`: `'{oops'`, `'null'`, `'123'`, `'"08:00"'`, `'[]'`, `'{"start":"25:00","end":"02:00"}'`, `'{"start":"08:00"}'`, `'{"start":8,"end":2}'`, `'{"start":"8:00","end":"02:00"}'`.
  5. `vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('sin storage') })` → default.
  6. `saveWorkday({ startMinute: 570, endMinute: 180 })` → `localStorage.getItem(KEY) === '{"start":"09:30","end":"03:00"}'` (string exacto).
  7. `setItem` que lanza → `saveWorkday` no lanza (`expect(() => …).not.toThrow()`).
  8. Ida y vuelta: `saveWorkday(w)` y `loadWorkday()` → igual a `w` para `{ 1320, 360 }` y `{ 480, 480 }`.
  9. `loadWorkday()` devuelve una copia: mutar el resultado no cambia `DEFAULT_WORKDAY.startMinute` (sigue 480).
- **Checkpoint:** `npx vitest run src/Pages/Stats/__tests__/workdayStorage.test.ts` en verde.

---

## Fase 4 — Pantalla de Estadísticas

### Paso 4.1 — Ajustar `Stats.test.tsx` ANTES de cambiar la pantalla

Motivo: va a haber **dos** pestañas "Personalizado" (Período y Horario) y `screen.getByRole('tab', { name: 'Personalizado' })` fallaría por ambigüedad.

- **Archivos:** `renderer/src/Pages/Stats/__tests__/Stats.test.tsx`.
- **Qué hacer:**
  1. Debajo de `const card = …` agregar:
     `const periodTab = (name: string) => within(screen.getByRole('tablist', { name: 'Período' })).getByRole('tab', { name })`
  2. Reemplazar **todas** (son 5) las apariciones de `screen.getByRole('tab', { name: 'Personalizado' })` por `periodTab('Personalizado')`. No cambies nada más.
- **Checkpoint:** `npx vitest run src/Pages/Stats` → 77 + los tests nuevos de las Fases 3 (todo en verde; la pantalla todavía no cambió).

### Paso 4.2 — `renderer/src/Pages/Stats/HourFilterBar.tsx` (nuevo)

Componente de presentación de la fila "Horario". El estado del filtro (modo, jornada, horas personalizadas) vive en `Stats.tsx`; el editor de la jornada (borradores, errores, foco) vive acá.

- **Qué hacer:**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Clock, Pencil } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Segmented'
import { TimeField } from '../../ui/TimeField'
import { formatMinutesHM, parseTimeHM, timeFieldError } from '../../utils/time'
import { describeWindow, resolveHourFilter, type HourFilterMode, type TimeWindow } from './hourFilter'

const HOUR_OPTIONS: { value: HourFilterMode; label: string; icon?: typeof Clock }[] = [
  { value: 'all', label: 'Todo el día' },
  { value: 'workday', label: 'Jornada laboral' },
  { value: 'custom', label: 'Personalizado', icon: Clock }
]

export type HourFilterBarProps = {
  mode: HourFilterMode
  onModeChange: (mode: HourFilterMode) => void
  /** Jornada laboral vigente (ya guardada). */
  workday: TimeWindow
  /** Jornada nueva, ya validada. El padre la guarda en localStorage y la aplica. */
  onWorkdayChange: (w: TimeWindow) => void
  /** Horas de "Personalizado" como texto "HH:MM" (pueden estar incompletas). */
  customStart: string
  customEnd: string
  onCustomStartChange: (value: string) => void
  onCustomEndChange: (value: string) => void
}

/**
 * Fila "Horario" de Estadísticas: Todo el día | Jornada laboral | Personalizado.
 * - Jornada laboral: muestra la franja guardada y se edita en el lugar con "Cambiar jornada".
 *   Enter guarda, Esc cancela; al cerrar, el foco vuelve a "Cambiar jornada".
 * - Personalizado: "Desde hora" / "Hasta hora" (HH:MM). El padre decide cuándo consultar.
 */
export default function HourFilterBar({
  mode,
  onModeChange,
  workday,
  onWorkdayChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange
}: HourFilterBarProps) {
  const [editing, setEditing] = useState(false)
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [errors, setErrors] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
  const startRef = useRef<HTMLInputElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  /** true cuando el editor se cerró con Guardar / Cancelar / Enter / Esc: el foco vuelve al botón. */
  const returnFocus = useRef(false)

  useEffect(() => {
    if (editing) {
      startRef.current?.focus()
    } else if (returnFocus.current) {
      returnFocus.current = false
      editButtonRef.current?.focus()
    }
  }, [editing])

  // Cambiar de modo cierra el editor sin devolver el foco (queda en la pestaña elegida).
  const changeMode = (next: HourFilterMode) => {
    setEditing(false)
    onModeChange(next)
  }

  const openEditor = () => {
    setDraftStart(formatMinutesHM(workday.startMinute))
    setDraftEnd(formatMinutesHM(workday.endMinute))
    setErrors({ start: null, end: null })
    setEditing(true)
  }

  const closeEditor = () => {
    returnFocus.current = true
    setEditing(false)
  }

  const save = () => {
    const startMinute = parseTimeHM(draftStart)
    const endMinute = parseTimeHM(draftEnd)
    if (startMinute === null || endMinute === null) {
      setErrors({ start: timeFieldError(draftStart, true), end: timeFieldError(draftEnd, true) })
      return
    }
    onWorkdayChange({ startMinute, endMinute })
    closeEditor()
  }

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeEditor()
    }
  }

  const custom = resolveHourFilter('custom', workday, customStart, customEnd)

  return (
    <div className="ig-filters stats-hours">
      <div className="ig-field">
        <span className="ig-label" aria-hidden="true">
          Horario
        </span>
        <Segmented<HourFilterMode> ariaLabel="Horario" options={HOUR_OPTIONS} value={mode} onChange={changeMode} />
      </div>

      {mode === 'workday' && !editing && (
        <>
          <span className="ig-help stats-hours-desc">{describeWindow(workday)}</span>
          <Button ref={editButtonRef} size="sm" variant="ghost" icon={Pencil} onClick={openEditor}>
            Cambiar jornada
          </Button>
        </>
      )}

      {mode === 'workday' && editing && (
        <>
          <TimeField
            id="stats-workday-start"
            label="Abre"
            className="stats-time"
            inputRef={startRef}
            value={draftStart}
            error={errors.start}
            onChange={(v) => {
              setDraftStart(v)
              setErrors((prev) => ({ ...prev, start: null }))
            }}
            onKeyDown={onEditorKeyDown}
          />
          <TimeField
            id="stats-workday-end"
            label="Cierra"
            className="stats-time"
            value={draftEnd}
            error={errors.end}
            onChange={(v) => {
              setDraftEnd(v)
              setErrors((prev) => ({ ...prev, end: null }))
            }}
            onKeyDown={onEditorKeyDown}
          />
          <Button size="sm" onClick={save}>
            Guardar jornada
          </Button>
          <Button size="sm" variant="ghost" onClick={closeEditor}>
            Cancelar
          </Button>
        </>
      )}

      {mode === 'custom' && (
        <>
          <TimeField
            id="stats-hour-from"
            label="Desde hora"
            className="stats-time"
            value={customStart}
            error={timeFieldError(customStart, false)}
            onChange={onCustomStartChange}
          />
          <TimeField
            id="stats-hour-to"
            label="Hasta hora"
            className="stats-time"
            value={customEnd}
            error={timeFieldError(customEnd, false)}
            onChange={onCustomEndChange}
          />
          <span className="ig-help stats-hours-desc">
            {custom.kind === 'window' ? describeWindow(custom.window) : 'Completá las dos horas para aplicar el filtro.'}
          </span>
        </>
      )}
    </div>
  )
}
```

- **Checkpoint:** `npm run typecheck` sin errores.

### Paso 4.3 — `renderer/src/Pages/Stats/__tests__/HourFilterBar.test.tsx` (nuevo)

- **Qué hacer:** setup:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HourFilterBar, { type HourFilterBarProps } from '../HourFilterBar'

const W = { startMinute: 480, endMinute: 120 } // 08:00 → 02:00

function setup(over: Partial<HourFilterBarProps> = {}) {
  const props: HourFilterBarProps = {
    mode: 'workday',
    onModeChange: vi.fn(),
    workday: W,
    onWorkdayChange: vi.fn(),
    customStart: '',
    customEnd: '',
    onCustomStartChange: vi.fn(),
    onCustomEndChange: vi.fn(),
    ...over
  }
  const utils = render(<HourFilterBar {...props} />)
  return { ...utils, props }
}
```

  Tests (uno por fila):

| # | Escenario | Pasos | Esperado |
|---|---|---|---|
| 1 | Pestañas | `setup({ mode: 'all' })` | Existe `tablist` "Horario" con 3 `tab`: "Todo el día" (`aria-selected="true"`), "Jornada laboral", "Personalizado". No hay "Cambiar jornada" ni campos de hora. |
| 2 | Cambio de modo | `setup({ mode: 'all' })`, click en "Jornada laboral" | `onModeChange` llamado con `'workday'`. |
| 3 | Jornada: descripción | `setup()` | Texto `De 08:00 a 02:00 del día siguiente` y botón "Cambiar jornada". |
| 4 | Abrir editor | click "Cambiar jornada" | Campos "Abre" = `08:00` y "Cierra" = `02:00`; "Abre" tiene el foco (`toHaveFocus`). |
| 5 | Guardar | abrir; "Abre" ← `'1000'`; "Cierra" ← `'0300'`; click "Guardar jornada" | `onWorkdayChange` llamado una vez con `{ startMinute: 600, endMinute: 180 }`; el editor se cierra (no está "Abre"); "Cambiar jornada" tiene el foco. |
| 6 | Hora fuera de rango | abrir; "Abre" ← `'2500'`; Guardar | Texto `Ingresá una hora entre 00:00 y 23:59.`; "Abre" con `aria-invalid="true"`; `onWorkdayChange` no llamado; el editor sigue abierto. |
| 7 | Hora incompleta | abrir; "Cierra" ← `'08'`; Guardar | Texto `Completá la hora (HH:MM).`; `onWorkdayChange` no llamado. |
| 8 | El error se borra al tipear | después del #6, "Abre" ← `'0900'` | Ya no está `Ingresá una hora entre 00:00 y 23:59.`; `aria-invalid="false"`. |
| 9 | Cancelar | abrir; "Abre" ← `'1000'`; click "Cancelar" | `onWorkdayChange` no llamado; vuelve `De 08:00 a 02:00 del día siguiente`; "Cambiar jornada" tiene el foco. |
| 10 | Enter guarda | abrir; "Abre" ← `'0900'`; `keyDown` Enter en "Cierra" | `onWorkdayChange` con `{ startMinute: 540, endMinute: 120 }`. |
| 11 | Esc cancela | abrir; `keyDown` Escape en "Abre" | Editor cerrado; `onWorkdayChange` no llamado. |
| 12 | Cambiar de modo cierra el editor | `const { rerender, props } = setup()`; abrir; click pestaña "Todo el día"; `rerender(<HourFilterBar {...props} mode="workday" />)` | `onModeChange` con `'all'`; después del rerender no está "Abre" y se ve la descripción. |
| 13 | Personalizado vacío | `setup({ mode: 'custom' })` | Campos "Desde hora" y "Hasta hora" vacíos; texto `Completá las dos horas para aplicar el filtro.`; ningún `aria-invalid="true"`. |
| 14 | Personalizado: máscara | `setup({ mode: 'custom' })`; "Desde hora" ← `'2200'` | `onCustomStartChange` con `'22:00'`. |
| 15 | Personalizado válido | `setup({ mode: 'custom', customStart: '22:00', customEnd: '06:00' })` | Texto `De 22:00 a 06:00 del día siguiente`. |
| 16 | Personalizado mismo día | `customStart: '09:00', customEnd: '13:00'` | Texto `De 09:00 a 13:00`. |
| 17 | Personalizado 24 h | `customStart: '08:00', customEnd: '08:00'` | Texto `De 08:00 a 08:00 del día siguiente (24 h)`. |
| 18 | Personalizado fuera de rango | `customStart: '25:00', customEnd: '06:00'` | Error `Ingresá una hora entre 00:00 y 23:59.` en "Desde hora" (`aria-invalid="true"`) y el texto `Completá las dos horas para aplicar el filtro.`. |
| 19 | Personalizado incompleto no marca error | `customStart: '08', customEnd: ''` | Ningún `aria-invalid="true"`. |

- **Checkpoint:** `npx vitest run src/Pages/Stats/__tests__/HourFilterBar.test.tsx` en verde.

### Paso 4.4 — CSS en `app.css` (bloque delimitado)

- **Archivos:** `renderer/src/styles/app.css`.
- **Qué hacer:** insertar este bloque **justo después** de la línea `select.ig-input { appearance: auto; }` (fin del bloque "Layouts de pantallas") y antes de `/* Botones con estado "presionado" …`. No lo pongas al final del archivo (ahí puede agregar cosas el otro agente):

```css

/* === Estadísticas: filtro horario === */
/* Campos HH:MM angostos; un mensaje de error puede ensanchar el campo sin achicar el input. */
.stats-hours .stats-time .ig-input { width: 112px; }
/* Descripción de la franja alineada con la altura de los inputs. */
.stats-hours .stats-hours-desc { display: inline-flex; align-items: center; min-height: var(--control-md); }
/* === fin Estadísticas: filtro horario === */
```

- **Checkpoint:** el bloque no usa ningún color (el único token es `var(--control-md)`). `git diff renderer/src/styles/app.css` muestra únicamente esas líneas agregadas.

### Paso 4.5 — `Stats.tsx`: estado del filtro y consultas

- **Archivos:** `renderer/src/Pages/Stats/Stats.tsx`.
- **Qué hacer:**
  1. **Imports.** Agregar:

```ts
import { InlineAlert } from '../../ui/InlineAlert'
import HourFilterBar from './HourFilterBar'
import {
  MAX_FILTERED_DAYS,
  countDays,
  getBusinessToday,
  orderHourRows,
  resolveHourFilter,
  toStatsInput,
  type HourFilterMode,
  type TimeWindow
} from './hourFilter'
import { loadWorkday, saveWorkday } from './workdayStorage'
```

  y en el import de `'./statsUtils'` **reemplazar** `getPeriodDates` por `getPeriodDatesAt` (si queda `getPeriodDates` sin uso, `noUnusedLocals` falla).
  2. **Estado** — debajo de `const [customTo, setCustomTo] = useState('')`:

```ts
  // ── Filtro horario ──────────────────────────────────────────────────────
  // El modo no se recuerda (arranca en "Todo el día"); la jornada sí (localStorage).
  const [hourMode, setHourMode] = useState<HourFilterMode>('all')
  const [workday, setWorkday] = useState<TimeWindow>(() => loadWorkday())
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
```

  3. **Derivados, rango y consulta** — reemplazar el bloque actual de `range` (el `useMemo` con el comentario "Rango actual…") y el de `prevRange` por:

```ts
  const hourState = resolveHourFilter(hourMode, workday, customStart, customEnd)
  const currentWindow: TimeWindow | null = hourState.kind === 'window' ? hourState.window : null
  // Primitivos para las dependencias de los useMemo: un objeto nuevo en cada render dispararía recargas.
  const winStart = currentWindow ? currentWindow.startMinute : null
  const winEnd = currentWindow ? currentWindow.endMinute : null
  const hourReady = hourState.kind !== 'incomplete'

  // Rango actual (días ancla). Con franja, Hoy / Esta semana / Este mes se anclan al día comercial en curso.
  // Para "Personalizado" solo existe si ambas fechas son válidas y desde <= hasta.
  // Con "Personalizado" (horario) incompleto no hay rango: no se consulta.
  const range = useMemo<DateRange | null>(() => {
    if (!hourReady) return null
    const w = winStart !== null && winEnd !== null ? { startMinute: winStart, endMinute: winEnd } : null
    if (preset !== 'custom') return getPeriodDatesAt(preset, getBusinessToday(new Date(), w))
    const from = parseDateAR(customFrom)
    const to = parseDateAR(customTo)
    if (!from || !to || from.getTime() > to.getTime()) return null
    return { from: getStartOfDay(from), to: getEndOfDay(to) }
  }, [preset, customFrom, customTo, hourReady, winStart, winEnd])

  const prevRange = useMemo(() => (range ? getPreviousPeriod(range, preset) : null), [range, preset])

  // Con franja, un período de más de MAX_FILTERED_DAYS días no se consulta (se avisa).
  const tooLong = winStart !== null && range !== null && countDays(range) > MAX_FILTERED_DAYS

  // Payloads de las 7 consultas. Sin franja: { from, to } como siempre; con franja: + intervals,
  // y el período anterior usa la MISMA franja.
  const query = useMemo(() => {
    if (!range || !prevRange || tooLong) return null
    const w = winStart !== null && winEnd !== null ? { startMinute: winStart, endMinute: winEnd } : null
    return { window: w, input: toStatsInput(range, w), prevInput: toStatsInput(prevRange, w) }
  }, [range, prevRange, tooLong, winStart, winEnd])
```

  4. **Efecto de carga** — en el `useEffect` actual: la primera línea pasa a `if (!query) return`; el `Promise.all` pasa a:

```ts
        const { input, prevInput } = query
        const [cur, prv, qty, rev, hour, wday, low] = await Promise.all([
          window.api.getSalesSummary(input),
          window.api.getSalesSummary(prevInput),
          window.api.getTopProductsByQuantity({ ...input, limit: TOP_LIMIT }),
          window.api.getTopProductsByRevenue({ ...input, limit: TOP_LIMIT }),
          window.api.getSalesByHour(input),
          window.api.getSalesByWeekday(input),
          window.api.getLowRotationProducts({ ...input, limit: LOW_LIMIT })
        ])
```

  `setByHour(hour)` pasa a `setByHour(orderHourRows(hour, query.window))` (R8: se ordena con la misma franja que se consultó). Las dependencias del efecto pasan a `[query, reloadKey]`. El resto del efecto (loading, error, cancelled) queda igual.
  5. **Jornada** — debajo de `openMovements`:

```ts
  const changeWorkday = (w: TimeWindow) => {
    saveWorkday(w)
    setWorkday(w)
  }
```

- **Checkpoint:** `npx vitest run src/Pages/Stats/__tests__/Stats.test.tsx` en verde (con "Todo el día" el payload sigue siendo `{ from, to }` y `{ from, to, limit }`). El typecheck se corre al final del Paso 4.6.

### Paso 4.6 — `Stats.tsx`: fila "Horario" y aviso de período largo

- **Qué hacer:**
  1. En el JSX, **inmediatamente después** del bloque `{preset === 'custom' && ( <div className="ig-filters"> … </div> )}` y **antes** de `{error && (`, insertar:

```tsx
      <HourFilterBar
        mode={hourMode}
        onModeChange={setHourMode}
        workday={workday}
        onWorkdayChange={changeWorkday}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      {tooLong && (
        <InlineAlert tone="info">
          {`Con un filtro horario el período puede tener hasta ${MAX_FILTERED_DAYS} días. Acortá las fechas o elegí «Todo el día».`}
        </InlineAlert>
      )}
```

  2. Actualizar el JSDoc del componente:

```ts
/**
 * Estadísticas: período (Hoy / Esta semana / Este mes / Personalizado) + filtro horario (Todo el día /
 * Jornada laboral / Personalizado), 4 KPIs con comparación contra el período anterior (con la misma franja),
 * rankings de productos, ventas por franja y productos de menor rotación.
 *
 * Con franja, se arma un intervalo [from, to) por día del período (`hourFilter.ts`) y se manda en
 * `intervals`; sin franja el payload es `{ from, to }` como siempre. Las 7 consultas se hacen en paralelo
 * (`Promise.all`); la comparación llama a `getSalesSummary` dos veces (período actual y anterior).
 * Click en un producto abre Stock › Movimientos filtrado por ese producto.
 */
```

- **Checkpoint:** `npx vitest run src/Pages/Stats` en verde y `npm run typecheck` sin errores.

### Paso 4.7 — Atajos "Últimos 7 días" y "Mes pasado" con el día comercial (R6)

- **Qué hacer:** en `fillLastSevenDays` y en `fillLastMonth`, reemplazar `const today = new Date()` por:
  `const today = getBusinessToday(new Date(), currentWindow)`
  (el resto de cada función queda igual).
- **Checkpoint:** `npx vitest run src/Pages/Stats/__tests__/Stats.test.tsx` en verde.

### Paso 4.8 — Tests de integración, parte 1: payloads (`StatsHourFilter.test.tsx`, nuevo)

- **Archivos:** crear `renderer/src/Pages/Stats/__tests__/StatsHourFilter.test.tsx`.
- **Qué hacer:** setup (copiar tal cual):

```tsx
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Stats from '../Stats'
import { WORKDAY_STORAGE_KEY } from '../workdayStorage'
import type { SalesByPeriodFromApi, StatsSummaryFromApi } from '../../../electron-api'

/* eslint-disable @typescript-eslint/no-explicit-any */

const summary: StatsSummaryFromApi = { totalRevenue: '50000', saleCount: 10, averageTicket: '5000', totalProfit: '20000' }
const hourRow = (label: string, saleCount: number): SalesByPeriodFromApi => ({ label, saleCount, totalRevenue: '1000' })

const navigate = vi.fn()
let api: Record<string, ReturnType<typeof vi.fn>>

/** Fecha local (mes 0-based, como `new Date`). */
const d = (y: number, m: number, day: number, h = 0, min = 0, s = 0, ms = 0) => new Date(y, m, day, h, min, s, ms)
const iv = (from: Date, to: Date) => ({ from, to })
const periodTab = (name: string) => within(screen.getByRole('tablist', { name: 'Período' })).getByRole('tab', { name })
const hourTab = (name: string) => within(screen.getByRole('tablist', { name: 'Horario' })).getByRole('tab', { name })
/** Payload de la llamada n (0-based) a getSalesSummary: actual = 0, 2, 4…; anterior = 1, 3, 5… */
const summaryCall = (n: number) => api.getSalesSummary.mock.calls[n][0]
const lastCall = (fn: string) => api[fn].mock.calls[api[fn].mock.calls.length - 1][0]
const waitSummaryCalls = (n: number) => waitFor(() => expect(api.getSalesSummary).toHaveBeenCalledTimes(n))
const renderStats = () => render(<Stats navigate={navigate} />)
const loaded = () => screen.findByText('Ventas totales')
const hourLabels = () =>
  Array.from(
    (screen.getByRole('heading', { name: 'Cuándo se vende más' }).closest('section') as HTMLElement).querySelectorAll(
      'tbody td.name'
    )
  ).map((td) => td.textContent)

beforeEach(() => {
  localStorage.clear()
  // Solo se falsea Date: los setTimeout siguen siendo reales, así findBy / waitFor funcionan.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(d(2026, 9, 21, 15, 0)) // miércoles 21/10/2026 15:00
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api = {
    getSalesSummary: vi.fn().mockResolvedValue(summary),
    getTopProductsByQuantity: vi.fn().mockResolvedValue([]),
    getTopProductsByRevenue: vi.fn().mockResolvedValue([]),
    getSalesByHour: vi.fn().mockResolvedValue([hourRow('01', 2), hourRow('08', 1), hourRow('23', 1)]),
    getSalesByWeekday: vi.fn().mockResolvedValue([]),
    getLowRotationProducts: vi.fn().mockResolvedValue([])
  }
  ;(window as any).api = api
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
```

  Tests de esta parte (`describe('Stats — filtro horario: payloads')`). En todos: `renderStats(); await loaded()` primero. "Ahora" = miércoles 21/10/2026 15:00 salvo que se diga otra cosa.

| # | Test | Pasos | Esperado |
|---|---|---|---|
| 1 | Default "Todo el día" sin `intervals` | — | `hourTab('Todo el día')` con `aria-selected="true"`. `summaryCall(0)` y `summaryCall(1)` **no** tienen la propiedad `intervals` (`not.toHaveProperty('intervals')`), y `lastCall(fn)` tampoco para `getTopProductsByQuantity`, `getTopProductsByRevenue`, `getSalesByHour`, `getSalesByWeekday`, `getLowRotationProducts`. `summaryCall(0).from` = `d(2026, 9, 1)`. |
| 2 | Jornada + Este mes | click `hourTab('Jornada laboral')`; `await waitSummaryCalls(4)` | `summaryCall(2)`: `from` = `d(2026, 9, 1)`, `to` = `d(2026, 9, 31, 23, 59, 59, 999)`, `intervals` de largo 31, `intervals[0]` = `iv(d(2026, 9, 1, 8), d(2026, 9, 2, 2))`, `intervals[30]` = `iv(d(2026, 9, 31, 8), d(2026, 10, 1, 2))`. `summaryCall(3)` (anterior): `from` = `d(2026, 8, 1)`, largo 30, `intervals[29]` = `iv(d(2026, 8, 30, 8), d(2026, 9, 1, 2))`. |
| 3 | Las 7 consultas usan la misma franja | igual que #2 | Para `getTopProductsByQuantity`, `getTopProductsByRevenue`, `getSalesByHour`, `getSalesByWeekday`, `getLowRotationProducts`: `lastCall(fn).intervals` `toEqual(summaryCall(2).intervals)`. `lastCall('getTopProductsByQuantity').limit` = 5, `lastCall('getLowRotationProducts').limit` = 10. |
| 4 | Volver a "Todo el día" | #2; click `hourTab('Todo el día')`; `await waitSummaryCalls(6)` | `summaryCall(4)` y `summaryCall(5)` sin `intervals`. |
| 5 | "Hoy" + jornada (a las 15:00) | click `periodTab('Hoy')`; `waitSummaryCalls(4)`; click `hourTab('Jornada laboral')`; `waitSummaryCalls(6)` | `summaryCall(4).intervals` = `[iv(d(2026, 9, 21, 8), d(2026, 9, 22, 2))]`; `summaryCall(5).intervals` = `[iv(d(2026, 9, 20, 8), d(2026, 9, 21, 2))]` (ayer con la misma franja). |
| 6 | "Por hora" ordenado desde la apertura | con "Todo el día" | `hourLabels()` = `['01–02 h', '08–09 h', '23–00 h']`. Click `hourTab('Jornada laboral')` → `await waitFor(() => expect(hourLabels()).toEqual(['08–09 h', '23–00 h', '01–02 h']))`. |

- **Checkpoint:** `npx vitest run src/Pages/Stats/__tests__/StatsHourFilter.test.tsx` en verde.

### Paso 4.9 — Tests de integración, parte 2: día comercial en curso (R6)

- **Qué hacer:** `describe('Stats — filtro horario: día comercial en curso')`. En cada test llamá a `vi.setSystemTime(...)` **antes** de `renderStats()`.

| # | Test | Ahora | Pasos | Esperado |
|---|---|---|---|---|
| 7 | Hoy a la 01:00 con jornada = lunes | `d(2026, 9, 20, 1, 0)` (martes 01:00) | `periodTab('Hoy')`; `waitSummaryCalls(4)`; `hourTab('Jornada laboral')`; `waitSummaryCalls(6)` | `summaryCall(4)`: `from` = `d(2026, 9, 19)`, `to` = `d(2026, 9, 19, 23, 59, 59, 999)`, `intervals` = `[iv(d(2026, 9, 19, 8), d(2026, 9, 20, 2))]`. `summaryCall(5).intervals` = `[iv(d(2026, 9, 18, 8), d(2026, 9, 19, 2))]`. En pantalla: `await screen.findByText(/19 – 19 oct 2026 · comparado con 18 – 18 oct 2026/)`. |
| 8 | Hoy a la 01:00 sin franja = martes | `d(2026, 9, 20, 1, 0)` | `periodTab('Hoy')`; `waitSummaryCalls(4)` | `summaryCall(2).from` = `d(2026, 9, 20)` y sin `intervals`. |
| 9 | Hoy a las 05:00 con jornada = martes (P3) | `d(2026, 9, 20, 5, 0)` | como #7 | `summaryCall(4).intervals` = `[iv(d(2026, 9, 20, 8), d(2026, 9, 21, 2))]`. |
| 10 | Este mes el 1/11 a la 01:00 | `d(2026, 10, 1, 1, 0)` (domingo) | inicial (Todo el día); `hourTab('Jornada laboral')`; `waitSummaryCalls(4)` | `summaryCall(0).from` = `d(2026, 10, 1)` (noviembre). `summaryCall(2).from` = `d(2026, 9, 1)` (octubre), `intervals` de largo 31; `summaryCall(3).from` = `d(2026, 8, 1)`. |
| 11 | "Últimos 7 días" a la 01:00 | `d(2026, 9, 20, 1, 0)` | `hourTab('Jornada laboral')`; `periodTab('Personalizado')`; click botón "Últimos 7 días" | `getByLabelText('Desde')` = `13/10/2026` y `getByLabelText('Hasta')` = `19/10/2026`. |
| 12 | "Últimos 7 días" sin franja | `d(2026, 9, 20, 1, 0)` | `periodTab('Personalizado')`; "Últimos 7 días" | `14/10/2026` – `20/10/2026`. |
| 13 | "Mes pasado" el 1/11 a la 01:00 con jornada | `d(2026, 10, 1, 1, 0)` | `hourTab('Jornada laboral')`; `periodTab('Personalizado')`; "Mes pasado" | `01/09/2026` – `30/09/2026`. |

- **Checkpoint:** el archivo en verde.

### Paso 4.10 — Tests de integración, parte 3: jornada guardada y "Cambiar jornada"

- **Qué hacer:** `describe('Stats — filtro horario: jornada laboral')`:

| # | Test | Pasos | Esperado |
|---|---|---|---|
| 14 | Usa la jornada guardada | antes de render: `localStorage.setItem(WORKDAY_STORAGE_KEY, '{"start":"09:00","end":"21:00"}')`; render; `hourTab('Jornada laboral')`; `waitSummaryCalls(4)` | Texto `De 09:00 a 21:00`; `summaryCall(2).intervals[0]` = `iv(d(2026, 9, 1, 9), d(2026, 9, 1, 21))`. |
| 15 | Storage corrupto → 08→02 | `localStorage.setItem(WORKDAY_STORAGE_KEY, '{oops')`; render; Jornada | Texto `De 08:00 a 02:00 del día siguiente`. |
| 16 | Cambiar jornada guarda y recarga | Jornada; `waitSummaryCalls(4)`; click "Cambiar jornada"; "Abre" ← `'1000'`; "Cierra" ← `'0300'`; click "Guardar jornada"; `waitSummaryCalls(6)` | `localStorage.getItem(WORKDAY_STORAGE_KEY)` = `'{"start":"10:00","end":"03:00"}'`; texto `De 10:00 a 03:00 del día siguiente`; `summaryCall(4).intervals[0]` = `iv(d(2026, 9, 1, 10), d(2026, 9, 2, 3))`. |
| 17 | Hora inválida no guarda ni consulta | Jornada; `waitSummaryCalls(4)`; "Cambiar jornada"; "Abre" ← `'2500'`; "Guardar jornada"; `await act(async () => {})` | Texto `Ingresá una hora entre 00:00 y 23:59.`; `localStorage.getItem(WORKDAY_STORAGE_KEY)` = `null`; `getSalesSummary` sigue en 4 llamadas. |
| 18 | Cancelar no cambia nada | Jornada; `waitSummaryCalls(4)`; "Cambiar jornada"; "Abre" ← `'1000'`; "Cancelar"; `await act(async () => {})` | Texto `De 08:00 a 02:00 del día siguiente`; storage `null`; 4 llamadas. |
| 19 | El modo no se recuerda, la jornada sí | `const first = renderStats(); await loaded()`; Jornada; guardar `10:00`/`03:00` como #16; `first.unmount()`; `renderStats(); await loaded()` | `hourTab('Todo el día')` con `aria-selected="true"`; click `hourTab('Jornada laboral')` → texto `De 10:00 a 03:00 del día siguiente`. |

- **Checkpoint:** el archivo en verde.

### Paso 4.11 — Tests de integración, parte 4: horario personalizado

- **Qué hacer:** `describe('Stats — filtro horario: personalizado')` ("Desde hora"/"Hasta hora" se escriben con `fireEvent.change(screen.getByLabelText('Desde hora'), { target: { value: '2200' } })`):

| # | Test | Pasos | Esperado |
|---|---|---|---|
| 20 | No consulta hasta tener las dos horas | `hourTab('Personalizado')`; `await act(async () => {})`; "Desde hora" ← `'2200'`; `await act(async () => {})` | Se ven "Desde hora" y "Hasta hora" y el texto `Completá las dos horas para aplicar el filtro.`; `getSalesSummary` sigue en 2 llamadas. |
| 21 | Con las dos horas consulta (cruza medianoche) | #20 + "Hasta hora" ← `'0600'`; `waitSummaryCalls(4)` | `summaryCall(2).intervals[0]` = `iv(d(2026, 9, 1, 22), d(2026, 9, 2, 6))`; texto `De 22:00 a 06:00 del día siguiente`. |
| 22 | Hora fuera de rango: error y no consulta | `hourTab('Personalizado')`; "Desde hora" ← `'2500'`; "Hasta hora" ← `'0600'`; `await act(async () => {})` | Error `Ingresá una hora entre 00:00 y 23:59.`; "Desde hora" con `aria-invalid="true"`; 2 llamadas. |
| 23 | Misma hora = 24 h | "Desde hora" ← `'0800'`; "Hasta hora" ← `'0800'`; `waitSummaryCalls(4)` | `summaryCall(2).intervals[0]` = `iv(d(2026, 9, 1, 8), d(2026, 9, 2, 8))`; texto `De 08:00 a 08:00 del día siguiente (24 h)`. |
| 24 | Franja del mismo día | `'0900'` / `'1300'`; `waitSummaryCalls(4)` | `summaryCall(2).intervals[0]` = `iv(d(2026, 9, 1, 9), d(2026, 9, 1, 13))`; `summaryCall(2).intervals` de largo 31. |

- **Checkpoint:** el archivo en verde.

### Paso 4.12 — Tests de integración, parte 5: período personalizado con franja

- **Qué hacer:** `describe('Stats — filtro horario: período personalizado')` (las fechas se escriben como en `Stats.test.tsx`: `fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '01102026' } })`):

| # | Test | Pasos | Esperado |
|---|---|---|---|
| 25 | El último día llega hasta las 02:00 del siguiente | `periodTab('Personalizado')`; Desde `01102026`, Hasta `15102026`; `waitSummaryCalls(4)`; `hourTab('Jornada laboral')`; `waitSummaryCalls(6)` | `summaryCall(4).intervals` de largo 15 y el último = `iv(d(2026, 9, 15, 8), d(2026, 9, 16, 2))`. `summaryCall(5)`: `from` = `d(2026, 8, 16)`, `to` = `d(2026, 8, 30, 23, 59, 59, 999)`, largo 15, último = `iv(d(2026, 8, 30, 8), d(2026, 9, 1, 2))`. |
| 26 | Más de 366 días con franja: avisa y no consulta | `periodTab('Personalizado')`; Desde `01012024`, Hasta `31122025`; `waitSummaryCalls(4)` (sin franja sí consulta); `hourTab('Jornada laboral')`; `await act(async () => {})` | `screen.getByText(/hasta 366 días/)` visible; `getSalesSummary` sigue en 4 llamadas. Después click `hourTab('Todo el día')` → `waitSummaryCalls(6)` y el aviso ya no está (`queryByText(/hasta 366 días/)` null). |
| 27 | 366 días exactos con franja sí consulta | Desde `01012024`, Hasta `31122024` (bisiesto); `waitSummaryCalls(4)`; Jornada; `waitSummaryCalls(6)` | `summaryCall(4).intervals` de largo 366; sin aviso. |

- **Checkpoint:** `npx vitest run src/Pages/Stats` → todo en verde.

### Paso 4.13 — Lint de lo tocado

- **Checkpoint:** desde `renderer`: `npx eslint src/Pages/Stats src/ui/TimeField.tsx src/ui/__tests__/TimeField.test.tsx src/utils/time.ts src/utils/__tests__/time.test.ts` → 0 errores. (Si un test necesita `any`, usar el mismo comentario `/* eslint-disable @typescript-eslint/no-explicit-any */` que `Stats.test.tsx`.)

---

## Fase 5 — Verificación final y documentación

### Paso 5.1 — Suite completa del renderer

- **Checkpoint:** desde `renderer`: `npx vitest run` → **todo en verde**: 66 + 6 = **72 archivos** de test (los 6 nuevos: `time.test.ts`, `TimeField.test.tsx`, `hourFilter.test.ts`, `workdayStorage.test.ts`, `HourFilterBar.test.tsx`, `StatsHourFilter.test.tsx`; `statsUtils.test.ts` y `Stats.test.tsx` ya existían) y bastante más de 850 tests.

### Paso 5.2 — Backend

- **Checkpoint:** `npm run test:stats-repository`, `npm run test:ipc-bridge` y `npm run test:backend-db` → PASS. Después `npm run test:backend` completo (≈ 3–4 min) → exit 0. `backend/prisma/` no tiene archivos `test-*.db` sobrantes.

### Paso 5.3 — Typecheck

- **Checkpoint:** `npm run typecheck` → sin errores.

### Paso 5.4 — Lint

- **Checkpoint:** `npm run lint --workspace renderer` → exactamente los **7 errores preexistentes** de la sección 1.7 y ninguno en archivos de este plan.

### Paso 5.5 — Prueba manual (opcional, si hay entorno gráfico)

- Cerrá cualquier Integral abierto (instancia única). Bash: `env -u ELECTRON_RUN_AS_NODE npm start` · PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE; npm start`.
- Estadísticas (`Ctrl+3`): la fila "Horario" aparece debajo del período; "Jornada laboral" muestra "De 08:00 a 02:00 del día siguiente"; "Cambiar jornada" → `Tab`/`Enter`/`Esc` funcionan; en "Personalizado" la máscara agrega ":"; en tema oscuro todo se lee bien; a 1280 px de ancho la fila no se desborda.

### Paso 5.6 — `CLAUDE.md` (solo la subsección de Estadísticas)

- **Qué hacer:** reemplazar **desde** la línea `### Módulo de Estadísticas (planificado)` **hasta** la línea anterior al `---` que precede a `### Próximo trabajo: Stock CRUD` (sin tocar ese `---`) por:

```markdown
### Módulo de Estadísticas

Pantalla `Stats` accesible desde el Header (botón "Estadísticas", `Ctrl+3`). Período de análisis con 4 presets: **Hoy | Esta semana | Este mes | Personalizado** (default: Este mes) y **filtro horario**: **Todo el día | Jornada laboral | Personalizado** (default: Todo el día).

**Estadísticas a mostrar:**
1. **Ventas Totales** — total facturado en el período
2. **Cantidad de Ventas (Tickets)** — total de operaciones
3. **Ticket Promedio** — `Ventas Totales / Cantidad de Tickets`
4. **Productos Más Vendidos** — ranking por unidades vendidas (top 5)
5. **Productos que Más Facturan** — ranking por monto generado (top 5)
6. **Ganancia Total** — `Ventas Totales - Costos` (usando `purchasePriceSnapshot`)
7. **Comparación vs Período Anterior** — cada card muestra `%` de cambio contra el período equivalente anterior
8. **Horarios/Días con Más Ventas** — tabla con tabs "Por hora" / "Por día de semana"
9. **Productos con Menor Rotación** — top 10 productos menos vendidos en el período

**Cambio de schema**: se agrega `purchasePriceSnapshot Decimal?` a `SaleItem` (nullable, retrocompatible). Al crear una venta nueva, guarda el `purchasePrice` del producto en ese momento. Ítems "general" quedan con `null`. Requiere migración Prisma.

**Backend**: repositorio `statsRepository.ts` con 6 funciones de agregación. 6 canales IPC: `stats:getSummary`, `stats:getTopProductsByQuantity`, `stats:getTopProductsByRevenue`, `stats:getSalesByHour`, `stats:getSalesByWeekday`, `stats:getLowRotationProducts`. Todos aceptan `intervals?` (filtro horario); sin `intervals` el resultado es el de siempre.

**Frontend**: Las 7 llamadas se hacen en `Promise.all`. Comparación de períodos: el frontend llama a `getSalesSummary` dos veces en paralelo (período actual + período anterior). `getPreviousPeriod` es calendar-aware: para 'month' retorna el mes calendario anterior; para 'week' retrocede 7 días; para el resto usa el mismo rango en ms.

#### Filtro horario (vigente)

- **Afecta a todo el panel**: los 4 KPIs, la comparación (el período anterior usa la misma franja), los rankings, "Por hora" / "Por día de semana" y menor rotación.
- **Opciones** (`Pages/Stats/HourFilterBar.tsx`): "Todo el día" (días calendario, como siempre; el payload no lleva `intervals`) · "Jornada laboral" (franja guardada; "Cambiar jornada" la edita en el lugar con "Abre" / "Cierra"; default 08:00 → 02:00) · "Personalizado" ("Desde hora" / "Hasta hora" en `HH:MM` con `ui/TimeField.tsx`: texto con máscara, nada de `type="time"`; no se consulta hasta tener las dos horas válidas).
- **Jornada en localStorage**: clave `integral.stats.workday`, valor `{"start":"08:00","end":"02:00"}` (`Pages/Stats/workdayStorage.ts`; sin clave, corrupto, inválido o sin storage → default). El modo elegido **no** se recuerda: al abrir arranca en "Todo el día".
- **Semántica** (`Pages/Stats/hourFilter.ts`): `desde` inclusivo, `hasta` exclusivo. `desde < hasta` → cada día D: `[D desde, D hasta)`. `hasta <= desde` → **día comercial** `[D desde, D+1 hasta)` (`desde == hasta` = 24 h). Cada venta pertenece al día en que empieza su intervalo: con 08→02 la venta del martes 01:00 cuenta para el **lunes** (en el período y en "Por día de semana"); sin filtro horario cuenta para el martes. "Hoy / Esta semana / Este mes" y los atajos "Últimos 7 días" / "Mes pasado" se anclan al día comercial en curso (`getBusinessToday`: martes 01:00 → lunes; martes 05:00 → martes). "Por hora" agrupa por hora real y, con franja, se ordena desde la hora de apertura (08…23, 00, 01).
- **Tope**: con franja, el período puede tener hasta 366 días (`MAX_FILTERED_DAYS`); si no, no se consulta y se avisa con `InlineAlert`.
- **Arquitectura**: el renderer arma un intervalo `[from, to)` por día ancla (`buildIntervals`, siempre con `new Date(y, m, d, h, min)`) y lo manda en el campo opcional `intervals` (`StatsRangeInput = { from, to, intervals? }` en `backend/repositories/statsIntervals.ts`, `electron/ipcContract.ts` y `renderer/src/electron-api.d.ts`). El backend valida (máx. 400 intervalos, `from < to`) y `buildSaleDateWhere` filtra con `date >= primer inicio AND date < último fin AND (OR de intervalos)`: el rango envolvente es obligatorio para que SQLite use el índice de `Sale.date`. "Por día de semana" toma el día ancla con `findIntervalIndex` (búsqueda binaria).
- **Tests**: `renderer/src/Pages/Stats/__tests__/` (`hourFilter`, `workdayStorage`, `HourFilterBar`, `StatsHourFilter`, `statsUtils`, `Stats`), `renderer/src/utils/__tests__/time.test.ts`, `renderer/src/ui/__tests__/TimeField.test.tsx` y `npm run test:stats-repository` (DB temporal; incluido en `test:backend`).
```

- **Checkpoint:** `git diff CLAUDE.md` solo muestra cambios dentro de esa subsección.

### Paso 5.7 — Cierre

- **Checkpoint:** `git status` muestra exactamente los archivos de la sección 1.6 (nuevos + modificados) y `plan.md`; ningún `backend/prisma/test-*.db`; nada fuera del worktree. **No hagas commit.** Reportá: archivos tocados, resultados de 5.1–5.4 y cualquier desvío del plan.

---

## Apéndice A — Tablas de casos de prueba de la semántica (`hourFilter.test.ts`)

Fechas `new Date(año, mes0, día, h, min)`. `W` = jornada 08→02 (`{ startMinute: 480, endMinute: 120 }`). Octubre 2026: dom 18, lun 19, mar 20, mié 21, dom 25, lun 26; sáb 31/10; dom 1/11.

**A.1 `crossesMidnight`**

| start | end | resultado |
|---|---|---|
| 480 (08:00) | 120 (02:00) | `true` |
| 540 (09:00) | 780 (13:00) | `false` |
| 480 | 480 | `true` (24 h) |
| 0 | 0 | `true` (24 h desde la medianoche) |
| 480 | 0 | `true` (hasta la medianoche) |
| 0 | 1439 | `false` |
| 1380 (23:00) | 1439 (23:59) | `false` |

**A.2 `getBusinessToday(now, w)`** — resultado comparado con `new Date(y, m, d)` (00:00):

| now | w | resultado |
|---|---|---|
| mar 20/10 01:00 | W | lun 19/10 |
| mar 20/10 00:00 | W | lun 19/10 |
| mar 20/10 01:59 | W | lun 19/10 |
| mar 20/10 02:00 | W | mar 20/10 |
| mar 20/10 05:00 | W | mar 20/10 (P3) |
| mar 20/10 08:00 | W | mar 20/10 |
| mar 20/10 23:59 | W | mar 20/10 |
| mar 20/10 01:00 | `null` | mar 20/10 |
| mar 20/10 01:00 | 09→13 | mar 20/10 |
| mar 20/10 00:30 | 08→00 (`{480, 0}`) | mar 20/10 |
| mar 20/10 05:00 | 06→06 (`{360, 360}`) | lun 19/10 |
| mar 20/10 06:00 | 06→06 | mar 20/10 |
| mar 20/10 00:00 | 00→00 (`{0, 0}`) | mar 20/10 |
| dom 1/11/2026 01:00 | W | sáb 31/10/2026 |
| vie 1/1/2027 01:30 | W | jue 31/12/2026 |

**A.3 `getPeriodDatesAt(preset, getBusinessToday(now, w))`**

| now | w | preset | from | to |
|---|---|---|---|---|
| dom 1/11/2026 01:00 | W | month | 1/10/2026 00:00 | 31/10/2026 23:59:59.999 |
| lun 26/10/2026 01:00 | W | week | lun 19/10 00:00 | dom 25/10 23:59:59.999 |
| lun 26/10/2026 01:00 | `null` | week | lun 26/10 00:00 | dom 1/11 23:59:59.999 |
| mar 20/10/2026 01:00 | W | today | lun 19/10 00:00 | lun 19/10 23:59:59.999 |

**A.4 `buildIntervals(range, w)`** (`range` armado con `day`/`days` del Paso 3.8)

| range | w | intervalos esperados |
|---|---|---|
| lun 19/10 | W | `[19/10 08:00 → 20/10 02:00)` |
| lun 19 – mar 20 | W | `[19 08:00 → 20 02:00)`, `[20 08:00 → 21 02:00)` |
| lun 19 – mar 20 | 09→13 (`{540, 780}`) | `[19 09:00 → 19 13:00)`, `[20 09:00 → 20 13:00)` |
| lun 19 | 08→08 (`{480, 480}`) | `[19 08:00 → 20 08:00)` |
| lun 19 | 00→00 (`{0, 0}`) | `[19 00:00 → 20 00:00)` |
| lun 19 | 08→00 (`{480, 0}`) | `[19 08:00 → 20 00:00)` |
| lun 19 | 08:30→01:15 (`{510, 75}`) | `[19 08:30 → 20 01:15)` |
| sáb 31/10 | W | `[31/10 08:00 → 1/11 02:00)` (cambio de mes) |
| jue 31/12/2026 | W | `[31/12/2026 08:00 → 1/1/2027 02:00)` (cambio de año) |
| octubre 2026 (`getPeriodDatesAt('month', new Date(2026, 9, 21))`) | W | 31 intervalos; `[0]` = `[1/10 08:00 → 2/10 02:00)`; `[30]` = `[31/10 08:00 → 1/11 02:00)` |
| febrero 2028 (`getPeriodDatesAt('month', new Date(2028, 1, 10))`) | W | 29 intervalos |

Propiedades (para el rango de octubre): cada `from < to`; ordenados; sin solapamientos (`intervals[i].to <= intervals[i + 1].from`).

**A.5 `countDays`**: lun 19 – lun 19 → `1` · octubre 2026 → `31` · 1/1/2024 – 31/12/2024 → `366` · 1/1/2024 – 31/12/2025 → `731`. Y `MAX_FILTERED_DAYS === 366`.

**A.6 Período anterior con la misma franja** (`toStatsInput(getPreviousPeriod(range, preset), W).intervals`):

| range / preset | anterior | intervalos del anterior |
|---|---|---|
| mar 20/10 / `today` | lun 19/10 | `[iv(19 08:00, 20 02:00)]` (termina antes del primer intervalo actual, `[20 08:00 …)`) |
| 19–25/10 / `week` | 12–18/10 | 7 intervalos; el último `[18 08:00 → 19 02:00)` |
| octubre / `month` | septiembre | 30 intervalos; el último `[30/9 08:00 → 1/10 02:00)` (la madrugada del 1/10 es de septiembre) |
| 1–15/10 / `custom` | 16–30/9 (`getPreviousPeriod` da exactamente `days(2026, 8, 16, 2026, 8, 30)`) | 15 intervalos |

**A.7 `toStatsInput`**: con `w = null` → `Object.keys(result)` es `['from', 'to']` (sin `intervals`) y `from`/`to` son los del rango. Con `W` → `intervals` `toEqual(buildIntervals(range, W))`.

**A.8 `orderHourRows`** (filas `{ label, saleCount: 1, totalRevenue: '1' }`):

| labels de entrada | w | labels de salida |
|---|---|---|
| `['01', '08', '23']` | `null` | `['01', '08', '23']` y **la misma referencia** (`toBe`) |
| `['01', '08', '23']` | W | `['08', '23', '01']` |
| `['00', '05', '22', '23']` | 22:30→06:00 (`{1350, 360}`) | `['22', '23', '00', '05']` |
| `['10', '12']` | 09→13 | `['10', '12']` |
| `[]` | W | `[]` |

Además: después de ordenar con W, el array de entrada sigue `['01', '08', '23']` (no se muta).

**A.9 `describeWindow` y `resolveHourFilter`**

| franja | `describeWindow` |
|---|---|
| `{480, 120}` | `De 08:00 a 02:00 del día siguiente` |
| `{540, 780}` | `De 09:00 a 13:00` |
| `{480, 480}` | `De 08:00 a 08:00 del día siguiente (24 h)` |
| `{480, 0}` | `De 08:00 a 00:00 del día siguiente` |
| `{0, 0}` | `De 00:00 a 00:00 del día siguiente (24 h)` |

| mode | customStart | customEnd | `resolveHourFilter(mode, W, …)` |
|---|---|---|---|
| `'all'` | `'22:00'` | `'06:00'` | `{ kind: 'all' }` |
| `'workday'` | `''` | `''` | `{ kind: 'window', window: W }` |
| `'custom'` | `''` | `''` | `{ kind: 'incomplete' }` |
| `'custom'` | `'22:00'` | `''` | `{ kind: 'incomplete' }` |
| `'custom'` | `'22:00'` | `'06:0'` | `{ kind: 'incomplete' }` |
| `'custom'` | `'25:00'` | `'06:00'` | `{ kind: 'incomplete' }` |
| `'custom'` | `'22:00'` | `'06:00'` | `{ kind: 'window', window: { startMinute: 1320, endMinute: 360 } }` |
| `'custom'` | `'08:00'` | `'08:00'` | `{ kind: 'window', window: { startMinute: 480, endMinute: 480 } }` |

---

## Apéndice B — Test de backend: dataset y resultados esperados

Los valores de este apéndice se verificaron con un prototipo del repositorio modificado sobre una DB temporal: los montos salen como strings sin ceros de más (`"350"`, `"116.67"`, `"96"`).

### B.1 Seed (código completo de `seed`)

```ts
async function seed(prisma: PrismaClient): Promise<void> {
  const category = await prisma.category.create({ data: { name: "Stats test category" } })
  const supplier = await prisma.supplier.create({ data: { name: "Stats test supplier" } })
  const base = { categoryId: category.id, supplierId: supplier.id }
  // Orden de creación = orden de ids (Alfajor, Gaseosa, Sin ventas): importa para los empates.
  const alfajor = await prisma.product.create({ data: { ...base, name: "Alfajor", purchasePrice: "60", salePrice: "100" } })
  const gaseosa = await prisma.product.create({ data: { ...base, name: "Gaseosa", purchasePrice: "20", salePrice: "50" } })
  await prisma.product.create({ data: { ...base, name: "Sin ventas", purchasePrice: "10", salePrice: "20" } })

  type Item = Prisma.SaleItemUncheckedCreateWithoutSaleInput
  const A = (quantity: number): Item => ({ productId: alfajor.id, quantity, unitPrice: "100", purchasePriceSnapshot: "60" })
  const G = (quantity: number): Item => ({ productId: gaseosa.id, quantity, unitPrice: "50", purchasePriceSnapshot: "20" })
  const general: Item = { quantity: 1, unitPrice: "30" } // línea General (F10): sin producto ni costo

  const sales: { date: Date; total: string; items: Item[] }[] = [
    { date: at(18, 23, 30), total: "100", items: [A(1)] }, // S0 dom 23:30
    { date: at(19, 7, 59), total: "100", items: [A(1)] }, // S1 lun 07:59 (antes de abrir)
    { date: at(19, 8, 0), total: "200", items: [A(2)] }, // S2 lun 08:00 (justo al abrir)
    { date: at(19, 23, 59), total: "50", items: [G(1)] }, // S3 lun 23:59
    { date: at(20, 1, 0), total: "150", items: [G(3)] }, // S4 mar 01:00 (madrugada del lunes)
    { date: at(20, 1, 59), total: "100", items: [A(1)] }, // S5 mar 01:59
    { date: at(20, 2, 0), total: "50", items: [G(1)] }, // S6 mar 02:00 (justo al cerrar: afuera)
    { date: at(20, 8, 0), total: "130", items: [A(1), general] }, // S7 mar 08:00 (+ línea General)
    { date: at(20, 10, 0), total: "50", items: [G(1)] }, // S8 mar 10:00
    { date: at(21, 1, 30), total: "100", items: [G(2)] } // S9 mié 01:30 (madrugada del martes)
  ]
  for (const s of sales) {
    await prisma.sale.create({ data: { date: s.date, total: s.total, items: { create: s.items } } })
  }
}
```

Ganancia por venta (precio − costo, la línea General no cuenta): S0 40 · S1 40 · S2 80 · S3 30 · S4 90 · S5 40 · S6 30 · S7 40 · S8 30 · S9 60.

### B.2 Casos

Formato de las filas: `byHour`/`byWeekday` como `label:saleCount:totalRevenue`; rankings con `topNames`/`lowNames` (`"Producto:valor"`). Al escribir el test, convertí cada fila a objetos `{ label, saleCount, totalRevenue }` (ver el modelo del caso A).

**Caso A — lunes calendario, sin `intervals` (como hoy)** — `stats.<fn>(LUN.from, LUN.to)` → ventas S1, S2, S3. Código completo como modelo:

```ts
async function testLegacy(stats: StatsModule): Promise<void> {
  // Caso A — lunes calendario, sin intervals: comportamiento de siempre (S1, S2, S3)
  assertEqual(
    await stats.getSalesSummary(LUN.from, LUN.to),
    { totalRevenue: "350", saleCount: 3, averageTicket: "116.67", totalProfit: "150" },
    "A summary"
  )
  assertEqual(
    await stats.getSalesByHour(LUN.from, LUN.to),
    [
      { label: "07", saleCount: 1, totalRevenue: "100" },
      { label: "08", saleCount: 1, totalRevenue: "200" },
      { label: "23", saleCount: 1, totalRevenue: "50" }
    ],
    "A byHour"
  )
  assertEqual(await stats.getSalesByWeekday(LUN.from, LUN.to), [{ label: "1", saleCount: 3, totalRevenue: "350" }], "A byWeekday")
  assertEqual(topNames(await stats.getTopProductsByQuantity(LUN.from, LUN.to, 5)), ["Alfajor:3", "Gaseosa:1"], "A topQty")
  assertEqual(topNames(await stats.getTopProductsByRevenue(LUN.from, LUN.to, 5)), ["Alfajor:300", "Gaseosa:50"], "A topRev")
  assertEqual(lowNames(await stats.getLowRotationProducts(LUN.from, LUN.to, 10)), ["Sin ventas:0", "Gaseosa:1", "Alfajor:3"], "A lowRot")
  logStep("caso A: lunes calendario sin intervals")

  // ... caso B
}
```

  **Último bloque del caso A (se agrega en el Paso 1.6):** para cada una de las 6 funciones, el resultado con `[]` y con `undefined` como último argumento es `assertEqual` al resultado sin ese argumento (ej. `stats.getSalesSummary(LUN.from, LUN.to, [])`, `stats.getTopProductsByQuantity(LUN.from, LUN.to, 5, undefined)`).

| Caso | Llamada | summary | byHour | byWeekday | topQty (5) | topRev (5) | lowRot (10) |
|---|---|---|---|---|---|---|---|
| **B** martes calendario, sin intervals: la venta del martes 01:00 cuenta para el **martes** | `(MAR.from, MAR.to)` | `480 / 5 / 96 / 230` | `01:2:250`, `02:1:50`, `08:1:130`, `10:1:50` | `2:5:480` | `Gaseosa:5`, `Alfajor:2` | `Gaseosa:250`, `Alfajor:200` | `Sin ventas:0`, `Alfajor:2`, `Gaseosa:5` |
| **C** lunes con jornada 08→02 | `(LUN.from, LUN.to, [LUN_W])` | `500 / 4 / 125 / 240` | `01:2:250`, `08:1:200`, `23:1:50` | `1:4:500` (S4 y S5 del martes cuentan como **lunes**) | `Gaseosa:4`, `Alfajor:3` | `Alfajor:300`, `Gaseosa:200` | `Sin ventas:0`, `Alfajor:3`, `Gaseosa:4` |
| **D** lunes y martes con jornada | `(LUN_MAR.from, LUN_MAR.to, [LUN_W, MAR_W])` | `780 / 7 / 111.43 / 370` | `01:3:350`, `08:2:330`, `10:1:50`, `23:1:50` | `1:4:500`, `2:3:280` | `Gaseosa:7`, `Alfajor:4` | `Alfajor:400`, `Gaseosa:350` | `Sin ventas:0`, `Alfajor:4`, `Gaseosa:7` |
| **E** como D con los intervalos desordenados | `(…, [MAR_W, LUN_W])` | igual que D | igual que D | igual que D | igual que D | igual que D | igual que D |
| **F** franja del mismo día 09→13 | `(LUN_MAR.from, LUN_MAR.to, [LUN_W2, MAR_W2])` | `50 / 1 / 50 / 30` | `10:1:50` | `2:1:50` | `Gaseosa:1` | `Gaseosa:50` | ver nota ¹ |
| **G** franja de 24 h 08→08 | `(LUN_MAR.from, LUN_MAR.to, [LUN_W24, MAR_W24])` | `830 / 8 / 103.75 / 400` | `01:3:350`, `02:1:50`, `08:2:330`, `10:1:50`, `23:1:50` | `1:5:550`, `2:3:280` (S6 de las 02:00 entra en el lunes; S7 de las 08:00 en punto es del **martes**) | `Gaseosa:8`, `Alfajor:4` | ver nota ² | `Sin ventas:0`, `Alfajor:4`, `Gaseosa:8` |
| **H** domingo con jornada | `(DOM.from, DOM.to, [DOM_W])` | `100 / 1 / 100 / 40` | `23:1:100` | `0:1:100` (domingo = `"0"`) | `Alfajor:1` | `Alfajor:100` | ver nota ¹ |

`summary` = `totalRevenue / saleCount / averageTicket / totalProfit` → por ejemplo D es `{ totalRevenue: "780", saleCount: 7, averageTicket: "111.43", totalProfit: "370" }`.

¹ Hay empates en 0 y el orden entre empatados no está garantizado: compará la lista **ordenada** y, aparte, el último elemento. F: `assertEqual([...lowNames(rows)].sort(), ["Alfajor:0", "Gaseosa:1", "Sin ventas:0"], …)` y `assertEqual(lowNames(rows)[2], "Gaseosa:1", …)`. H: ordenada `["Alfajor:1", "Gaseosa:0", "Sin ventas:0"]` y el último `"Alfajor:1"`. (No compares objetos armados desde las filas con `assertEqual`: el JSON depende del orden de las claves.)
² Empate `Alfajor:400` / `Gaseosa:400`: `assertEqual([...topNames(rows)].sort(), ["Alfajor:400", "Gaseosa:400"], …)`.

**Caso I — validación** (`assertRejects(() => stats.getSalesSummary(LUN.from, LUN.to, <valor> as never), <texto>, "I …")`):

| `intervals` | el error incluye |
|---|---|
| `[{ from: at(19, 8, 0), to: at(19, 8, 0) }]` (from == to) | `intervals[0]` |
| `[{ from: at(20, 2, 0), to: at(19, 8, 0) }]` (from > to) | `intervals[0]` |
| `[{ from: "2026-10-19", to: at(20, 2, 0) }]` (no es Date) | `intervals[0]` |
| `"x"` (no es array) | `intervals debe ser un array` |
| 401 intervalos válidos | `hasta 400` |

  Y: 400 intervalos válidos (`Array.from({ length: 400 }, (_, i) => ({ from: new Date(2020, 0, 1 + i, 8), to: new Date(2020, 0, 2 + i, 2) }))`) **no** lanzan y dan `saleCount: 0`. También `getSalesByWeekday` con `"x"` rechaza con `intervals debe ser un array`.

**Caso J — helpers puros** (`lib = intervalsLib`):

1. `lib.buildSaleDateWhere(LUN.from, LUN.to)` y `lib.buildSaleDateWhere(LUN.from, LUN.to, [])` → `{ date: { gte: LUN.from, lte: LUN.to } }` (comparar con `assertEqual`; las fechas se serializan iguales).
2. `lib.buildSaleDateWhere(LUN.from, LUN.to, [MAR_W, LUN_W])` (desordenados a propósito) → `assertEqual` contra el objeto completo, con las claves en este orden (así lo arma la función):
   `{ date: { gte: LUN_W.from, lt: MAR_W.to }, OR: [{ date: { gte: LUN_W.from, lt: LUN_W.to } }, { date: { gte: MAR_W.from, lt: MAR_W.to } }] }`
   (rango envolvente = primer inicio → último fin; el `OR` quedó ordenado). No accedas a `where.date.gte` directo: el tipo de Prisma es una unión y TS se queja.
3. `lib.normalizeStatsIntervals(undefined)`, `(null)` y `([])` → `[]`. Con `const input = [MAR_W, LUN_W]`, `normalizeStatsIntervals(input)` → `[LUN_W, MAR_W]` y `input` sigue `[MAR_W, LUN_W]` (no muta).
4. `lib.findIntervalIndex([LUN_W, MAR_W], fecha)`: `at(19, 8, 0)` → `0` · `at(20, 1, 59)` → `0` · `at(20, 2, 0)` → `-1` · `at(20, 5, 0)` → `-1` · `at(20, 8, 0)` → `1` · `new Date(2026, 9, 21, 1, 59, 59, 999)` → `1` · `at(21, 2, 0)` → `-1` · `at(19, 7, 59)` → `-1`. Y `lib.findIntervalIndex([], at(19, 8, 0))` → `-1`.
5. `lib.MAX_STATS_INTERVALS === 400`.

**Caso K — IPC** (`api` = `buildElectronApi(call)`; mismo dataset):

| Llamada | Esperado |
|---|---|
| `api.getSalesSummary({ from: LUN.from, to: LUN.to })` | `saleCount` 3 (como hoy) |
| `api.getSalesSummary({ from: LUN.from, to: LUN.to, intervals: [LUN_W] })` | `saleCount` 4, `totalRevenue` `"500"` |
| `api.getSalesByWeekday({ from: LUN.from, to: LUN.to, intervals: [LUN_W] })` | `[{ label: "1", saleCount: 4, totalRevenue: "500" }]` |
| `api.getSalesByHour({ from: LUN.from, to: LUN.to, intervals: [LUN_W] })` | labels `["01", "08", "23"]` |
| `api.getTopProductsByQuantity({ from: LUN.from, to: LUN.to, limit: 1, intervals: [LUN_W] })` | `topNames` = `["Gaseosa:4"]` |
| `api.getTopProductsByRevenue({ from: LUN.from, to: LUN.to, limit: 5, intervals: [LUN_W] })` | `topNames` = `["Alfajor:300", "Gaseosa:200"]` |
| `api.getLowRotationProducts({ from: LUN.from, to: LUN.to, limit: 10, intervals: [LUN_W] })` | `lowNames` = `["Sin ventas:0", "Alfajor:3", "Gaseosa:4"]` |
| `call("stats:getSummary", { from: LUN.from, to: LUN.to, intervals: "x" })` | rechaza y el mensaje **empieza** con `[stats:getSummary]` |

---

## Apéndice C — Troubleshooting

- **`getByRole('tab', { name: 'Personalizado' })` encuentra 2 elementos:** usá `periodTab(...)` o `hourTab(...)` (Pasos 4.1 y 4.8).
- **`findBy…` / `waitFor` se cuelgan en `StatsHourFilter.test.tsx`:** el fake timer tiene que ser **solo de Date**: `vi.useFakeTimers({ toFake: ['Date'] })`. Con `vi.useFakeTimers()` a secas se congelan los `setTimeout` y nada avanza.
- **Las consultas se repiten sin parar:** alguna dependencia de `useMemo`/`useEffect` es un objeto nuevo en cada render. Usá los primitivos `winStart`/`winEnd`/`hourReady` como en el Paso 4.5 (nunca `hourState` ni `currentWindow` como dependencia).
- **`noUnusedLocals` en `Stats.tsx`:** quitá `getPeriodDates` del import (ahora se usa `getPeriodDatesAt`).
- **TS se queja de `sale: saleWhere` en `prisma.saleItem.*`:** se verificó que compila con Prisma 5.22; si igual falla, usá `sale: { is: saleWhere }` (mismo significado).
- **El test de backend deja `backend/prisma/test-stats-repository.*.db`:** faltó `await prisma.$disconnect()` antes de `testDb.cleanup()` (en Windows el archivo abierto da `EBUSY`), o el proceso murió antes del `finally`. Borralo a mano.
- **`ts-node` no encuentra `../../electron/ipcHandlers`:** la ruta es relativa a `backend/__tests__/` (dos niveles hasta la raíz).
- **Un valor esperado del Apéndice B no coincide:** primero revisá el seed (fecha, cantidad, `purchasePriceSnapshot`) contra B.1. No ajustes el repositorio para que "dé" el número.
- **Conflicto al mergear con la rama del otro agente:** en `package.json` (línea `test:backend`) o `app.css`, conservá **ambos** cambios.
- **Lint marca errores en `SalesHistory` o `Sells`:** son los 7 preexistentes de la sección 1.7; no se tocan.

---

# Plan — Formulario de producto: picker sin desborde, modal sin scroll, scrollbars estilizadas y precio con margen

> **Worktree:** `C:\Users\asant\Music\Integral\wt-producto` · **rama:** `fix/producto-form` · **fecha:** 2026-10-25
>
> **Para quién es:** un modelo de IA que ejecuta paso a paso. Seguí las fases **en orden**. Cada paso es chico a propósito:
> hacelo, corré su **Checkpoint**, y recién ahí seguí. No improvises: lo que no está acá, no se hace.

---

## 0. Reglas para el ejecutor (leer antes de tocar nada)

1. Trabajás **solo** en `C:\Users\asant\Music\Integral\wt-producto`. **No** leas ni escribas en `C:\Users\asant\Music\Integral\Integral` ni en `C:\Users\asant\Music\Integral\wt-stats` (otro agente trabaja ahí). `node_modules` y `renderer/node_modules` son *junctions* al repo principal: no los toques.
2. **No** hagas commits, push, ramas ni stash.
3. Comandos: usá la herramienta **Bash** (Git Bash) con rutas absolutas, siempre con este formato:
   `cd /c/Users/asant/Music/Integral/wt-producto/renderer && <comando>`. No uses PowerShell para encadenar (en PowerShell 5.1 no existe `&&`).
4. **Prohibido editar:** `renderer/src/styles/bundle.css`, `renderer/src/styles/tokens.css`, todo `design-system/`, `backend/`, `electron/`, `renderer/src/electron-api.d.ts`, schema/migraciones. **No hay cambios de DB ni de IPC.**
5. Colores: solo `var(--token)` de tokens que ya existen en `tokens.css`. Ningún `#hex`, `rgb()`, `hsl()` nuevo. **Nada de `::-webkit-scrollbar`.**
6. TypeScript del renderer: `verbatimModuleSyntax` → los tipos se importan con `import type { … }`; `noUnusedLocals`/`noUnusedParameters` → borrá todo import o variable que deje de usarse; `erasableSyntaxOnly` → nada de `enum` (usá uniones de literales).
7. No cambies textos existentes (mensajes de error, labels, ayudas) salvo los que este plan indica. No cambies `FIELD_ORDER` de `validateProductForm.ts`.
8. No modifiques expectativas de tests existentes. Solo se **agregan** tests (y un `localStorage.clear()` en un `beforeEach`, indicado en G5).
9. Los tests corren en **happy-dom** (no jsdom): no hay layout ni se carga CSS. Lo visual se verifica a mano en el Paso H3 (lo hace una persona).
10. Si un Checkpoint falla: leé el error, corregí **tu** cambio y volvé a correr. No sigas con un checkpoint en rojo.
11. Para simular un `localStorage` roto en tests usá **solo** `vi.stubGlobal('localStorage', …)` + `vi.unstubAllGlobals()`. **Nunca** `vi.spyOn(Storage.prototype, …)`: en happy-dom 20.9 no intercepta de forma confiable y el mock puede quedar pegado a los tests siguientes (detalle en A4).

### Línea base (medida al planificar; confirmala en el Paso 0.2)

| Comando | Resultado esperado hoy |
|---|---|
| `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run` | 66 archivos, 850 tests, 0 fallidos (~55 s) |
| `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` | OK (sin errores) |
| `cd /c/Users/asant/Music/Integral/wt-producto && npm run lint --workspace renderer` | **Falla con 7 errores PREEXISTENTES** (no los arregles, son de otras pantallas): `src/Pages/SalesHistory/__tests__/salesHistoryFilters.test.ts` 16:37 `no-explicit-any` · `src/Pages/SalesHistory/cajaUtils.ts` 65:39 `no-prototype-builtins` · `src/Pages/Sells/__tests__/confirmSaleItems.test.ts` 5 × `no-explicit-any` |
| El aviso `Warning: React version not specified in eslint-plugin-react settings` | Es de configuración, se ignora |

---

## 1. Supuestos y preguntas abiertas

Todo el plan está escrito con la **recomendación** de cada fila. Si el usuario responde distinto, se ajusta solo lo indicado en "Impacto".

> **RESPUESTAS DEL USUARIO (definitivas, ya aplicadas en todo el plan):** P1 sí · **P2 CAMBIA: activado · 30 % · redondeo $ 100** · P3 recargo sobre costo · P4 0–1000 % · P5 sube a un paso · **P6 CAMBIA: el precio de venta NUNCA es de solo lectura; tipear en él con el cálculo activo apaga el cálculo SOLO para ese producto (no guarda la preferencia)** · P7, P8, P9 como dice la tabla. Donde el plan diga otra cosa sobre P2/P6, manda esta nota.

| # | Pregunta | Decisión tomada (recomendación) | Impacto si cambia |
|---|---|---|---|
| P1 | Si en un **alta** destildo "Calcular con margen" para cargar un precio a mano, ¿el próximo alta arranca destildado? | **Sí**: el estado del checkbox se recuerda en el momento en que se toca, **solo en modo alta** (en edición siempre arranca apagado y tocarlo no cambia la preferencia). Es lo que pide "en creación arranca según la preferencia recordada". | Si se quiere "apagado solo para ese producto": en `handleAutoPriceChange` guardar solo cuando `next === true`, y ajustar el test G6-T13. |
| P2 | Valores por defecto cuando no hay nada guardado. | **(Respondido) Activado · margen 30 % · redondeo $ 100.** `DEFAULT_PRICING_PREFS = { enabled: true, marginPct: 30, roundingStep: 100 }`. | Ya aplicado en A4, G4, G5, G6. |
| P3 | ¿Qué es "margen"? | **Recargo sobre el costo**: `venta = costo × (1 + margen/100)`. Es la misma definición que ya usa la ayuda "Margen: 44,8 % · ganancia…" del formulario. | Margen sobre el precio de venta (`costo / (1 − m/100)`) cambia la fórmula y toda la tabla de A2. No recomendado. |
| P4 | Rango del margen. | **0 a 1000 %**, hasta 2 decimales, coma o punto. Un valor inválido o fuera de rango no se aplica y, al salir del campo, vuelve el último válido (mismo patrón que el descuento del carrito). | Cambiar `MARGIN_MAX` y sus tests. |
| P5 | Si el redondeo "al más cercano" deja en $ 0 un producto que cuesta algo (costo 30, margen 30 % → 39 → con paso 100 da 0). | **Sube a un paso** (queda $ 100). Nunca se genera un precio $ 0 para algo con costo > 0 (Ventas rechaza productos con precio 0). Si el redondeo deja el precio por debajo del costo, se muestra el aviso existente "Estás vendiendo por debajo del costo." (no bloquea). | Si se prefiere $ 0 o un aviso, cambiar la línea marcada en `computeSalePrice` y los casos "Nunca $ 0" de A2. |
| P6 | ¿Se puede tipear el precio de venta con el cálculo activo? | **(Respondido) Sí: tipear apaga el cálculo solo para ese producto.** El campo nunca es `readOnly`. Si el cálculo está activo y el usuario tipea en "Precio de venta", `autoPrice` pasa a `false` **sin** llamar a `savePricingPrefs` (el próximo alta sigue arrancando según la preferencia) y el valor tipeado queda. | Ya aplicado en G4 y G6 (T1, T2, T9, T10). |
| P7 | Desvío del DS: el DS define el modal de producto de 640 px con 2 columnas. | **1080 px y grilla de 4 columnas**, para que entre sin scroll a 1280×720 (el usuario pidió "que el pop up se agrande"). El error "No se pudo guardar el producto. Probá de nuevo." pasa del cuerpo al pie (al lado de los botones) para no agrandar el modal. | Cambiar `.ig-modal.pf-modal` y el layout (Fase F). |
| P8 | Scrollbars. | **Finas (`scrollbar-width: thin`)** en toda la app, pulgar `var(--border-control)` y riel transparente. Además `color-scheme` sigue al tema (la flecha y la lista de los `<select>` y el checkbox se ven bien en oscuro; también mejora el select de Historial). | Si se prefieren de ancho normal: `scrollbar-width: auto`. |
| P9 | Teclado en el picker. | Nuevo: **`Tab` en la lista del picker cierra el popover** y el foco sigue al campo siguiente (igual que el menú ⋮). Dentro del alta (Nombre/Teléfono/Notas) `Tab` sigue recorriendo esos campos. | Quitar el `if` de `Tab` en `onPopoverKeyDown` y los tests C2-E7/E8. |

Supuesto de medidas: con la ventana en su mínimo (1280×720, medida exterior), el área visible del renderer queda en ≈ 1264–1278 × 680–688 px (barra de título de Windows). El layout se diseñó para **680 px de alto** con margen de sobra (ver 3.2).

---

## 2. Diagnóstico (causa raíz)

1. **Scroll horizontal al abrir Proveedor:** el popover `.ig-picker-pop` mide **420 px fijos** (`bundle.css` línea 83) y es `position: absolute` dentro de `.ig-modal-body`, que tiene `overflow: auto` (`bundle.css` línea 165). El modal mide 640 px (contenido 592 px, columnas de 288 px); Proveedor está en la columna derecha (empieza en x≈328) → el popover termina en x≈748 > 616 → el cuerpo genera scroll horizontal. Además, `.ig-modal { max-height: 84vh; overflow: hidden }` recorta lo que sobresale hacia abajo.
2. **Scroll vertical del modal:** a 1280×720 el modal puede medir como máximo 84vh ≈ 575 px, pero el formulario actual en alta con vencimiento mide ≈ 767 px (cabecera 90 + cuerpo 604 + pie 73).
3. **Scrollbars sin estilo:** no hay ninguna regla de scrollbar en `app.css` ni en `bundle.css` (se ven las nativas de Windows).
4. **Precio con margen:** no existe; hoy solo se muestra el margen resultante debajo de "Precio de venta" (`marginInfo` en `validateProductForm.ts`).

---

## 3. Solución elegida

### 3.1 Picker: popover flotante con `position: fixed` (sin portal)

- `EntityPicker` calcula la posición del popover con una función pura nueva, `computeFloatingPlacement` (`renderer/src/ui/floatingPlacement.ts`), a partir del `getBoundingClientRect()` del botón disparador y del tamaño de la ventana, y se la pone **en línea**: `position: fixed; top|bottom; left; width; max-height`.
- Un elemento `position: fixed` (sin ancestros con `transform`/`filter`/`contain`) se posiciona respecto de la ventana: **no lo recorta** el `overflow` del cuerpo del modal ni del modal, y **no suma** al área scrolleable de sus ancestros → desaparece el scroll horizontal y nunca se corta abajo. El popover puede salir por encima y afuera del modal si hace falta (lo que pidió el usuario).
- **No se usa portal**: el popover sigue en el mismo lugar del DOM (dentro del picker, dentro del diálogo). Por eso, sin tocar nada más, siguen funcionando: el focus trap de `ui/Modal.tsx` (busca los focusables dentro del diálogo), el "click afuera" del `EntityPicker` (`wrapperRef.contains`), el `modalStack`, y el `stopPropagation` de Enter/Esc (los eventos de React suben por el árbol de componentes).
- Reglas de posición: ancho = máx(ancho del disparador, 420 px) sin pasar el ancho de la ventana − 16; alineado al borde izquierdo del disparador, o al derecho si no entra; abre **abajo** si hay ≥ 360 px o si abajo hay más lugar que arriba; si no, **arriba**; `max-height` = lugar disponible en ese lado (la lista se achica y scrollea). Se recalcula con `resize` y con el `scroll` de cualquier contenedor (escucha en captura), salvo el scroll de la propia lista.
- **Descartado:** portal a `document.body` (rompe el focus trap y el click afuera, y el popover quedaría debajo del velo: `--z-popover` 40 < `--z-modal` 50); Popover API / CSS anchor positioning (happy-dom no los implementa → no se podrían testear, y son más difíciles de depurar para el ejecutor).
- Riesgo conocido y aceptado: durante los 160 ms de la animación de entrada del modal (`ig-rise` usa `transform`) un `fixed` quedaría relativo al modal. Abrir un picker en ese lapso no es posible en la práctica.

### 3.2 Modal de producto sin scroll a 1280×720

- `Modal` acepta una prop nueva `className` (se suma a `.ig-modal`). `ProductFormModal` usa `className="pf-modal"`.
- `.ig-modal.pf-modal`: `width: 1080px`, `max-width: calc(100vw - 48px)`, `max-height: calc(100vh - 32px)`; el velo de ese modal usa `padding-top: 16px` (selector `:has`). El cuerpo **mantiene** `overflow: auto` del DS solo como red de seguridad.
- Grilla nueva `.pf-grid` de **4 columnas** (≈ 246 px cada una, separación 16 px). Orden (= orden visual = orden de Tab = mismo orden relativo que el DS):

```
┌──────────────────────────── Nuevo producto ─────────────────────────────── X ┐
│ Los campos con * son obligatorios.                                           │
│ Nombre * ─────────────────────────────── │ Categoría *      │ Proveedor *      │  fila 1
│ Precio de compra * │ ☑ Calcular con margen │ Redondeo       │ Precio de venta *│  fila 2
│ [$     1.234,00]   │ [        30 %]        │ [$ 100     ▾]  │ [$   1.600,00]   │
│                    │ Sobre el precio de…   │ Al más cercano.│ Margen: 29,7 % · │
│ Código de barras ──────────────────────── │ Stock inicial    │ Stock mínimo     │  fila 3
│                                          │ Vencimiento del lote (si stock > 0) │  fila 4 (solo alta)
├──────────────────────────────────────────────────────────────────────────────┤
│ Esc Cancelar  Ctrl+Enter Guardar        [error de guardado] Cancelar  Guardar │
└──────────────────────────────────────────────────────────────────────────────┘
```

- En edición, la fila 3 tiene "Stock" de solo lectura en lugar de "Stock inicial", y no hay fila 4.
- **Presupuesto de alto** (campo = label 18 + 6 + control 40 = 64 px; con ayuda o error de 1 línea = 88; de 2 líneas = 106):

| Parte | Alto (px) |
|---|---|
| Cabecera (título + bajada) | 90 |
| Fila 1 (sin ayudas; con errores) | 64 → 88 |
| Fila 2 (la ayuda del precio de venta o un error largo ocupa 2 líneas) | 88 → 106 |
| Fila 3 (error de código duplicado o de stock en 2 líneas) | 88 → 106 |
| Fila 4 (vencimiento, solo alta con stock inicial > 0) | 88 |
| 3 separaciones de 16 + padding inferior del cuerpo 24 | 72 |
| Pie | 73 |
| **Peor caso total** | **623** |
| Disponible con ventana mínima (680 − 32) | **648** (sobran ≥ 25) |

### 3.3 Scrollbars de toda la app

- En `:root`: `scrollbar-width: thin; scrollbar-color: var(--border-control) transparent;`. Son propiedades **heredadas**, así que aplican a todos los contenedores con scroll (tablas, carrito, historial, popups, lista del picker…), en claro y oscuro (`--border-control` tiene contraste ≥ 3:1 en ambos temas según el DS).
- Chromium (Electron 40 ≈ Chromium 144) soporta estas propiedades estándar desde la v121 y, cuando están seteadas, **ignora `::-webkit-scrollbar`**: no se mezclan.
- `color-scheme: light` / `dark` según `data-theme`, para que los controles nativos (flecha y lista del `<select>`, checkbox) acompañen el tema.

### 3.4 Precio con margen: reglas de comportamiento

| Situación | Qué pasa |
|---|---|
| Fórmula | `venta = redondear(costo × (1 + margen/100), paso)`, calculado en **centavos enteros** (sin errores de punto flotante). |
| Redondeo | Al múltiplo de `paso` **más cercano**; la mitad exacta **sube** (paso 100: 1570→1600, 1530→1500, 1550→1600). Pasos: Sin redondeo · $ 10 · $ 50 · $ 100 · $ 500 · $ 1.000. |
| "Sin redondeo" | Precio al centavo (2 decimales, la mitad sube): 1234,56 × 1,30 = 1604,928 → **1.604,93**. |
| Redondeo daría $ 0 con costo > 0 | Queda **un paso** (ver P5). |
| Preferencias | Globales en `localStorage`, clave **`integral.pricing`**, JSON `{"enabled":true,"marginPct":30,"roundingStep":100}` (`enabled` booleano; `marginPct` número de 0 a 1000; `roundingStep` uno de 0, 10, 50, 100, 500 o 1000). Default `{ enabled: true, marginPct: 30, roundingStep: 100 }`. JSON corrupto / campo inválido / storage que tira error → default de ese campo, sin romper. |
| Cuándo se guardan | **Margen:** cada vez que el texto del campo es un margen válido (en alta y en edición). **Redondeo:** al elegir una opción (alta y edición). **Activado:** al tildar/destildar, **solo en alta**. Nada depende de guardar o cancelar el producto. |
| Al abrir **alta** | El checkbox arranca según la preferencia `enabled`; margen y redondeo con los valores recordados. |
| Al abrir **edición** | El checkbox arranca **apagado** siempre (no pisa el precio guardado); margen y redondeo muestran los recordados (deshabilitados). |
| Cálculo **activo** | "Precio de venta" **editable** con el valor calculado (tipear en él apaga el cálculo solo para este producto, sin guardar la preferencia, y deja lo tipeado); se recalcula al cambiar el costo (en vivo), el margen (en vivo, si el texto es válido) o el redondeo. Tildar recalcula en el momento con el costo actual. |
| Cálculo **apagado** | Margen (%) y Redondeo **deshabilitados** (Tab los saltea). "Precio de venta" editable como hoy. Destildar **deja** el último valor calculado. |
| Costo vacío o inválido (cálculo activo) | Precio de venta vacío y ayuda: **"Completá el precio de compra para calcularlo."** Al guardar aparecen los errores de siempre. |
| Costo 0 (cálculo activo) | Precio de venta "0,00" (sin ayuda, como hoy cuando el costo es 0). |
| Ayuda bajo "Precio de venta" | Igual que hoy: "Margen: X % · ganancia $ Y por unidad" (margen **real** después de redondear) o "Estás vendiendo por debajo del costo." |
| Margen inválido (texto) | No recalcula; al salir del campo (blur o Enter) el input muestra el último margen válido. |
| Teclado | Tab: Precio de compra → Calcular con margen → Margen (%) → Redondeo → Precio de venta (los dos del medio solo si el cálculo está activo). Espacio tilda/destilda. Enter en Margen normaliza el texto (no guarda). `Ctrl+Enter` guarda desde cualquier campo, como hoy. |

---

## 4. Contratos (100 % explícitos — no cambiar nombres)

### 4.1 Archivos nuevos

| Archivo | Contenido |
|---|---|
| `renderer/src/utils/pricing.ts` | Tipos, constantes, cálculo y preferencias (código completo en A1, A3 y A4) |
| `renderer/src/utils/__tests__/pricing.test.ts` | Tests de `pricing.ts` |
| `renderer/src/ui/floatingPlacement.ts` | `computeFloatingPlacement` (código completo en B1) |
| `renderer/src/ui/__tests__/floatingPlacement.test.ts` | Tests de la posición |

### 4.2 API de `renderer/src/utils/pricing.ts`

```ts
export type RoundingStep = 0 | 10 | 50 | 100 | 500 | 1000
export const ROUNDING_STEPS: readonly RoundingStep[]            // [0, 10, 50, 100, 500, 1000]
export const MARGIN_MIN = 0
export const MARGIN_MAX = 1000
export type PricingPrefs = { enabled: boolean; marginPct: number; roundingStep: RoundingStep }
export const DEFAULT_PRICING_PREFS: PricingPrefs                // { enabled: true, marginPct: 30, roundingStep: 100 }
export const PRICING_STORAGE_KEY = 'integral.pricing'
export function isValidMarginPct(n: number): boolean
export function toRoundingStep(value: unknown): RoundingStep | null
export function computeSalePrice(cost: number, marginPct: number, step: RoundingStep): number | null
export function parseMarginInput(text: string): number | null
export function formatMarginInput(n: number): string
export function roundingStepLabel(step: RoundingStep): string
export function autoSalePriceText(purchaseText: string, marginPct: number, step: RoundingStep): string
export function loadPricingPrefs(): PricingPrefs
export function savePricingPrefs(partial: Partial<PricingPrefs>): void
```

### 4.3 API de `renderer/src/ui/floatingPlacement.ts`

```ts
export type AnchorRect = { top: number; bottom: number; left: number; right: number; width: number }
export type Viewport = { width: number; height: number }
export type FloatingPlacement = {
  side: 'below' | 'above'
  top: number | 'auto'
  bottom: number | 'auto'
  left: number
  width: number
  maxHeight: number
}
export const FLOATING_GAP = 4
export const FLOATING_MARGIN = 8
export const FLOATING_MIN_WIDTH = 420
export const FLOATING_PREFERRED_HEIGHT = 360
export function computeFloatingPlacement(anchor: AnchorRect, viewport: Viewport, minWidth?: number): FloatingPlacement
```

### 4.4 Cambios de API existentes

- `ui/Modal.tsx`: prop nueva opcional `className?: string` (se agrega a las clases de `.ig-modal`). Nada más cambia.
- `ui/EntityPicker.tsx`: **sin cambios de props**. Cambia el popover (flotante) y se agrega `Tab` en modo lista.

### 4.5 Clases CSS nuevas (todas en `app.css`, dentro del bloque delimitado)

| Clase | Dónde | Para qué |
|---|---|---|
| `.ig-picker-pop.is-floating` | popover de `EntityPicker` | columna flex que se achica con `max-height` |
| `.pf-modal` | diálogo de `ProductFormModal` (vía `Modal className`) | 1080 px, alto máximo de ventana − 32 |
| `.pf-grid` | grilla del formulario | 4 columnas |
| `.span-2` (dentro de `.pf-grid`) | Nombre y Código de barras | ocupa 2 columnas |
| `.pf-expiry` | `DateField` del vencimiento | columnas 3–4 y input de 220 px |
| `.pf-auto` | `<label>` del checkbox "Calcular con margen" | label con checkbox |
| `.pf-margin-input` | input del margen | deja lugar al sufijo `%` |

### 4.6 Textos nuevos (copiar tal cual)

| Elemento | Texto |
|---|---|
| Checkbox | `Calcular con margen` |
| `aria-label` del input del margen | `Margen (%)` |
| Ayuda del margen | `Sobre el precio de compra.` |
| Label del selector | `Redondeo` |
| Ayuda del selector | `Al más cercano.` |
| Opciones del selector | `Sin redondeo` · `$ 10` · `$ 50` · `$ 100` · `$ 500` · `$ 1.000` |
| Ayuda del precio de venta sin costo (cálculo activo) | `Completá el precio de compra para calcularlo.` |
| Error de guardado (se mueve al pie, mismo texto) | `No se pudo guardar el producto. Probá de nuevo.` |

### 4.7 Ids nuevos en el formulario

`pf-auto-price` (checkbox) · `pf-margin` (input margen; ayuda `pf-margin-help`) · `pf-rounding` (select; ayuda `pf-rounding-help`). Los ids existentes (`pf-name`, `pf-category`, `pf-supplier`, `pf-purchase`, `pf-sale`, `pf-barcode`, `pf-stock`, `pf-minstock`, `pf-expiry`) **no cambian**.

---

## 5. Pasos

> **Validado al planificar:** las fases C, D, F y G se ejecutaron tal cual están escritas sobre una **copia** del renderer (fuera del worktree): los fragmentos compilan con el `tsconfig` estricto, ESLint no marca errores en los archivos tocados, los tests E1–E8, L1–L5 y T1–T19 pasan con los valores esperados y la suite completa queda en verde. Las tablas de A2–A4 y B2 también se corrieron contra el código de A1/A3/A4/B1, y el bloque CSS de E1 se validó con un parser. Seguí el texto **literalmente**: si algo no coincide con lo que ves en el archivo, pará y avisá en vez de improvisar.

### Mapa de cambios por archivo

| Archivo | Fase |
|---|---|
| `renderer/src/utils/pricing.ts` (nuevo) + test | A |
| `renderer/src/ui/floatingPlacement.ts` (nuevo) + test | B |
| `renderer/src/ui/EntityPicker.tsx` + `ui/__tests__/EntityPicker.test.tsx` | C |
| `renderer/src/ui/Modal.tsx` + `ui/__tests__/Modal.test.tsx` | D |
| `renderer/src/styles/app.css` (bloque nuevo al final) | E |
| `renderer/src/Pages/Stock/ProductFormModal.tsx` + `Pages/Stock/__tests__/ProductFormModal.test.tsx` | F y G |
| `CLAUDE.md` (subsección nueva) | H |

---

### Fase 0 — Preparación

**Paso 0.1 — Confirmar dónde estás.**
- Comando: `cd /c/Users/asant/Music/Integral/wt-producto && git branch --show-current && git status --short`
- Esperado: `fix/producto-form` y, como mucho, ` M plan.md`. Si la rama es otra o hay otros cambios, **pará** y avisá.

**Paso 0.2 — Línea base.** Corré los tres comandos de la tabla "Línea base" (sección 0) y anotá los resultados. Si algo difiere (más errores de lint, tests rojos), **pará** y avisá antes de cambiar código.

**Paso 0.3 — Leer el código que vas a tocar** (sin modificar): `renderer/src/ui/EntityPicker.tsx`, `renderer/src/ui/Modal.tsx`, `renderer/src/Pages/Stock/ProductFormModal.tsx`, `renderer/src/Pages/Stock/validateProductForm.ts`, `renderer/src/utils/parse.ts`, `renderer/src/utils/format.ts`, `renderer/src/utils/theme.ts`, `renderer/src/styles/app.css`, `renderer/src/styles/bundle.css` (líneas 47–93 y 156–167), y los tests `renderer/src/ui/__tests__/EntityPicker.test.tsx`, `renderer/src/ui/__tests__/Modal.test.tsx`, `renderer/src/Pages/Stock/__tests__/ProductFormModal.test.tsx`, `renderer/src/utils/__tests__/theme.test.ts` (de este último **no** copies el `vi.spyOn(Storage.prototype, …)`: ver regla 11).

---

### Fase A — `utils/pricing.ts` (funciones puras, con tests primero)

**Paso A1 — Crear `renderer/src/utils/pricing.ts` con tipos, constantes y `computeSalePrice`.**

Contenido (copiar; los comentarios en español son parte del entregable):

```ts
/**
 * Precio de venta calculado con margen y redondeo, y las preferencias de ese cálculo.
 *
 * - `computeSalePrice`: venta = redondear(costo × (1 + margen / 100), paso), en centavos enteros.
 * - Las preferencias (activado, margen, redondeo) se recuerdan en localStorage (`integral.pricing`).
 *   Leer o guardar nunca lanza: sin storage o con datos corruptos se usan los valores por defecto.
 */

/** Paso de redondeo en pesos. 0 = sin redondeo (precio al centavo). */
export type RoundingStep = 0 | 10 | 50 | 100 | 500 | 1000

/** Pasos ofrecidos, en el orden del selector "Redondeo". */
export const ROUNDING_STEPS: readonly RoundingStep[] = [0, 10, 50, 100, 500, 1000]

/** Rango válido del margen (%), extremos incluidos. */
export const MARGIN_MIN = 0
export const MARGIN_MAX = 1000

export type PricingPrefs = {
  /** "Calcular con margen" tildado al abrir el alta de producto. */
  enabled: boolean
  /** Recargo sobre el costo, en % (0–1000, hasta 2 decimales). */
  marginPct: number
  roundingStep: RoundingStep
}

export const DEFAULT_PRICING_PREFS: PricingPrefs = { enabled: true, marginPct: 30, roundingStep: 100 }

/** Clave de localStorage (mismo prefijo que `integral.theme`). */
export const PRICING_STORAGE_KEY = 'integral.pricing'

/**
 * x × 100 como entero, sin el ruido binario de los decimales (la mitad exacta sube):
 * 1.005 → 101 (no 100), 0.1 + 0.2 → 30, 12.345 → 1235.
 */
function toHundredths(x: number): number {
  return Math.round(Number((x * 100).toPrecision(15)))
}

/** true si `n` es un margen aceptado: número finito entre 0 y 1000 (inclusive). */
export function isValidMarginPct(n: number): boolean {
  return Number.isFinite(n) && n >= MARGIN_MIN && n <= MARGIN_MAX
}

/** Devuelve el valor como `RoundingStep` si es uno de los pasos ofrecidos; si no, null. */
export function toRoundingStep(value: unknown): RoundingStep | null {
  return typeof value === 'number' && (ROUNDING_STEPS as readonly number[]).includes(value) ? (value as RoundingStep) : null
}

/**
 * Precio de venta = redondear(costo × (1 + margen / 100), paso).
 *
 * - Trabaja en centavos enteros: no hay errores de punto flotante.
 * - Redondea al múltiplo de `step` MÁS CERCANO; la mitad exacta sube (paso 100: 1550 → 1600).
 * - `step` 0 = sin redondeo: el resultado queda al centavo (2 decimales, la mitad sube).
 * - Si el costo (en centavos) es > 0 y el redondeo daría $ 0, devuelve un paso: nunca un precio 0
 *   para algo que tiene costo.
 * - null si el costo no es un número finito ≥ 0, si el margen está fuera de [0, 1000] o si el paso
 *   no es uno de `ROUNDING_STEPS`.
 */
export function computeSalePrice(cost: number, marginPct: number, step: RoundingStep): number | null {
  if (!Number.isFinite(cost) || cost < 0) return null
  if (!isValidMarginPct(marginPct)) return null
  if (toRoundingStep(step) === null) return null
  const costCents = Math.abs(toHundredths(cost)) // Math.abs: -0 → 0
  const marginBasisPoints = toHundredths(marginPct) // 30 % → 3000
  const rawCents = Math.round((costCents * (10000 + marginBasisPoints)) / 10000)
  if (step === 0) return rawCents / 100
  const stepCents = step * 100
  let roundedCents = Math.round(rawCents / stepCents) * stepCents
  if (roundedCents === 0 && rawCents > 0) roundedCents = stepCents // nunca $ 0 para algo que cuesta (P5)
  return roundedCents / 100
}
```

> En A1 el archivo **no importa nada** y no tiene `roundMargin`: los imports de `./format`/`./parse` y la función `roundMargin` se agregan en A3, cuando se usan (si los agregás antes, `noUnusedLocals` y ESLint se quejan).

**Paso A2 — Crear `renderer/src/utils/__tests__/pricing.test.ts` con la tabla de `computeSalePrice`.**

Encabezado del archivo **en este paso** (solo lo que ya existe):

```ts
import { describe, expect, it } from 'vitest'
import { computeSalePrice } from '../pricing'
import type { RoundingStep } from '../pricing'
```

En A3 y A4 ampliás estos imports a medida que creás funciones. Al final de A4 el archivo importa `afterEach, beforeEach, describe, expect, it, vi` de `vitest` y, de `../pricing`: `DEFAULT_PRICING_PREFS, PRICING_STORAGE_KEY, ROUNDING_STEPS, autoSalePriceText, computeSalePrice, formatMarginInput, isValidMarginPct, loadPricingPrefs, parseMarginInput, roundingStepLabel, savePricingPrefs, toRoundingStep`, más `import type { RoundingStep }`. Nunca importes algo que todavía no existe.

`describe('computeSalePrice')` con un `it.each` sobre esta tabla (todos los valores verificados numéricamente al planificar; `toBe` exacto):

```ts
const CASES: [number, number, RoundingStep, number | null][] = [
  // costo, margen %, paso, esperado
  [1000, 30, 0, 1300],
  [1234.56, 30, 0, 1604.93], // 1604,928 → al centavo
  [1234, 30, 0, 1604.2],
  [1650, 45, 0, 2392.5],
  [1000, 33.33, 0, 1333.3],
  [1000, 12.345, 0, 1123.5], // el margen se redondea a 2 decimales (12,35 %)
  [1000, 0, 0, 1000],
  [1000, 1000, 0, 11000], // margen máximo
  // Ejemplos del usuario: paso 100, al más cercano, la mitad sube
  [1570, 0, 100, 1600],
  [1530, 0, 100, 1500],
  [1550, 0, 100, 1600],
  [1549.99, 0, 100, 1500],
  // El mismo precio crudo (1604,20) con todos los pasos
  [1234, 30, 10, 1600],
  [1234, 30, 50, 1600],
  [1234, 30, 100, 1600],
  [1234, 30, 500, 1500],
  [1234, 30, 1000, 2000],
  [1650, 45, 100, 2400],
  // Mitades exactas con otros pasos
  [1000, 25, 500, 1500], // 1250 → 1500
  [2475, 0, 50, 2500],
  [2490, 0, 50, 2500],
  [2474.99, 0, 50, 2450],
  [5, 0, 10, 10],
  [1500, 0, 1000, 2000],
  [1499.99, 0, 1000, 1000],
  [1999.99, 0, 1000, 2000],
  // Nunca $ 0 para algo que cuesta: sube a un paso
  [30, 30, 100, 100], // 39 → 0 → 100
  [4, 0, 10, 10],
  [0.01, 0, 1000, 1000],
  [0.1, 0, 10, 10],
  // Costo 0
  [0, 30, 0, 0],
  [0, 30, 100, 0],
  [-0, 30, 0, 0],
  // Punto flotante
  [0.1 + 0.2, 0, 0, 0.3],
  [0.1 + 0.2, 100, 0, 0.6],
  [1.005, 0, 0, 1.01],
  [2.675, 0, 0, 2.68],
  [10.235, 0, 0, 10.24],
  [0.05, 50, 0, 0.08], // 7,5 centavos → 8
  [1.45, 10, 0, 1.6], // 159,5 centavos → 160
  [0.005, 0, 0, 0.01],
  [0.004, 0, 0, 0],
  // Números grandes
  [99999999.99, 1000, 0, 1099999999.89],
  [9999999.99, 30, 1000, 13000000],
  // Inválidos → null
  [-1, 30, 0, null],
  [Number.NaN, 30, 0, null],
  [Number.POSITIVE_INFINITY, 30, 0, null],
  [1000, -1, 0, null],
  [1000, 1000.01, 0, null],
  [1000, Number.NaN, 0, null],
]
it.each(CASES)('computeSalePrice(%s, %s, %s) → %s', (cost, margin, step, expected) => {
  expect(computeSalePrice(cost, margin, step)).toBe(expected)
})
```

Más un `it` aparte: `computeSalePrice(1000, 30, 20 as RoundingStep)` → `null` (paso no ofrecido).

- **Checkpoint A2:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/utils/__tests__/pricing.test.ts` → todo verde.

**Paso A3 — Agregar a `pricing.ts` los helpers de texto y sus tests.**

1. Arriba de todo en `pricing.ts` (debajo del comentario inicial) agregá:

```ts
import { formatAmountInput, formatInt } from './format'
import { parseDecimal } from './parse'
```

2. Debajo de `toHundredths` agregá:

```ts
/** Margen redondeado a 2 decimales (el `Math.abs` convierte un -0 en 0). */
function roundMargin(n: number): number {
  return Math.abs(toHundredths(n)) / 100
}
```

3. Código a agregar (debajo de `computeSalePrice`):

```ts
/** Texto tipeado en "Margen" → número (2 decimales); null si está vacío, es inválido o está fuera de 0–1000. Acepta "%", coma o punto. */
export function parseMarginInput(text: string): number | null {
  const n = parseDecimal(text.replace(/%/g, ''))
  if (n === null || !isValidMarginPct(n)) return null
  return roundMargin(n)
}

/** Margen → texto del input, sin separador de miles: 30 → "30", 32.5 → "32,5", 12.345 → "12,35". */
export function formatMarginInput(n: number): string {
  return String(roundMargin(n)).replace('.', ',')
}

/** Texto de cada opción del selector "Redondeo": 0 → "Sin redondeo", 1000 → "$ 1.000". */
export function roundingStepLabel(step: RoundingStep): string {
  return step === 0 ? 'Sin redondeo' : `$ ${formatInt(step)}`
}

/** Precio de venta calculado como texto de input ("1.600,00"); '' si el costo no es un número ≥ 0. */
export function autoSalePriceText(purchaseText: string, marginPct: number, step: RoundingStep): string {
  const cost = parseDecimal(purchaseText)
  if (cost === null) return ''
  const sale = computeSalePrice(cost, marginPct, step)
  return sale === null ? '' : formatAmountInput(sale)
}
```

Tests a agregar (cada bloque con `it.each`, `toBe`):

- `describe('isValidMarginPct')`: `0`→true · `1000`→true · `30.5`→true · `-0.01`→false · `1000.01`→false · `NaN`→false · `Infinity`→false.
- `describe('toRoundingStep')`: `0`→0 · `10`→10 · `50`→50 · `100`→100 · `500`→500 · `1000`→1000 · `20`→null · `'100'`→null · `null`→null · `undefined`→null · `NaN`→null. Más: `expect(ROUNDING_STEPS).toEqual([0, 10, 50, 100, 500, 1000])`.
- `describe('parseMarginInput')`:

```ts
[
  ['30', 30], ['30,5', 30.5], ['30.5', 30.5], [' 45 ', 45], ['45%', 45], ['45 %', 45],
  ['0', 0], ['-0', 0], ['1000', 1000], ['1.000', 1000], ['12,345', 12.35], ['0,1', 0.1], ['99,999', 100],
  ['1000,01', null], ['1.001', null], ['-5', null], ['−5', null], ['', null], ['   ', null],
  ['abc', null], ['1e3', null], ['%', null],
]
```

- `describe('formatMarginInput')`: `30`→`'30'` · `32.5`→`'32,5'` · `0`→`'0'` · `1000`→`'1000'` · `12.35`→`'12,35'` · `0.1 + 0.2`→`'0,3'` · `33.333`→`'33,33'`.
- `describe('roundingStepLabel')`: `0`→`'Sin redondeo'` · `10`→`'$ 10'` · `50`→`'$ 50'` · `100`→`'$ 100'` · `500`→`'$ 500'` · `1000`→`'$ 1.000'` (espacio común entre `$` y el número).
- `describe('autoSalePriceText')` (`[texto costo, margen, paso, esperado]`):

```ts
[
  ['1.000,00', 30, 0, '1.300,00'], ['1000', 30, 0, '1.300,00'], ['1.000', 30, 0, '1.300,00'],
  ['1234,56', 30, 0, '1.604,93'], ['1570', 0, 100, '1.600,00'], ['1234', 30, 100, '1.600,00'],
  ['100', 30, 0, '130,00'], ['100,00', 50, 10, '150,00'], ['0', 30, 100, '0,00'], ['0,5', 30, 0, '0,65'],
  ['', 30, 0, ''], ['   ', 30, 0, ''], ['abc', 30, 0, ''], ['-5', 30, 0, ''], ['1000', 1001, 0, ''],
]
```

- **Checkpoint A3:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/utils/__tests__/pricing.test.ts` → verde.

**Paso A4 — Agregar a `pricing.ts` las preferencias y sus tests.**

Código a agregar (al final de `pricing.ts`):

```ts
/** Lee las preferencias. Un campo ausente o inválido, JSON corrupto o un storage que lanza → valor por defecto. */
export function loadPricingPrefs(): PricingPrefs {
  const defaults: PricingPrefs = { ...DEFAULT_PRICING_PREFS }
  let raw: string | null
  try {
    raw = localStorage.getItem(PRICING_STORAGE_KEY)
  } catch {
    return defaults
  }
  if (raw === null) return defaults
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return defaults
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return defaults
  const o = data as Record<string, unknown>
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : defaults.enabled,
    marginPct: typeof o.marginPct === 'number' && isValidMarginPct(o.marginPct) ? roundMargin(o.marginPct) : defaults.marginPct,
    roundingStep: toRoundingStep(o.roundingStep) ?? defaults.roundingStep,
  }
}

/**
 * Guarda solo los campos válidos de `partial`, combinados con lo que ya estaba guardado.
 * Nunca lanza: sin storage, el cambio vale solo mientras el modal siga abierto.
 */
export function savePricingPrefs(partial: Partial<PricingPrefs>): void {
  const next = loadPricingPrefs()
  if (typeof partial.enabled === 'boolean') next.enabled = partial.enabled
  if (typeof partial.marginPct === 'number' && isValidMarginPct(partial.marginPct)) next.marginPct = roundMargin(partial.marginPct)
  const step = toRoundingStep(partial.roundingStep)
  if (step !== null) next.roundingStep = step
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Sin storage: solo esta sesión del modal.
  }
}
```

> ⚠ **Cómo simular un storage roto (obligatorio):** en happy-dom 20.9 `localStorage` es un proxy que guarda cada método la primera vez que se usa. Por eso `vi.spyOn(Storage.prototype, 'getItem' | 'setItem')` **no sirve**: después del primer uso no intercepta (el test pasa sin probar nada) y, si intercepta, el mock **queda pegado** a los tests siguientes aunque llames `vi.restoreAllMocks()` (verificado al planificar). Usá siempre `vi.stubGlobal('localStorage', …)` y `vi.unstubAllGlobals()`. Helper para copiar en el archivo de test:
>
> ```ts
> /** localStorage falso cuyos métodos lanzan (se pueden pisar algunos con `overrides`). */
> function brokenStorage(overrides: Partial<Storage> = {}): Storage {
>   const fail = () => {
>     throw new Error('sin storage')
>   }
>   return { length: 0, clear: fail, key: fail, getItem: fail, removeItem: fail, setItem: fail, ...overrides } as Storage
> }
> ```

Tests a agregar en `describe('preferencias de precio')` con `beforeEach(() => localStorage.clear())` y `afterEach(() => vi.unstubAllGlobals())`:

1. `PRICING_STORAGE_KEY` vale `'integral.pricing'` y `DEFAULT_PRICING_PREFS` es `{ enabled: true, marginPct: 30, roundingStep: 100 }`.
2. Sin nada guardado, `loadPricingPrefs()` → `toEqual(DEFAULT_PRICING_PREFS)`.
3. Devuelve una copia: `const p = loadPricingPrefs(); p.marginPct = 99` → `DEFAULT_PRICING_PREFS.marginPct` sigue `30`.
4. Lee lo guardado: `localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({ enabled: false, marginPct: 45, roundingStep: 50 }))` → `toEqual` lo mismo.
5. JSON corrupto (`'{no es json'`) → defaults.
6. `it.each(['5', '"hola"', 'null', '[]', 'true'])` JSON que no es objeto → defaults.
7. Campos inválidos se reemplazan **uno por uno**:
   - `{ enabled: 'si', marginPct: 45, roundingStep: 20 }` → `{ enabled: true, marginPct: 45, roundingStep: 100 }`
   - `{ enabled: false, marginPct: 5000, roundingStep: 50 }` → `{ enabled: false, marginPct: 30, roundingStep: 50 }`
   - `{ marginPct: -1 }` → `marginPct: 30` · `{ marginPct: '45' }` → `marginPct: 30` · `{ roundingStep: '50' }` → `roundingStep: 100`
8. Margen guardado con más decimales se normaliza: `{ marginPct: 12.345 }` → `marginPct: 12.35`.
9. Si el storage lanza (`vi.stubGlobal('localStorage', brokenStorage())`) → `expect(() => localStorage.getItem('x')).toThrow()` (prueba que el stub está activo) y `loadPricingPrefs()` no lanza y devuelve `DEFAULT_PRICING_PREFS`.
10. `savePricingPrefs({ enabled: false })` sin nada previo → `JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY)!)` `toEqual({ enabled: false, marginPct: 30, roundingStep: 100 })`.
11. Combina: `save({ enabled: false })`, `save({ marginPct: 45 })`, `save({ roundingStep: 50 })` → `loadPricingPrefs()` `toEqual({ enabled: false, marginPct: 45, roundingStep: 50 })`.
12. Ignora inválidos: `save({ marginPct: 45 })`, `save({ marginPct: 5000 })`, `save({ roundingStep: 20 as RoundingStep })` → `marginPct: 45`, `roundingStep: 100`.
13. Si `setItem` lanza (`vi.stubGlobal('localStorage', brokenStorage())`) → `expect(() => savePricingPrefs({ enabled: true })).not.toThrow()`.
14. Si `getItem` lanza pero `setItem` funciona: `const setItem = vi.fn()`; `vi.stubGlobal('localStorage', brokenStorage({ setItem }))`; `savePricingPrefs({ marginPct: 45 })` → `setItem` llamado 1 vez, con `setItem.mock.calls[0][0]` = `PRICING_STORAGE_KEY` y `JSON.parse(setItem.mock.calls[0][1] as string)` `toEqual({ enabled: true, marginPct: 45, roundingStep: 100 })` (combina con los defaults).
15. Después de un test con stub, el storage real vuelve: `localStorage.setItem('x', '1')` y `localStorage.getItem('x')` → `'1'` (ponelo **después** de los tests 9, 13 y 14 en el archivo).

- **Checkpoint A4:**
  - `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/utils/__tests__/pricing.test.ts` → verde.
  - `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` → OK.
  - `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx eslint src/utils/pricing.ts src/utils/__tests__/pricing.test.ts` → sin errores.

---

### Fase B — `ui/floatingPlacement.ts`

**Paso B1 — Crear `renderer/src/ui/floatingPlacement.ts`** (copiar):

```ts
/**
 * Posición de un popover flotante (`position: fixed`) respecto de su disparador, en coordenadas de
 * la ventana. Función pura: la usa EntityPicker con el getBoundingClientRect() del disparador.
 */

/** Lo que se usa del rectángulo del disparador (un DOMRect sirve tal cual). */
export type AnchorRect = { top: number; bottom: number; left: number; right: number; width: number }
export type Viewport = { width: number; height: number }

export type FloatingPlacement = {
  /** 'below' = abre debajo del disparador; 'above' = encima. */
  side: 'below' | 'above'
  /** px desde el borde superior de la ventana ('auto' si abre hacia arriba). */
  top: number | 'auto'
  /** px desde el borde inferior de la ventana ('auto' si abre hacia abajo). */
  bottom: number | 'auto'
  left: number
  width: number
  /** Alto disponible en ese lado: el contenido se achica y scrollea si no entra. */
  maxHeight: number
}

/** Separación entre disparador y popover (la misma que el `calc(100% + 4px)` anterior). */
export const FLOATING_GAP = 4
/** Distancia mínima a los bordes de la ventana. */
export const FLOATING_MARGIN = 8
/** Ancho del popover del design system (`.ig-picker-pop`). */
export const FLOATING_MIN_WIDTH = 420
/** Si abajo hay al menos este alto, se abre abajo sin mirar arriba. */
export const FLOATING_PREFERRED_HEIGHT = 360

export function computeFloatingPlacement(anchor: AnchorRect, viewport: Viewport, minWidth = FLOATING_MIN_WIDTH): FloatingPlacement {
  const maxWidth = Math.max(0, viewport.width - 2 * FLOATING_MARGIN)
  const width = Math.min(Math.max(anchor.width, minWidth), maxWidth)

  // Alineado al borde izquierdo del disparador; si se sale por la derecha, al borde derecho.
  let left = anchor.left
  if (left + width > viewport.width - FLOATING_MARGIN) left = anchor.right - width
  left = Math.max(FLOATING_MARGIN, Math.min(left, viewport.width - FLOATING_MARGIN - width))

  const spaceBelow = viewport.height - anchor.bottom - FLOATING_GAP - FLOATING_MARGIN
  const spaceAbove = anchor.top - FLOATING_GAP - FLOATING_MARGIN
  const base = { left: Math.round(left), width: Math.round(width) }

  if (spaceBelow >= FLOATING_PREFERRED_HEIGHT || spaceBelow >= spaceAbove) {
    return { side: 'below', top: Math.round(anchor.bottom + FLOATING_GAP), bottom: 'auto', ...base, maxHeight: Math.max(0, Math.floor(spaceBelow)) }
  }
  return { side: 'above', top: 'auto', bottom: Math.round(viewport.height - anchor.top + FLOATING_GAP), ...base, maxHeight: Math.max(0, Math.floor(spaceAbove)) }
}
```

**Paso B2 — Crear `renderer/src/ui/__tests__/floatingPlacement.test.ts`.**

Helper del test: `const rect = (top: number, left: number, width: number, height = 40) => ({ top, left, width, bottom: top + height, right: left + width })` y `const V = { width: 1280, height: 690 }`. Cada caso con `toEqual` del objeto completo (valores verificados al planificar):

| Caso | Llamada | Esperado |
|---|---|---|
| Básico: abajo, 420 de ancho | `computeFloatingPlacement(rect(100, 200, 246), V)` | `{ side: 'below', top: 144, bottom: 'auto', left: 200, width: 420, maxHeight: 538 }` |
| No entra a la derecha → alinea al borde derecho | `rect(100, 1000, 246)`, `V` | `{ side: 'below', top: 144, bottom: 'auto', left: 826, width: 420, maxHeight: 538 }` |
| Disparador más ancho que 420 | `rect(100, 200, 500)`, `V` | `{ …, left: 200, width: 500, … }` (top 144, maxHeight 538) |
| Ventana angosta: ancho y left acotados | `rect(100, 10, 246)`, `{ width: 400, height: 690 }` | `{ side: 'below', top: 144, bottom: 'auto', left: 8, width: 384, maxHeight: 538 }` |
| Sin lugar abajo → abre arriba | `rect(560, 200, 246)`, `V` | `{ side: 'above', top: 'auto', bottom: 134, left: 200, width: 420, maxHeight: 548 }` |
| Abajo < 360 pero más que arriba → abajo | `rect(300, 200, 246)`, `V` | `{ side: 'below', top: 344, bottom: 'auto', left: 200, width: 420, maxHeight: 338 }` |
| Abajo exactamente 360 → abajo | `rect(278, 200, 246)`, `V` | `{ side: 'below', top: 322, bottom: 'auto', left: 200, width: 420, maxHeight: 360 }` |
| Sin lugar en ningún lado → maxHeight nunca negativo | `rect(5, 200, 246, 680)`, `V` | `{ side: 'below', top: 689, bottom: 'auto', left: 200, width: 420, maxHeight: 0 }` |
| Valores con decimales se redondean | `{ top: 100.4, bottom: 140.6, left: 200.5, right: 446.5, width: 246 }`, `V` | `{ side: 'below', top: 145, bottom: 'auto', left: 201, width: 420, maxHeight: 537 }` |
| `minWidth` propio | `rect(100, 200, 246)`, `V`, `0` | `{ side: 'below', top: 144, bottom: 'auto', left: 200, width: 246, maxHeight: 538 }` |

Más: `expect(FLOATING_MIN_WIDTH).toBe(420)` (es el ancho del DS).

- **Checkpoint B2:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/ui/__tests__/floatingPlacement.test.ts` → verde. `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx eslint src/ui/floatingPlacement.ts src/ui/__tests__/floatingPlacement.test.ts` → sin errores.

---

### Fase C — `EntityPicker` con popover flotante

**Paso C1 — Modificar `renderer/src/ui/EntityPicker.tsx`.** Cambios exactos (el resto del archivo queda igual):

1. Imports: reemplazá la línea de React por
   `import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'`
   y agregá:
   ```ts
   import { computeFloatingPlacement } from './floatingPlacement'
   import type { FloatingPlacement } from './floatingPlacement'
   ```
2. Debajo de `const nameRef = useRef<HTMLInputElement>(null)` agregá:
   ```ts
   const popRef = useRef<HTMLDivElement>(null)
   /** Posición del popover flotante; null hasta medir el disparador. */
   const [placement, setPlacement] = useState<FloatingPlacement | null>(null)
   ```
3. Debajo del efecto "Click afuera cierra." agregá:
   ```ts
   /** Ubica el popover respecto del disparador, en coordenadas de la ventana (lo usa `position: fixed`). */
   const updatePlacement = useCallback(() => {
     const trigger = innerTriggerRef.current
     if (!trigger) return
     setPlacement(computeFloatingPlacement(trigger.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }))
   }, [])

   // Abierto: se mide antes de pintar y se sigue al disparador si cambia la ventana o scrollea algún contenedor.
   useLayoutEffect(() => {
     if (!open) return
     updatePlacement()
     const onScroll = (e: Event) => {
       // El scroll de la propia lista del popover no mueve al disparador.
       if (e.target instanceof Node && popRef.current?.contains(e.target)) return
       updatePlacement()
     }
     window.addEventListener('resize', updatePlacement)
     window.addEventListener('scroll', onScroll, true) // captura: también el scroll del cuerpo del modal
     return () => {
       window.removeEventListener('resize', updatePlacement)
       window.removeEventListener('scroll', onScroll, true)
     }
   }, [open, updatePlacement])
   ```
4. En `openPopover()`, agregá `setPlacement(null)` antes de `setOpen(true)`.
5. En `onPopoverKeyDown`, como **primer** bloque de la función:
   ```ts
   if (e.key === 'Tab' && mode === 'list') {
     // Tab sale de la lista: se cierra el popover y el navegador lleva el foco al campo siguiente/anterior.
     closePopover(false)
     return
   }
   ```
   (No llames `preventDefault`.)
6. En el `<div className="ig-picker-pop" …>` del popover:
   - `className="ig-picker-pop is-floating"`
   - agregá `ref={popRef}`
   - agregá (exactamente):
     ```tsx
     style={
       placement
         ? {
             position: 'fixed',
             top: placement.top,
             bottom: placement.bottom,
             left: placement.left,
             width: placement.width,
             maxHeight: placement.maxHeight,
           }
         : { position: 'fixed', visibility: 'hidden' }
     }
     ```
     **Siempre** se setean `top` y `bottom` (uno de los dos es `'auto'`): la regla vieja `.ig-anchor > .ig-picker-pop { top: calc(100% + 4px) }` de `app.css` tiene que quedar pisada por el estilo en línea.
7. Actualizá el comentario JSDoc del componente agregando:
   > El popover flota con `position: fixed` (posición calculada con `computeFloatingPlacement` desde el disparador): no lo recorta ni lo hace scrollear el contenedor (por ejemplo el cuerpo de un modal). No es un portal: sigue dentro del DOM del picker, así el focus trap del Modal, el click afuera y el stopPropagation de Enter/Esc funcionan igual. Tab en la lista cierra el popover.

   y en la línea "Teclado:" agregá "; Tab (en la lista) cierra".

**NO hagas:** `createPortal`, Popover API (`popover`/`showPopover`), CSS anchor positioning, ni cambios en las props.

- **Checkpoint C1:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/ui/__tests__/EntityPicker.test.tsx src/Pages/Stock/__tests__/CategoryPicker.test.tsx src/Pages/Stock/__tests__/SupplierPicker.test.tsx src/Pages/Stock/__tests__/ProductFormModal.test.tsx src/Pages/Stock/__tests__/StockProducts.test.tsx` → todos verdes **sin cambiar ningún test** (el popover sigue teniendo `role="dialog"` y queda visible porque `useLayoutEffect` lo ubica antes de que el test consulte).
  - Si falla con "Unable to find role dialog": revisá que el cálculo esté en `useLayoutEffect` (no `useEffect`) y que `openPopover` no deje `placement` en null después de abrir.

**Paso C2 — Agregar tests a `renderer/src/ui/__tests__/EntityPicker.test.tsx`.**

Helpers (arriba del `describe`, después de `searchBox`):

```ts
/** happy-dom no hace layout: se fija el tamaño de la ventana y el rectángulo del disparador a mano. */
function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}
function makeRect(r: { top: number; left: number; width: number; height: number }): DOMRect {
  return { ...r, bottom: r.top + r.height, right: r.left + r.width, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect
}
function mockRect(el: HTMLElement, r: { top: number; left: number; width: number; height: number }) {
  return vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(makeRect(r))
}
const popover = () => screen.getByRole('dialog', { name: /^Elegir/ })
```

Tests nuevos (todos usan `setViewport(1280, 690)` al empezar y `setup()` del archivo; el rect se mockea **antes** del click):

| Id | Nombre del test | Pasos | Esperado |
|---|---|---|---|
| E1 | `el popover flota: position fixed debajo del disparador, 420 px de ancho y alto máximo según el espacio` | `mockRect(trigger(), { top: 100, left: 200, width: 246, height: 40 })`; click | `popover()` tiene clases `ig-picker-pop` e `is-floating`; `style.position` `'fixed'`; `style.top` `'144px'`; `style.bottom` `'auto'`; `style.left` `'200px'`; `style.width` `'420px'`; `style.maxHeight` `'538px'` |
| E2 | `si no entra a la derecha, se alinea con el borde derecho del disparador` | rect `{ top: 100, left: 1000, width: 246, height: 40 }`; click | `style.left` `'826px'` |
| E3 | `si no hay lugar abajo, abre hacia arriba` | rect `{ top: 560, left: 200, width: 246, height: 40 }`; click | `style.top` `'auto'`; `style.bottom` `'134px'`; `style.maxHeight` `'548px'` |
| E4 | `sigue al disparador cuando la ventana cambia de tamaño o scrollea un contenedor` | `const spy = mockRect(…{ top: 100, left: 200 …})`; click; `spy.mockReturnValue(makeRect({ top: 300, left: 10, width: 246, height: 40 }))`; `fireEvent(window, new Event('resize'))`; luego `spy.mockReturnValue(makeRect({ top: 310, left: 10, width: 246, height: 40 }))`; `fireEvent.scroll(document.body)` | después del resize: `top` `'344px'`, `left` `'10px'`; después del scroll: `top` `'354px'` |
| E5 | `el scroll de la propia lista no recalcula la posición` | `const spy = mockRect(…{ top: 100 …})`; click; `spy.mockReturnValue(makeRect({ top: 300, left: 200, width: 246, height: 40 }))`; `fireEvent.scroll(document.querySelector('.ig-picker-list')!)` | `style.top` sigue `'144px'` |
| E6 | `el popover sigue dentro del árbol del picker (no es un portal) y un mousedown adentro no lo cierra` | `const { container, trigger } = setup()`; click; `fireEvent.mouseDown(searchBox())` | `container.contains(popover())` es `true`; el popover sigue en el documento |
| E7 | `Tab en la lista cierra el popover` | click; `fireEvent.keyDown(searchBox(), { key: 'Tab' })` | `screen.queryByRole('dialog')` es `null` |
| E8 | `Tab dentro del alta no cierra el popover` | click; `fireEvent.change(searchBox(), { target: { value: 'zzz' } })`; click en `Crear «zzz»`; `fireEvent.keyDown(screen.getByLabelText(/^Nombre/), { key: 'Tab' })` | el popover sigue en el documento y se ve "Nueva categoría" |

- **Checkpoint C2:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/ui/__tests__/EntityPicker.test.tsx` → verde. `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx eslint src/ui/EntityPicker.tsx src/ui/__tests__/EntityPicker.test.tsx` → sin errores. `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` → OK.

---

### Fase D — `Modal` con `className`

**Paso D1 — Modificar `renderer/src/ui/Modal.tsx`.**
1. En `ModalProps` agregá, debajo de `size`:
   ```ts
   /** Clase extra para el diálogo (`.ig-modal`), ej. un ancho propio de una pantalla. */
   className?: string
   ```
2. Desestructurá `className` en los parámetros del componente.
3. Reemplazá `className={\`ig-modal ${sizeClass}\`.trim()}` por `className={['ig-modal', sizeClass, className].filter(Boolean).join(' ')}`.
4. No toques nada más (ni foco, ni Escape, ni overlay). **No** agregues un tamaño `xl`.

**Paso D2 — Tests en `renderer/src/ui/__tests__/Modal.test.tsx`:**
- `className se suma a las clases del diálogo`: `<Modal open title="T" className="pf-modal" onClose={() => {}}>x</Modal>` → `expect(screen.getByRole('dialog')).toHaveClass('ig-modal', 'pf-modal')`.
- `className convive con size`: `size="sm" className="extra"` → `toHaveClass('ig-modal', 'ig-modal-sm', 'extra')`.

- **Checkpoint D:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/ui/__tests__/Modal.test.tsx` → verde; `npx eslint src/ui/Modal.tsx src/ui/__tests__/Modal.test.tsx` (desde renderer) → sin errores.

---

### Fase E — CSS (`renderer/src/styles/app.css`)

**Paso E1 — Agregar AL FINAL de `app.css` este bloque, completo y tal cual** (no edites las reglas que ya existen arriba; el bloque delimitado minimiza conflictos de merge con el otro agente):

```css
/* === Formulario de producto y scrollbars === */
/* Scrollbars de toda la app con las propiedades estándar (Chromium ≥ 121). Se heredan a todos los contenedores
   con scroll. Con estas propiedades seteadas Chromium ignora los pseudo-elementos de scrollbar con prefijo -webkit-:
   no mezclar. */
:root { scrollbar-width: thin; scrollbar-color: var(--border-control) transparent; }
/* Controles nativos (flecha y lista del <select>, checkbox) acordes al tema. */
:root, [data-theme="light"] { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }

/* Modal de producto: más ancho y alto que modal-md para que el formulario entre sin scroll a 1280×720.
   El cuerpo conserva el overflow: auto del DS solo como red de seguridad. */
.ig-overlay:has(> .pf-modal) { padding-top: var(--space-4); }
.ig-modal.pf-modal { width: 1080px; max-width: calc(100vw - 2 * var(--space-6)); max-height: calc(100vh - 2 * var(--space-4)); }
.pf-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
.pf-grid > .span-2 { grid-column: span 2; }
.pf-grid > .pf-expiry { grid-column: 3 / span 2; }
.pf-expiry .ig-input { max-width: 220px; }
.pf-grid .ig-picker > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-grid .ig-input:disabled { background: var(--surface-sunken); color: var(--ink-disabled); border-color: var(--border); cursor: not-allowed; }
.pf-auto { display: inline-flex; align-items: center; gap: var(--space-2); font: 500 13px/18px var(--font-sans); color: var(--ink); cursor: pointer; }
.pf-auto input { width: 16px; height: 16px; margin: 0; accent-color: var(--primary); cursor: pointer; }
.ig-input-wrap > .ig-input.pf-margin-input { padding-left: var(--space-3); padding-right: var(--space-8); }

/* Popover del Picker flotante: EntityPicker le pone en línea position: fixed + top/bottom/left/width/max-height.
   Así sale por encima del modal sin que el cuerpo del modal genere scroll. */
.ig-picker-pop.is-floating { display: flex; flex-direction: column; }
.ig-picker-pop.is-floating > .ig-pop-search, .ig-picker-pop.is-floating > .ig-picker-create { flex: none; }
.ig-picker-pop.is-floating > .ig-picker-list { flex: 0 1 auto; min-height: 0; }
.ig-picker-pop.is-floating > .ig-picker-new { min-height: 0; overflow: auto; }
```

- **Checkpoint E1** (chequeos estáticos, todos desde `/c/Users/asant/Music/Integral/wt-producto`):
  - `grep -rn "webkit-scrollbar" renderer/src` → **sin salida**.
  - `sed -n '/=== Formulario de producto y scrollbars ===/,$p' renderer/src/styles/app.css | grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\('` → **sin salida** (ningún color hardcodeado en el bloque).
  - `grep -c "=== Formulario de producto y scrollbars ===" renderer/src/styles/app.css` → `1`.
  - `git diff --stat -- renderer/src/styles/bundle.css renderer/src/styles/tokens.css design-system` → **sin salida**.

---

### Fase F — `ProductFormModal`: layout ancho de 4 columnas (todavía sin margen)

> Al terminar esta fase la fila 2 tiene solo "Precio de compra" y "Precio de venta" y el código de barras "sube" a esa fila: es temporal, la Fase G completa la fila 2. Los tests no dependen de eso.

**Paso F1 — Ancho y grilla.** En `renderer/src/Pages/Stock/ProductFormModal.tsx`:
1. Al `<Modal …>` principal (no al de "¿Descartar los cambios?") agregale `className="pf-modal"`. Dejá `size="md"` como está.
2. Cambiá `<div className="ig-form-grid">` por `<div className="pf-grid">`.
3. Reordená los hijos de la grilla así (el contenido de cada `Field` queda **igual**, solo se mueven bloques):
   ```tsx
   {/* Fila 1: identidad */}
   <Field label="Nombre" … className="span-2">…</Field>
   <CategoryPicker … />
   <SupplierPicker … />

   {/* Fila 2: precios (la Fase G agrega "Calcular con margen" y "Redondeo" entre compra y venta) */}
   <Field label="Precio de compra" …>…</Field>
   <Field label="Precio de venta" …>…</Field>

   {/* Fila 3: código y stock */}
   <Field label="Código de barras" … className="span-2">…</Field>
   {isEdit ? <Field label="Stock" …>…</Field> : <Field label="Stock inicial" …>…</Field>}
   <Field label="Stock mínimo" …>…</Field>

   {/* Fila 4 (solo alta con stock inicial > 0): debajo de las columnas de stock */}
   {showExpiry && <DateField … className="pf-expiry" … />}
   ```
   (Hoy el orden ya es ese salvo por el `className` del vencimiento: cambiá `className="span-2"` del `DateField` por `className="pf-expiry"`.)
4. No cambies `FIELD_ORDER`, ids, labels ni el `onKeyDown` del código de barras.

**Paso F2 — Error de guardado al pie.**
1. Borrá `{saveFailed && <InlineAlert tone="danger" title="No se pudo guardar el producto. Probá de nuevo." />}` del cuerpo.
2. Al `div` que envuelve la grilla (el del `onKeyDown` de Ctrl+Enter) sacale `style={{ display: 'grid', gap: 16 }}` (ya no hace falta); dejá el `onKeyDown` y su comentario.
3. En la prop `footer` del modal principal, como **primer** hijo del fragmento:
   ```tsx
   {saveFailed && (
     <span className="ig-error" role="alert">
       <CircleAlert size={16} aria-hidden="true" className="ig-icon ig-icon-sm" />
       No se pudo guardar el producto. Probá de nuevo.
     </span>
   )}
   ```
4. Imports: agregá `CircleAlert` al import de `lucide-react` (queda `import { CircleAlert, ScanBarcode } from 'lucide-react'`) y **borrá** `import { InlineAlert } from '../../ui/InlineAlert'` (si no, falla `noUnusedLocals`).

- **Checkpoint F2:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/Pages/Stock` → todos verdes **sin cambiar tests**. `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` → OK.

**Paso F3 — Tests de layout en `ProductFormModal.test.tsx`** (nuevo `describe('ProductFormModal — layout sin scroll')`):
- L1 `el modal usa pf-modal y la grilla de 4 columnas`: `renderModal()` → `expect(screen.getByRole('dialog', { name: 'Nuevo producto' })).toHaveClass('ig-modal', 'pf-modal')`; `expect(document.querySelector('.pf-grid')).not.toBeNull()`; `expect(document.querySelector('.ig-form-grid')).toBeNull()`.
- L2 `Nombre y Código de barras ocupan 2 columnas`: `expect(nameInput().closest('.ig-field')).toHaveClass('span-2')`; `expect(barcodeInput().closest('.ig-field')).toHaveClass('span-2')`.
- L3 `el vencimiento va bajo las columnas de stock`: `type(stockInput(), '12')` → `expect(screen.getByLabelText(/Vencimiento del lote/i).closest('.ig-field')).toHaveClass('pf-expiry')`.
- L4 `el error de guardado aparece en el pie, al lado de los botones`: con `api().createProduct.mockRejectedValue(new Error('disco lleno'))`, `await fillMinimumValidForm()`, click en guardar → `const msg = await screen.findByText('No se pudo guardar el producto. Probá de nuevo.')`; `expect(msg.closest('.ig-modal-foot')).not.toBeNull()`; `expect(msg.closest('.ig-modal-body')).toBeNull()`.
- L5 `el popover de Proveedor flota (position: fixed) y queda dentro del diálogo (focus trap)`: `renderModal()`; `fireEvent.click(screen.getByRole('button', { name: /^Proveedor/ }))`; `const pop = await screen.findByRole('dialog', { name: 'Elegir proveedor' })`; `expect(pop.style.position).toBe('fixed')`; `expect(pop).toHaveClass('is-floating')`; `expect(screen.getByRole('dialog', { name: 'Nuevo producto' }).contains(pop)).toBe(true)`.

- **Checkpoint F3:** `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/Pages/Stock/__tests__/ProductFormModal.test.tsx` → verde.

---

### Fase G — `ProductFormModal`: precio con margen

**Paso G1 — Imports, estado y reset al abrir.**
1. Imports nuevos:
   ```ts
   import {
     DEFAULT_PRICING_PREFS,
     ROUNDING_STEPS,
     autoSalePriceText,
     formatMarginInput,
     loadPricingPrefs,
     parseMarginInput,
     roundingStepLabel,
     savePricingPrefs,
     toRoundingStep,
   } from '../../utils/pricing'
   import type { RoundingStep } from '../../utils/pricing'
   ```
2. A nivel de módulo (fuera del componente, debajo de `formatMarginPct`):
   ```ts
   /** Configuración vigente del cálculo automático del precio de venta. */
   type PricingConfig = { auto: boolean; margin: number; step: RoundingStep }

   /** Si el cálculo está activo, devuelve el draft con el precio de venta recalculado desde el costo. */
   function withAutoSale(d: ProductFormDraft, p: PricingConfig): ProductFormDraft {
     return p.auto ? { ...d, salePrice: autoSalePriceText(d.purchasePrice, p.margin, p.step) } : d
   }
   ```
3. Dentro del componente, junto a los otros `useState`:
   ```ts
   /** Cálculo automático del precio de venta (preferencias en utils/pricing). */
   const [autoPrice, setAutoPrice] = useState(false)
   const [marginPct, setMarginPct] = useState(DEFAULT_PRICING_PREFS.marginPct)
   const [marginInput, setMarginInput] = useState(formatMarginInput(DEFAULT_PRICING_PREFS.marginPct))
   const [roundingStep, setRoundingStep] = useState<RoundingStep>(DEFAULT_PRICING_PREFS.roundingStep)
   ```
4. Al final del `useEffect` que precarga/limpia el formulario (el de dependencias `[open, product, initialName, initialBarcode]`), agregá:
   ```ts
   const prefs = loadPricingPrefs()
   setAutoPrice(product ? false : prefs.enabled) // en edición siempre arranca apagado: no pisa el precio guardado
   setMarginPct(prefs.marginPct)
   setMarginInput(formatMarginInput(prefs.marginPct))
   setRoundingStep(prefs.roundingStep)
   ```
- **Checkpoint G1:** `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` (puede quejarse de imports sin usar: se usan en G2–G4; si es así, seguí y corré el typecheck en G4).

**Paso G2 — Recalcular al cambiar el costo.** Reemplazá `updateField` por:
```ts
function updateField(field: keyof ProductFormDraft, value: string | number) {
  setDraft((d) => {
    const next: ProductFormDraft = { ...d, [field]: value }
    // Con el cálculo activo, el precio de venta sigue al costo.
    return field === 'purchasePrice' ? withAutoSale(next, pricing) : next
  })
  setErrors((e) => {
    if (!e) return null
    const cleared: FormErrors = { ...e, [field]: undefined }
    if (field === 'purchasePrice' && autoPrice) cleared.salePrice = undefined
    return cleared
  })
  if (field === 'barcode') setBarcodeTakenError(null)
}
```
y, antes de `updateField`, declarás `const pricing: PricingConfig = { auto: autoPrice, margin: marginPct, step: roundingStep }`.

**Paso G3 — Handlers del cálculo** (debajo de `formatPriceOnBlur`):
```ts
/** Tildar/destildar "Calcular con margen". Tildar recalcula ya; destildar deja el último valor (editable). */
function handleAutoPriceChange(next: boolean) {
  setAutoPrice(next)
  if (!isEdit) savePricingPrefs({ enabled: next }) // en edición no cambia cómo arranca el alta
  if (next) {
    setDraft((d) => withAutoSale(d, { ...pricing, auto: true }))
    setErrors((e) => (e ? { ...e, salePrice: undefined } : null))
  }
}

/** Margen tipeado: si es válido se aplica y se recuerda en el momento; si no, se ignora hasta salir del campo. */
function handleMarginInputChange(text: string) {
  setMarginInput(text)
  const n = parseMarginInput(text)
  if (n === null) return
  setMarginPct(n)
  savePricingPrefs({ marginPct: n })
  setDraft((d) => withAutoSale(d, { ...pricing, margin: n }))
}

/** Al salir del margen (blur o Enter) se muestra el último margen válido, normalizado ("30,50" → "30,5"). */
function normalizeMarginInput() {
  setMarginInput(formatMarginInput(marginPct))
}

function handleRoundingChange(step: RoundingStep) {
  setRoundingStep(step)
  savePricingPrefs({ roundingStep: step })
  setDraft((d) => withAutoSale(d, { ...pricing, step }))
}
```

**Paso G4 — JSX de la fila 2 y del precio de venta.**
1. Entre el `Field` "Precio de compra" y el `Field` "Precio de venta", insertá **en este orden**:
   ```tsx
   {/* Calcular con margen + Margen (%): el checkbox hace de label del campo */}
   <div className="ig-field">
     <label className="pf-auto">
       <input id="pf-auto-price" type="checkbox" checked={autoPrice} onChange={(e) => handleAutoPriceChange(e.target.checked)} />
       Calcular con margen
     </label>
     <div className="ig-input-wrap">
       <input
         id="pf-margin"
         className="ig-input ig-input-amount pf-margin-input"
         inputMode="decimal"
         aria-label="Margen (%)"
         aria-describedby="pf-margin-help"
         disabled={!autoPrice}
         value={marginInput}
         onChange={(e) => handleMarginInputChange(e.target.value)}
         onBlur={normalizeMarginInput}
         onKeyDown={(e) => {
           if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
             e.preventDefault()
             normalizeMarginInput()
           }
         }}
       />
       <span className="ig-suffix" aria-hidden="true">%</span>
     </div>
     <span className="ig-help" id="pf-margin-help">Sobre el precio de compra.</span>
   </div>

   <Field label="Redondeo" htmlFor="pf-rounding" help="Al más cercano.">
     <select
       id="pf-rounding"
       className="ig-input"
       aria-describedby="pf-rounding-help"
       disabled={!autoPrice}
       value={String(roundingStep)}
       onChange={(e) => {
         const step = toRoundingStep(Number(e.target.value))
         if (step !== null) handleRoundingChange(step)
       }}
     >
       {ROUNDING_STEPS.map((s) => (
         <option key={s} value={String(s)}>
           {roundingStepLabel(s)}
         </option>
       ))}
     </select>
   </Field>
   ```
2. Ayuda del precio de venta: reemplazá la expresión `help={ margin ? … : undefined }` del `Field` "Precio de venta" por `help={saleHelp}`, y declarás `saleHelp` justo después de `const lossMaking = …` (antes del `return`):
   ```tsx
   /** Ayuda bajo "Precio de venta": falta el costo (cálculo activo) · venta bajo costo · margen real. */
   function saleHelpContent(): React.ReactNode {
     if (autoPrice && autoSalePriceText(draft.purchasePrice, marginPct, roundingStep) === '') {
       return 'Completá el precio de compra para calcularlo.'
     }
     if (!margin) return undefined
     if (lossMaking) return <span style={{ color: 'var(--warning)' }}>Estás vendiendo por debajo del costo.</span>
     return `Margen: ${formatMarginPct(margin.pct)} % · ganancia ${formatMoney(margin.profit)} por unidad`
   }
   const saleHelp = saleHelpContent()
   ```
3. En el `<input id="pf-sale" …>`:
   - **NO** agregues `readOnly` (decisión del usuario: el precio de venta siempre se puede tipear);
   - `aria-describedby={errors?.salePrice ? 'pf-sale-error' : saleHelp ? 'pf-sale-help' : undefined}`;
   - `onChange={(e) => handleSaleInputChange(e.target.value)}`, con este handler nuevo (ponelo debajo de `handleRoundingChange`):
     ```ts
     /** Tipear el precio de venta con el cálculo activo lo apaga SOLO para este producto (no se guarda la preferencia). */
     function handleSaleInputChange(text: string) {
       if (autoPrice) setAutoPrice(false)
       updateField('salePrice', text)
     }
     ```
     (Ojo: `updateField('salePrice', …)` no recalcula nada porque solo `purchasePrice` dispara `withAutoSale`.)
   - `onBlur` queda como estaba (`formatPriceOnBlur('salePrice')`).
4. Actualizá el JSDoc del componente con una línea: "- Precio con margen: el checkbox «Calcular con margen» completa el precio de venta con `utils/pricing`; tipear el precio a mano apaga el cálculo solo para ese producto; en alta arranca según la preferencia recordada y en edición apagado."
- **Checkpoint G4:**
  - `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` → OK.
  - Como el default ahora es **cálculo activado**, algunos tests existentes que abren el modal en alta pueden fallar (por ejemplo, los que tipean solo el costo y esperan el precio de venta vacío). Arreglo único y permitido: buscá con `grep -rl "ProductFormModal\|StockProducts\|StockPage" renderer/src --include=*.test.tsx` los archivos de test que abren el modal de producto y, en cada uno que falle, agregá como **primeras líneas** de su `beforeEach` de nivel superior (creá uno si no hay):
    ```ts
    localStorage.clear()
    localStorage.setItem('integral.pricing', JSON.stringify({ enabled: false, marginPct: 30, roundingStep: 100 }))
    ```
    No cambies ninguna otra cosa de esos tests.
  - `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/Pages/Stock src/__tests__` → todos verdes.

**Paso G5 — Preparar el archivo de tests `ProductFormModal.test.tsx`.**
1. Primeras líneas del `beforeEach` de arriba del archivo (si en G4 ya las agregaste, dejalas así):
   ```ts
   localStorage.clear()
   // Base de los tests: cálculo APAGADO (el default real, activado, lo prueba T1 limpiando el storage).
   localStorage.setItem('integral.pricing', JSON.stringify({ enabled: false, marginPct: 30, roundingStep: 0 }))
   ```
   Importante: con esta base, en T2–T11 el `click` del checkbox lo **activa**. Si en G4 habías puesto `roundingStep: 100` en este archivo, cambialo a `0`.
2. Imports nuevos: `import userEvent from '@testing-library/user-event'` y `import { PRICING_STORAGE_KEY } from '../../../utils/pricing'`.
3. Helpers nuevos (junto a los existentes):
   ```ts
   const autoCheckbox = () => screen.getByRole('checkbox', { name: 'Calcular con margen' }) as HTMLInputElement
   const marginInput = () => screen.getByLabelText('Margen (%)') as HTMLInputElement
   const roundingSelect = () => screen.getByLabelText('Redondeo') as HTMLSelectElement
   const setStep = (value: string) => fireEvent.change(roundingSelect(), { target: { value } })
   const savePrefs = (p: object) => localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(p))
   const storedPrefs = () => JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY) ?? 'null')
   /** localStorage falso cuyos métodos lanzan (se pueden pisar algunos con `overrides`). Lo usa T17. */
   function brokenStorage(overrides: Partial<Storage> = {}): Storage {
     const fail = () => {
       throw new Error('sin storage')
     }
     return { length: 0, clear: fail, key: fail, getItem: fail, removeItem: fail, setItem: fail, ...overrides } as Storage
   }
   ```

**Paso G6 — Tests de integración** (nuevo `describe('ProductFormModal — precio con margen')`). `type` y `renderModal` son los helpers del archivo. Los valores esperados están verificados.

| Id | Test | Pasos | Esperado |
|---|---|---|---|
| T1 | `sin preferencias guardadas: cálculo activado, margen 30 y redondeo $ 100` | `localStorage.clear()` (borra la base del `beforeEach`); `renderModal()`; `type(purchaseInput(), '1234')` | checkbox tildado; `marginInput().value` `'30'` y habilitado; `roundingSelect().value` `'100'` y habilitado; `saleInput().readOnly` `false`; `saleInput().value` `'1.600,00'` |
| T2 | `tildar completa el precio de venta con el costo actual` | `type(purchaseInput(), '1000')`; `fireEvent.click(autoCheckbox())` | `saleInput().value` `'1.300,00'`; `readOnly` `false`; margen y redondeo habilitados |
| T3 | `con el cálculo activo el precio sigue al costo y redondea al más cercano (la mitad sube)` | click checkbox; `type(marginInput(), '0')`; `setStep('100')`; costo `'1570'` → `'1530'` → `'1550'` → `'1549,99'` | venta `'1.600,00'` → `'1.500,00'` → `'1.600,00'` → `'1.500,00'` |
| T4 | `cambiar el redondeo recalcula` | click; costo `'1234'`; luego `setStep` `'10'`, `'50'`, `'100'`, `'500'`, `'1000'`, `'0'` | `'1.604,20'` (inicial), `'1.600,00'`, `'1.600,00'`, `'1.600,00'`, `'1.500,00'`, `'2.000,00'`, `'1.604,20'` |
| T5 | `cambiar el margen recalcula y acepta coma decimal` | click; costo `'1000'`; margen `'45'`; margen `'32,5'` | `'1.450,00'`; `'1.325,00'` |
| T6 | `un margen inválido no recalcula y al salir vuelve al último válido` | click; costo `'1000'`; margen `'abc'`; `fireEvent.blur(marginInput())`; margen `'2000'`; blur; margen `'-5'`; blur | la venta queda `'1.300,00'` en todo momento; después de cada blur `marginInput().value` es `'30'` |
| T7 | `Enter en el margen normaliza el texto y no guarda` | click; margen `'30,50'`; `fireEvent.keyDown(marginInput(), { key: 'Enter' })` | `marginInput().value` `'30,5'`; `api().createProduct` no llamado |
| T8 | `sin costo, el precio queda vacío y lo explica` | click | `saleInput().value` `''`; `screen.getByText('Completá el precio de compra para calcularlo.')` existe |
| T9 | `tipear el precio de venta apaga el cálculo solo para este producto` | click; costo `'1000'`; `type(saleInput(), '1.500')`; `type(purchaseInput(), '2000')` | tras tipear: `saleInput().value` `'1.500'`; checkbox sin tildar; margen y redondeo deshabilitados; `storedPrefs().enabled` sigue `true` (no se guardó el apagado); tras cambiar el costo el precio sigue `'1.500'` |
| T10 | `destildar deja el último precio y se puede editar` | click; costo `'1000'`; click de nuevo; `type(saleInput(), '1.500')`; `type(purchaseInput(), '2000')` | tras destildar: `'1.300,00'`; después `'1.500'`; tras cambiar el costo sigue `'1.500'`; `storedPrefs().enabled` `false` (destildar a mano en alta sí se recuerda) |
| T11 | `la ayuda muestra el margen real después de redondear` | click; `setStep('100')`; costo `'1234'` | venta `'1.600,00'`; `screen.getByText('Margen: 29,7 % · ganancia $ 366,00 por unidad')` |
| T12 | `Ctrl+Enter guarda con el precio calculado` | `savePrefs({ enabled: true, marginPct: 30, roundingStep: 100 })`; `api().createProduct.mockResolvedValue(createdProduct())`; `renderModal()`; checkbox **ya tildado**; `type(nameInput(), 'Producto Test')`; `type(purchaseInput(), '1234')`; `await pickCategory()`; `await pickSupplier()`; `fireEvent.keyDown(nameInput(), { key: 'Enter', ctrlKey: true })` | `await waitFor(…)`: `createProduct` llamado con `expect.objectContaining({ purchasePrice: '1234', salePrice: '1600' })` |
| T13 | `las preferencias se guardan al cambiarlas y se recuerdan al reabrir` | `const { rerender } = renderModal()`; click; margen `'40'`; `setStep('100')`; `rerender(<ProductFormModal open={false} onClose={vi.fn()} onSuccess={vi.fn()} />)`; `rerender(<ProductFormModal open={true} onClose={vi.fn()} onSuccess={vi.fn()} />)` | antes del rerender: `storedPrefs()` `toEqual({ enabled: true, marginPct: 40, roundingStep: 100 })`; al reabrir: checkbox tildado, margen `'40'`, redondeo `'100'` |
| T14 | `en edición arranca apagado aunque la preferencia esté prendida, y no pisa el precio` | `savePrefs({ enabled: true, marginPct: 30, roundingStep: 100 })`; `renderModal({ product: productForEdit() })` | checkbox sin tildar; `saleInput().value` `'1.000,00'`; margen deshabilitado; redondeo muestra `'100'` |
| T15 | `en edición, tildar recalcula con el costo del producto pero no cambia cómo arranca el alta` | `savePrefs({ enabled: false, marginPct: 30, roundingStep: 0 })`; edición; click | venta `'130,00'`; `storedPrefs().enabled` sigue `false` |
| T16 | `en edición, el margen y el redondeo elegidos sí se recuerdan` | edición (sin prefs); click; margen `'50'`; `setStep('10')` | venta `'150,00'`; `storedPrefs()` `toEqual({ enabled: false, marginPct: 50, roundingStep: 10 })` |
| T17 | `si localStorage falla, usa los valores por defecto y el cálculo funciona` | usá el helper `brokenStorage` de G5; dentro de `try { … } finally { vi.unstubAllGlobals() }`: `vi.stubGlobal('localStorage', brokenStorage())` **antes** de `renderModal()`; **sin** click; costo `'1234'`. **No** uses `vi.spyOn(Storage.prototype, …)` (ver la advertencia de A4) | checkbox **tildado** al abrir (default); margen `'30'`; redondeo `'100'`; tras tipear el costo: venta `'1.600,00'`; nada lanza |
| T18 | `teclado: Tab recorre la fila de precios y Espacio tilda` | `const user = userEvent.setup()`; `renderModal()`; `await waitFor(() => expect(nameInput()).toHaveFocus())` (**obligatorio**: deja correr el foco inicial del Modal); `purchaseInput().focus()`; `await user.tab()`; `await user.tab()`; `autoCheckbox().focus()`; `await user.keyboard(' ')`; `purchaseInput().focus()`; 4 × `await user.tab()` | 1.er tab → checkbox con foco; 2.º → `saleInput()` (margen y redondeo deshabilitados se saltean); Espacio → checkbox tildado; con el cálculo activo: checkbox → `marginInput()` → `roundingSelect()` → `saleInput()` |
| T19 | `el orden del DOM es el orden visual y de Tab` | `renderModal()`; armá `[nameInput(), botón /^Categoría/, botón /^Proveedor/, purchaseInput(), autoCheckbox(), marginInput(), roundingSelect(), saleInput(), barcodeInput(), stockInput(), minStockInput()]` | para cada par consecutivo: `expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()` |

> En T3–T11 el checkbox se tilda **antes** de cambiar margen o redondeo (deshabilitados no deben usarse).

- **Checkpoint G6:**
  - `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/Pages/Stock/__tests__/ProductFormModal.test.tsx` → verde.
  - `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run src/Pages/Stock src/ui` → verde.
  - `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx eslint src/Pages/Stock/ProductFormModal.tsx src/Pages/Stock/__tests__/ProductFormModal.test.tsx` → sin errores.
  - `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` → OK.

---

### Fase H — Verificación final y documentación

**Paso H1 — Suite completa, tipos y lint.**
- `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx vitest run` → **68 archivos** (66 + `pricing.test.ts` + `floatingPlacement.test.ts`), **0 fallidos**. Conteo de control: los 66 archivos que ya existían pasan de 850 a **884 tests** (+8 en `EntityPicker.test.tsx`, +2 en `Modal.test.tsx`, +24 en `ProductFormModal.test.tsx`: L1–L5 y T1–T19); a eso se suman unos 140 de `pricing.test.ts` (50 filas de `computeSalePrice` + los demás bloques) y unos 11 de `floatingPlacement.test.ts`. Si te dan menos, falta algún test del plan.
- `cd /c/Users/asant/Music/Integral/wt-producto && npm run typecheck` → OK.
- `cd /c/Users/asant/Music/Integral/wt-producto && npm run lint --workspace renderer` → exactamente los **mismos 7 errores preexistentes** de la sección 0 (3 archivos), ninguno nuevo.
- `cd /c/Users/asant/Music/Integral/wt-producto/renderer && npx eslint src/utils/pricing.ts src/utils/__tests__/pricing.test.ts src/ui/floatingPlacement.ts src/ui/__tests__/floatingPlacement.test.ts src/ui/EntityPicker.tsx src/ui/__tests__/EntityPicker.test.tsx src/ui/Modal.tsx src/ui/__tests__/Modal.test.tsx src/Pages/Stock/ProductFormModal.tsx src/Pages/Stock/__tests__/ProductFormModal.test.tsx` → sin errores.

**Paso H2 — Chequeos estáticos** (desde `/c/Users/asant/Music/Integral/wt-producto`): repetí los 4 comandos del Checkpoint E1 y además `git status --short`, que debe listar **solo**:

```
 M CLAUDE.md                       (después del Paso H4)
 M plan.md
 M renderer/src/Pages/Stock/ProductFormModal.tsx
 M renderer/src/Pages/Stock/__tests__/ProductFormModal.test.tsx
 M renderer/src/styles/app.css
 M renderer/src/ui/EntityPicker.tsx
 M renderer/src/ui/Modal.tsx
 M renderer/src/ui/__tests__/EntityPicker.test.tsx
 M renderer/src/ui/__tests__/Modal.test.tsx
?? renderer/src/ui/__tests__/floatingPlacement.test.ts
?? renderer/src/ui/floatingPlacement.ts
?? renderer/src/utils/__tests__/pricing.test.ts
?? renderer/src/utils/pricing.ts
```

**Paso H3 — Verificación manual a 1280×720 (la hace una persona; el ejecutor solo deja la checklist lista y avisa).** Ver sección 7.

**Paso H4 — Actualizar `CLAUDE.md`.** Insertá la subsección de abajo **al final de "## Estado del frontend"**: justo **después** de la línea que empieza con `- Las clasificaciones de "expired" y "expiring_today" se calculan en el renderer…` y **antes** de la línea `---` que precede a `## IPC bridge (cómo se llama al backend desde el renderer)` (dejá una línea en blanco antes y después). No toques ninguna otra parte de `CLAUDE.md` (el otro agente edita la sección de Estadísticas).

```md
#### Formulario de producto: picker flotante, modal sin scroll y precio con margen (vigente)

- **Picker (Categoría / Proveedor)**: el popover (`.ig-picker-pop.is-floating`) flota con `position: fixed`; `EntityPicker` calcula en línea `top`/`bottom`/`left`/`width`/`max-height` con `computeFloatingPlacement` (`renderer/src/ui/floatingPlacement.ts`) desde el `getBoundingClientRect()` del disparador. Ancho mínimo 420 px (DS); si no entra a la derecha se alinea con el borde derecho del disparador; si abajo hay menos de 360 px y arriba hay más lugar, abre hacia arriba; se recalcula con `resize` y con el `scroll` de cualquier contenedor. **No es un portal**: sigue dentro del DOM del picker, así el focus trap del `Modal`, el click afuera y el `stopPropagation` de Enter/Esc funcionan igual. `Tab` en la lista cierra el popover. Un `fixed` no cuenta para el overflow de sus ancestros (no genera scroll en el modal); dejaría de funcionar si un ancestro tuviera `transform`/`filter`/`contain`.
- **Modal de producto sin scroll a 1280×720**: `Modal` acepta `className`; `ProductFormModal` usa `pf-modal` (1080 px, `max-height: calc(100vh − 32px)`, velo con `padding-top` 16 px vía `:has`) y la grilla `.pf-grid` de 4 columnas: fila 1 Nombre (2 col.) · Categoría · Proveedor; fila 2 Precio de compra · Calcular con margen + Margen (%) · Redondeo · Precio de venta; fila 3 Código de barras (2 col.) · Stock inicial / Stock · Stock mínimo; fila 4 (solo alta con stock > 0) Vencimiento del lote bajo las columnas de stock (`.pf-expiry`). El error "No se pudo guardar el producto…" va en el pie, al lado de los botones. El cuerpo conserva `overflow: auto` solo como red de seguridad. Peor caso calculado: 623 px de alto (disponible ≈ 648).
- **Scrollbars**: globales en `app.css` con `scrollbar-width: thin` y `scrollbar-color: var(--border-control) transparent` sobre `:root` (se heredan). No usar `::-webkit-scrollbar` (Chromium lo ignora si están seteadas las estándar). `color-scheme` sigue al tema (`light`/`dark`) para los controles nativos.
- **Precio con margen** (`renderer/src/utils/pricing.ts`): `venta = redondear(costo × (1 + margen/100), paso)` en centavos enteros; redondeo al múltiplo más cercano (la mitad sube); paso 0 = sin redondeo (al centavo); si el costo es > 0 y el redondeo daría $ 0, queda un paso. Pasos: sin redondeo / 10 / 50 / 100 / 500 / 1000. Margen 0–1000 % (2 decimales; un texto inválido no se aplica y al salir del campo vuelve el último válido).
  - Preferencias globales en `localStorage`, clave `integral.pricing` = `{ enabled, marginPct, roundingStep }` (defaults `true`, `30`, `100`; valores corruptos o fuera de rango → default; storage que falla → defaults sin romper). Se guardan al cambiarlas: el margen cada vez que el texto es válido, el redondeo al elegirlo, `enabled` al tildar/destildar **solo en alta**.
  - Alta: el checkbox arranca según la preferencia. Edición: arranca siempre apagado (no pisa el precio guardado). Con el cálculo activo el precio de venta se recalcula al cambiar costo, margen o redondeo; tipear el precio a mano apaga el cálculo solo para ese producto (no cambia la preferencia); destildar deja el último valor. Sin costo válido el precio queda vacío con la ayuda "Completá el precio de compra para calcularlo."; la ayuda de margen real y el aviso de venta bajo costo siguen igual.
- Tests: `utils/__tests__/pricing.test.ts`, `ui/__tests__/floatingPlacement.test.ts`, casos nuevos en `EntityPicker.test.tsx`, `Modal.test.tsx` y `ProductFormModal.test.tsx` (este último limpia `localStorage` en `beforeEach`). El layout real (sin scroll, popover no recortado, scrollbars) se verifica a mano: happy-dom no hace layout ni aplica CSS. Para simular un `localStorage` roto en tests usar `vi.stubGlobal('localStorage', …)` + `vi.unstubAllGlobals()`: en happy-dom 20.9 `vi.spyOn(Storage.prototype, …)` no intercepta de forma confiable (el proxy de `localStorage` guarda cada método en el primer uso) y el mock puede quedar pegado.
```

- **Checkpoint H4:** `cd /c/Users/asant/Music/Integral/wt-producto && git diff --stat -- CLAUDE.md` → solo inserciones (ninguna línea borrada).

**Paso H5 — Reporte final del ejecutor.** Informá: resultados de H1 (archivos/tests, typecheck, lint), la salida de `git status --short`, y que la verificación manual (sección 7) está pendiente para una persona.

---

## 6. Qué NO se puede testear en happy-dom (y cómo se cubre)

| No se puede testear automáticamente | Por qué | Cómo se cubre |
|---|---|---|
| Que el modal no tenga scroll vertical/horizontal a 1280×720 | happy-dom no calcula layout (`scrollHeight`, anchos, cortes de línea) y no carga `app.css` | Presupuesto de alto (3.2) + verificación manual 7.2/7.3 |
| Que el popover `fixed` no quede recortado por el `overflow` del modal | No hay motor de layout ni CSS | Tests de la estrategia: estilo en línea `position: fixed` + coordenadas (C2-E1…E5) y popover dentro del diálogo (F3-L5) + manual 7.4 |
| `getBoundingClientRect()` real | Devuelve ceros | Se mockea por elemento en C2 |
| Aspecto de las scrollbars, `color-scheme`, `:has()` | CSS no aplicado | Chequeos estáticos E1 + manual 7.6/7.7 |
| Lista nativa del `<select>` y dibujo del checkbox | Son widgets del navegador | Manual 7.5/7.7 |
| A dónde va el foco del navegador cuando `Tab` cierra el popover | `fireEvent` no mueve el foco y user-event no modela el "punto de partida" de Chromium tras quitar el elemento | Test de que se cierra (C2-E7) + manual 7.4 |
| Animaciones de entrada del modal | No se ejecutan | No aplica |

---

## 7. Verificación manual (persona) — ventana 1280×720

**Preparación**
1. Cerrá cualquier Integral abierto (la app instalada y la de dev comparten el bloqueo de instancia única).
2. `cd /c/Users/asant/Music/Integral/wt-producto && env -u ELECTRON_RUN_AS_NODE npm start`
3. Achicá la ventana arrastrando la esquina inferior derecha hasta que no baje más (mínimo 1280×720).
4. La base de dev del worktree puede estar vacía: creá una categoría y un proveedor desde los pickers del alta (sirve para probar el alta en el momento).

**7.1 Alta sin errores.** Stock → `Ctrl+N`. No hay barra de scroll vertical ni horizontal en el modal. Se ven las 3 filas y el pie.
**7.2 Alta en el peor caso.** Tipeá Stock inicial `12` (aparece "Vencimiento del lote" bajo las columnas de stock) y tocá "Guardar producto" con todo vacío: se ven todos los errores **y sigue sin scroll**. Repetí con "Proveedor" sin elegir y un código de barras repetido (error largo).
**7.3 Edición.** Fila → Editar (o `Enter`): sin scroll; "Stock" de solo lectura; "Calcular con margen" destildado; el precio de venta no cambió.
**7.4 Pickers.** Abrí "Categoría" y "Proveedor": el popover se ve completo, encima del formulario, **sin** generar scroll horizontal en el modal; el de Proveedor queda alineado con el borde derecho de su campo. Tipeá un nombre nuevo → `Enter` en "Crear «…»" → el alta (Nombre, Teléfono, Notas, botones) entra entera; `Esc` vuelve a la lista; `Esc` cierra y devuelve el foco al campo; `Tab` desde el buscador cierra el popover y el foco pasa a "Precio de compra" (en Proveedor) o a "Proveedor" (en Categoría); `Shift+Tab` vuelve al disparador. Click en una opción la elige.
**7.5 Precio con margen.** Tildá "Calcular con margen"; Margen `30`; Redondeo `$ 100`; Precio de compra `1234` → Precio de venta `1.600,00` y ayuda "Margen: 29,7 % · ganancia $ 366,00 por unidad". Margen `0` + compra `1570` → `1.600,00`; `1530` → `1.500,00`; `1550` → `1.600,00`. Tipeá un precio a mano: el checkbox se destilda solo. Destildá: el precio queda y se puede editar. Cerrá y reabrí: el checkbox, el margen y el redondeo se recuerdan. Abrí una edición: arranca destildado.
**7.6 Scrollbars (tema claro y oscuro, botón de tema del header).** Finas, pulgar gris azulado, sin riel blanco, en: tabla de Stock con muchos productos, Movimientos, carrito de Ventas con muchas líneas, Historial (lista y detalle), Estadísticas, buscador F2, lista de un picker, popup de vencimientos.
**7.7 Tema oscuro y controles nativos.** El selector "Redondeo" (flecha y lista desplegada) y el checkbox se leen bien; el selector "Medio de pago" del Historial también.
**7.8 Teclado completo del alta.** Tab: Nombre → Categoría → Proveedor → Precio de compra → Calcular con margen → (Margen → Redondeo si está tildado) → Precio de venta → Código de barras → Stock inicial → Stock mínimo → (Vencimiento) → botones. `Ctrl+Enter` guarda desde cualquier campo (incluido el checkbox y el selector). `Esc` con cambios pregunta "¿Descartar los cambios?".
**7.9 Ventana grande.** Maximizada: el modal mide 1080 px y queda centrado.

Si algo de esto falla, anotá el número de chequeo y una captura.

---

## 8. Checklist final

- [ ] A: `pricing.ts` + tests (cálculo, textos, preferencias) en verde.
- [ ] B: `floatingPlacement.ts` + tests en verde.
- [ ] C: `EntityPicker` flotante (`position: fixed`, sin portal, `Tab` cierra en la lista) + tests; tests de pickers y del formulario sin cambios y verdes.
- [ ] D: `Modal` con `className` + tests.
- [ ] E: bloque `/* === Formulario de producto y scrollbars === */` al final de `app.css`; sin `::-webkit-scrollbar`; sin colores hardcodeados; `bundle.css`/`tokens.css`/`design-system/` intactos.
- [ ] F: `pf-modal` + `.pf-grid` de 4 columnas; error de guardado en el pie; `InlineAlert` sin importar.
- [ ] G: checkbox "Calcular con margen", Margen (%), Redondeo; tipear el precio de venta apaga el cálculo solo para ese producto; preferencias en `integral.pricing`; edición arranca apagado; tests T1–T19 en verde.
- [ ] H: suite completa verde (68 archivos), typecheck OK, lint con solo los 7 errores preexistentes, `CLAUDE.md` con la subsección nueva, `git status` con solo los archivos esperados, sin commits.
- [ ] Verificación manual (sección 7) pendiente para una persona.
