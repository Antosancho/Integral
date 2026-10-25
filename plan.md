# Plan — Nueva UI/UX de Integral con el Design System "Integral" (Factor Integral)

> **Para quién es este plan:** un agente de IA (modelo de menor potencia) que lo ejecuta paso a paso. Seguí las fases **en orden**. Cada paso es chico a propósito: hacelo, verificá, seguí. No improvises diseño: todo lo visual sale del design system (DS) que está copiado en `design-system/`.
>
> **Reglas generales para el ejecutor:**
> 1. Trabajá en una rama nueva: `git checkout -b feat/ui-design-system` (Fase 0). No hagas commit sin autorización del usuario; al final de cada fase **proponé** un commit.
> 2. **No modifiques el backend** (`backend/`), ni `electron/ipcContract.ts`, ni `electron/preload.ts`, ni el schema de Prisma. La única excepción es el Paso 1.9 (tamaño mínimo de la ventana en `electron/main.ts`).
> 3. **No toques** `design-system/` (es material de referencia, de solo lectura) ni `backend/prisma/dev.db`.
> 4. `CLAUDE.md` tiene cambios locales del usuario sin commitear (sección "Diseño"): **no los reviertas**. Solo se edita en la Fase 13.
> 5. Al terminar **cada fase** corré, desde la raíz del repo:
>    - `npm --workspace renderer test` → todo verde.
>    - `npm run typecheck` → sin errores.
>    Si algo falla, arreglalo **antes** de pasar a la fase siguiente.
> 6. Cuando una fase cambia un componente que ya tiene tests, **actualizá esos tests en la misma fase** (el plan lista cuáles). Nunca borres un test sin reemplazar lo que cubría, salvo que el plan lo indique.
> 7. Versiones **exactas** (sin `^` ni `~`) para toda dependencia nueva.
> 8. Prohibido en el renderer: colores hex/rgb hardcodeados fuera de `styles/tokens.css` (usar `var(--token)`), `type="number"` en inputs, los glifos `⚠` y `✕` (usar íconos lucide `TriangleAlert` y `X`), emojis.
> 9. Textos: copiar **literalmente** los copys indicados en este plan (vienen de `design-system/guia/03-estados-y-copy.md`). Español rioplatense con voseo.
> 10. Si algo de este plan contradice el DS, **gana este plan** (las decisiones del usuario están en la sección 0.2).

---

## 0. Contexto

### 0.1 Qué hay que hacer

Reemplazar toda la UI del renderer (`renderer/src/`) por la del design system "Integral": tokens de color/tipografía/espaciado, componentes (`ig-…` en `bundle.css`), pantallas y flujos de teclado. Fuente de verdad, en este orden:

1. Este plan.
2. `design-system/README.md` (principios, color, tipografía, íconos, layout).
3. `design-system/guia/01-flujos.md`, `02-teclado-y-foco.md`, `03-estados-y-copy.md`, `04-implementacion.md`.
4. `design-system/components/<Componente>/README.md` y `preview.html` (markup de referencia exacto; abrilo para copiar la estructura de clases). Los previews referencian `/_blob/...` para el logo: ignoralo, en la app se usa el PNG local.
5. `design-system/components/bundle.css` (clases `ig-…`) y `design-system/tokens.css` (variables).
6. `design-system/lamina-de-marca.jpg` (lámina de marca: logo, tipografías, colores).

### 0.2 Decisiones tomadas con el usuario (no re-discutir)

| # | Tema | Decisión |
|---|---|---|
| D1 | Alcance | **Todo lo que sea frontend** del DS: re-skin completo + pantalla **Stock › Movimientos** + filtros de Stock + orden de columnas + menú ⋮ + selector con alta en el momento + atajos + toasts + estados vacío/cargando/error. **Sin cambios de backend**: se omiten los datos que la API no da (columna "Stock resultante" en Movimientos, "Última venta" en Menor rotación, nota de "productos sin precio de compra", metadato "N productos" por proveedor). |
| D2 | Líneas General (F10) | **Se pueden aprobar** (el backend ya las guarda). Se ignora la regla del DS que bloquea APROBAR y su hint "Las líneas General aún no se pueden guardar". |
| D3 | Historial de ventas | Layout del DS (segmentado **Nueva venta \| Historial** dentro de Ventas, maestro–detalle), **conservando** filtros de hora y de monto (fila "Más filtros") y el **Resumen de caja** (debajo del detalle). Se quita la pestaña "Historial" del header y el modal de detalle. |
| D4 | Buscador en Stock | **Ambos**: popup **F2 "Buscar producto"** (estilo DS, elegir abre Editar producto) **y** buscador inline en la toolbar que filtra la tabla (`Ctrl+F`). |
| D5 | Columna de lotes | Se **mantiene** el toggle de vencimientos (botón "Vencimientos" en la toolbar de Stock y columna en el popup F2 de Stock). |
| D6 | Carrito al cambiar de sección | **Store global** (Context por encima de las pantallas): carrito, descuento y pagos sobreviven al cambiar de sección o al ir al Historial. |
| D7 | Tema | **Claro + oscuro con selector** (botón en el header, guardado en `localStorage`, default claro). |
| D8 | Assets | Ya están copiados en `design-system/` (fuentes `.woff2`, logos PNG, CSS, guías). El ejecutor los copia al renderer en la Fase 1. |

### 0.3 Decisiones técnicas tomadas por el arquitecto

- **Íconos:** `lucide-react@0.468.0` (exacta). `size={18}` por defecto, 16 en filas/badges, 22 en el input de código. Si al compilar un nombre no existe en esa versión, usar el alias viejo: `ChartColumn`→`BarChart3`, `EllipsisVertical`→`MoreVertical`, `TriangleAlert`→`AlertTriangle`, `CircleAlert`→`AlertCircle`, `CircleCheck`→`CheckCircle2`.
- **Sin librerías nuevas** de estado, router, modales ni fechas. Solo React + lucide.
- **Fechas:** inputs de texto con máscara `DD/MM/AAAA` (no `<input type="date">`), como pide el DS.
- **Montos:** texto libre + `inputMode="decimal"`, parseo es-AR con `parseDecimal` (Paso 2.2), formateo **al salir** del input.
- **Accesibilidad de nombres existentes:** para minimizar cambios en tests, se conservan estos nombres accesibles: botón `APROBAR VENTA` (el `Kbd F12` lleva `aria-hidden`), inputs de pago con `aria-label` = `EFECTIVO`/`DÉBITO`/…, botones-etiqueta con `aria-label` = `Autocompletar EFECTIVO`…, input de descuento con `aria-label="Descuento"`.
- **Movimientos de stock:** clasificación (Paso 8.1) basada en `type`, `quantity` y `appliedDelta` (ya existen). "Alta inicial" = `type==='IN' && appliedDelta===0 && quantity>0` (así lo crea `productRepository.createProduct`).
- **Splash de 1 s del DS (F1):** fuera de alcance (la base se abre en el main antes de mostrar la ventana).
- **Búsqueda sin tildes en el popup F2:** la búsqueda por nombre la hace el backend (`nameContains`), que no ignora tildes; se acepta la limitación. El **resaltado** de la coincidencia sí ignora tildes. El buscador inline de Stock filtra en el cliente e ignora tildes.

### 0.4 Estado actual relevado (para ubicarte)

- `renderer/src/App.tsx`: estado `content: 'sells'|'stock'|'history'|'stats'`, renderiza `Header` + página.
- `renderer/src/Pages/Header.tsx`: botones Sells/Historial/Stock/Estadísticas + `ExpiryAlertWidget`.
- Stock: `Pages/Stock.tsx` (grilla CSS, popup F2 con `SearchPopup`, toggle de lotes), `Pages/Stock/ProductFormModal.tsx`, `LoadStockModal.tsx`, `CategorySelector.tsx`, `SupplierSelector.tsx`, `validateProductForm.ts`.
- Ventas: `Pages/Sells/Sells.tsx` (estado local con `useReducer(cartReducer)`), `BarcodeInput.tsx`, `CartList.tsx`, `PaymentPanel.tsx`, `SearchPopup.tsx`, `GeneralAmountPopup.tsx`, `cartReducer.ts`, `payments.ts`, `amount.ts`, `confirmSaleUtils.ts`, `searchProducts.ts`, `types.ts`, `lineId.ts`.
- Historial: `Pages/SalesHistory/SalesHistory.tsx`, `SaleDetailModal.tsx`, `CajaSummary.tsx`, `cajaUtils.ts`, `salesHistoryFilters.ts`.
- Estadísticas: `Pages/Stats/Stats.tsx`, `statsUtils.ts`.
- Componentes: `Components/ExpiryAlert/ExpiryAlertWidget.tsx`, `Components/LotsList/LotsList.tsx`.
- Utils: `utils/format.ts` (`formatMoney`), `utils/expiry.ts`, `utils/lots.ts`.
- Tests: Vitest + Testing Library + happy-dom (`renderer/vitest.config.ts`, setup en `src/setupTests.ts`). Hoy hay ~391 tests.
- CSP de producción (`vite.renderer.config.mts`): `font-src 'self' data:` e `img-src 'self' data:` → fuentes y PNG locales funcionan sin cambios.

### 0.5 Mapa de archivos

**Nuevos** (todos bajo `renderer/src/`):

```
assets/fonts/*.woff2                      (8 archivos, copiados)
assets/brand/factor-integral-horizontal-oscuro.png
assets/brand/factor-integral-horizontal-claro.png
styles/tokens.css                         (copia adaptada de design-system/tokens.css)
styles/bundle.css                         (copia exacta de design-system/components/bundle.css)
styles/app.css                            (agregados propios del proyecto)
utils/theme.ts                            utils/parse.ts      utils/text.ts
utils/stock.ts                            utils/dom.ts
ui/Kbd.tsx  ui/ShortcutBar.tsx  ui/Button.tsx  ui/Badge.tsx  ui/Segmented.tsx
ui/Field.tsx  ui/DateField.tsx  ui/InlineAlert.tsx  ui/EmptyState.tsx
ui/TableSkeleton.tsx  ui/Modal.tsx  ui/modalStack.ts  ui/Toast.tsx
ui/MenuButton.tsx  ui/StepIndicator.tsx  ui/EntityPicker.tsx
ui/useRowNavigation.ts  ui/useFlash.ts  ui/useDelayedFlag.ts
ui/__tests__/*.test.tsx
store/SalesContext.tsx  store/__tests__/SalesContext.test.tsx
navigation.ts
Components/AppHeader/AppHeader.tsx  Components/AppHeader/ThemeToggle.tsx
Pages/Stock/StockProducts.tsx         (antes Pages/Stock.tsx)
Pages/Stock/StockPage.tsx             (cabecera + segmentado Productos|Movimientos)
Pages/Stock/StockMovements.tsx  Pages/Stock/movements.ts
Pages/Stock/CategoryPicker.tsx  Pages/Stock/SupplierPicker.tsx
Pages/Sells/SalesPage.tsx             (cabecera + segmentado Nueva venta|Historial)
Pages/Sells/CartTable.tsx  Pages/Sells/EditableCell.tsx  Pages/Sells/ChangeIndicator.tsx
Pages/SalesHistory/SaleDetailCard.tsx
Pages/Stats/StatCard.tsx  Pages/Stats/RankingList.tsx
test/renderWithProviders.tsx  test/fixtures.ts
```

**Eliminados** (en la fase indicada): `Pages/Header.tsx`, `Pages/Stock.tsx`, `Pages/Stock.css`, `Pages/Stock/CreateProductModal.css`, `Pages/Stock/LoadStockModal.css`, `Pages/Stock/CategorySelector.tsx` (+test), `Pages/Stock/SupplierSelector.tsx` (+test), `Pages/Sells/CartList.tsx` (+test), `Pages/Sells/Sells.css`, `Pages/Sells/SearchPopup.css`, `Pages/SalesHistory/SaleDetailModal.tsx` (+css, +test), `Pages/SalesHistory/*.css`, `Pages/Stats/Stats.css`, `Components/ExpiryAlert/ExpiryAlertWidget.css`, `Components/LotsList/LotsList.css`, `App.css`, contenido de `index.css`.

---

## 1. Convenciones que vas a usar en todo el plan

### 1.1 Cómo correr cosas

- Tests del renderer: `npm --workspace renderer test` (todos) o `npx --workspace renderer vitest run src/ui/__tests__/Modal.test.tsx` (uno).
- Typecheck: `npm run typecheck`.
- Lint: `npm --workspace renderer run lint` (anotá la cantidad de errores en la Fase 0; al final no puede haber **más** que al principio).
- App real: `env -u ELECTRON_RUN_AS_NODE npm start` (Bash) o `Remove-Item Env:ELECTRON_RUN_AS_NODE; npm start` (PowerShell).

### 1.2 Textos con espacio duro

`Intl.NumberFormat('es-AR', {style:'currency'})` produce `"$ 1.234,50"` con un **espacio duro** (U+00A0) entre `$` y el número. En tests:
- `screen.getByText('$ 1.234,50')` funciona (el normalizador de Testing Library colapsa espacios, incluido U+00A0).
- `expect(x).toBe('$ 1.234,50')` **no** funciona: usá `expect(x.replace(/ /g, ' ')).toBe('$ 1.234,50')`.

### 1.3 Patrón de íconos

```tsx
import { Plus } from 'lucide-react'
<Plus size={18} strokeWidth={2} aria-hidden="true" className="ig-icon" />
```
Siempre `aria-hidden="true"` en íconos decorativos. Botón solo-ícono → `aria-label` obligatorio.

### 1.4 Helpers de tests (se crean en el Paso 3.0)

- `renderWithProviders(ui)` envuelve en `ToastProvider` + `SalesProvider`.
- `makeProduct(overrides)` devuelve un `ProductFromApi` válido.

---

## Fase 0 — Preparación

**0.1** `git status` → solo debe aparecer `M CLAUDE.md`, `plan.md` y `design-system/` sin trackear. Crear rama: `git checkout -b feat/ui-design-system`.

**0.2** `npm install` en la raíz (el repo puede no tener `node_modules`).

**0.3** Línea de base. Correr y **anotar** en tu respuesta los resultados:
- `npm --workspace renderer test` (cantidad de tests y si pasan).
- `npm run typecheck`.
- `npm --workspace renderer run lint` (cantidad de errores/warnings).
Si los tests del renderer **no** pasan en la base, frená y avisale al usuario.

**0.4** Leé completos: `design-system/README.md`, las 4 guías de `design-system/guia/` y `design-system/components/bundle.css`. No sigas sin haberlos leído.

---

## Fase 1 — Fundaciones (estilos, fuentes, logos, tema)

**1.1 Dependencia de íconos.** `npm install --workspace renderer --save-exact lucide-react@0.468.0`. Verificá que `renderer/package.json` tenga `"lucide-react": "0.468.0"` en `dependencies`.

**1.2 Fuentes.** Copiá los 8 archivos `design-system/fonts/*.woff2` a `renderer/src/assets/fonts/` (mismos nombres).

**1.3 Logos.** Copiá `design-system/logos/factor-integral-horizontal-oscuro.png` y `factor-integral-horizontal-claro.png` a `renderer/src/assets/brand/`.

**1.4 tokens.css.** Copiá `design-system/tokens.css` a `renderer/src/styles/tokens.css` y reemplazá en las 8 reglas `@font-face` `url("fonts/` por `url("../assets/fonts/`. Nada más.

**1.5 bundle.css.** Copiá `design-system/components/bundle.css` a `renderer/src/styles/bundle.css` **sin cambios**.

**1.6 app.css.** Creá `renderer/src/styles/app.css` con exactamente estos agregados (son clases que el DS usa en los previews pero no define, o adaptaciones a botones en vez de `<a>`). Usá solo tokens:

```css
/* Integral — agregados propios del proyecto sobre bundle.css */
html, body, #root { height: 100%; }
.ig-app { height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
.app-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.ig-page { overflow: auto; }

/* Header: la nav usa <button> en vez de <a> */
.ig-nav button { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 var(--space-4); border: 0; border-radius: var(--radius-pill);
  background: transparent; color: var(--ink-on-header-muted); font: 700 15px/20px var(--font-display); cursor: pointer; }
.ig-nav button:hover { color: var(--ink-on-brand); background: rgba(255,255,255,.08); }
.ig-nav button[aria-current="page"] { color: var(--brand-night); background: var(--brand-white); }
.ig-header .ig-brand { background: none; border: 0; padding: 0; cursor: pointer; }
.ig-header .ig-brand img.ig-logo { width: auto; height: 30px; border-radius: 0; }
.ig-theme-toggle { color: var(--ink-on-header-muted); }
.ig-theme-toggle:hover { color: var(--ink-on-brand); background: rgba(255,255,255,.08); }

/* Toasts */
.ig-toast-stack { position: fixed; top: calc(var(--header-height) + var(--space-4)); right: var(--space-6); z-index: var(--z-popover); display: grid; gap: var(--space-2); }
.ig-toast.info .tone { background: var(--info-soft); color: var(--info); }
.ig-toast .count { margin-left: auto; font: 600 12px/16px var(--font-sans); color: var(--ink-muted); }

/* Popovers anclados */
.ig-anchor { position: relative; }
.ig-anchor > .ig-picker-pop, .ig-anchor > .ig-menu { position: absolute; top: calc(100% + 4px); left: 0; z-index: var(--z-popover); }
.ig-anchor > .ig-expiry-pop { position: absolute; top: calc(100% + 8px); right: 0; z-index: var(--z-popover); color: var(--ink); text-align: left; }
.ig-menu { min-width: 240px; padding: var(--space-1) 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: var(--shadow-md); list-style: none; margin: 0; }
.ig-menu button { display: flex; align-items: center; gap: var(--space-2); width: 100%; height: 40px; padding: 0 var(--space-4); border: 0; background: transparent; color: var(--ink); font: 400 15px/22px var(--font-sans); text-align: left; cursor: pointer; }
.ig-menu button:hover, .ig-menu button.is-active { background: var(--surface-selected); }
.ig-anchor-right > .ig-menu { left: auto; right: 0; }

/* Tablas */
.ig-grid:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
.ig-th-sort { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; padding: 0; }
.ig-table tbody tr.ig-row-flash td { animation: ig-flash .6s ease-out; }
@keyframes ig-flash { from { background: var(--surface-selected); } to { background: transparent; } }
.ig-table td.is-modified-col { color: var(--info); }
.ig-cell-orig { font-size: 12px; line-height: 16px; color: var(--ink-subtle); text-align: right; padding-right: 10px; }
.ig-link { border: 0; background: none; padding: 0; color: var(--link); font: inherit; text-decoration: underline; cursor: pointer; }
.ig-muted { color: var(--ink-muted); }
.ig-sub { color: var(--ink-muted); font-size: 13px; line-height: 18px; }

/* Ventas */
.ig-scan.is-idle .ig-scan-state { color: var(--warning); }
.ig-scan:focus-within { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
.ig-pay-row .ig-input.is-recargo { color: var(--warning); }
.sales-scroll { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: var(--space-3); }

/* Layouts de pantallas */
.ig-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
.ig-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.ig-master-detail { display: grid; grid-template-columns: 1.25fr 1fr; gap: var(--space-4); flex: 1; min-height: 0; }
.ig-master-detail > * { overflow: auto; }
.ig-bar { height: 10px; border-radius: 5px; background: var(--surface-sunken); }
.ig-bar > i { display: block; height: 10px; border-radius: 5px; background: var(--chart-2); }
.ig-bar > i.is-peak { background: var(--chart-1); }
select.ig-input { appearance: auto; }

/* Modal: entrada */
.ig-overlay { animation: ig-fade .12s ease-out; }
.ig-overlay > .ig-modal { animation: ig-rise .16s ease-out; }
@keyframes ig-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ig-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ig-overlay > .ig-modal { animation: ig-fade .12s ease-out; } .ig-table tbody tr.ig-row-flash td { animation: none; } }
```

**1.7 Entry del renderer.** En `renderer/src/main.tsx`:
- Reemplazar `import './index.css'` por, en este orden:
  ```ts
  import './styles/tokens.css'
  import './styles/bundle.css'
  import './styles/app.css'
  import { applyTheme, getStoredTheme } from './utils/theme'
  applyTheme(getStoredTheme())
  ```
  (la llamada va antes de `createRoot`).
- Borrar `renderer/src/index.css`. En `App.tsx` quitar `import "./App.css"` y borrar `renderer/src/App.css`.

**1.8 utils/theme.ts.** Crear:

```ts
export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'integral.theme'

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function saveTheme(theme: Theme): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* sin storage: solo esta sesión */ }
  applyTheme(theme)
}
```

Test `renderer/src/utils/__tests__/theme.test.ts`:
- `getStoredTheme()` devuelve `'light'` sin nada guardado.
- Con `localStorage.setItem('integral.theme','dark')` devuelve `'dark'`; con un valor raro (`'azul'`) devuelve `'light'`.
- Si `localStorage.getItem` lanza (`vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error()})`) devuelve `'light'`.
- `saveTheme('dark')` deja `document.documentElement.dataset.theme === 'dark'` y guarda en storage.
- `beforeEach`: `localStorage.clear(); delete document.documentElement.dataset.theme`.

**1.9 Ventana mínima (único cambio en electron).** En `electron/main.ts`, en `new BrowserWindow({...})`: `width: 1366, height: 768, minWidth: 1280, minHeight: 720`. No cambies nada más del archivo.

**1.10 Verificación de la fase.** Tests + typecheck. Los tests existentes siguen pasando (todavía no cambió ningún componente). Corré la app y confirmá a ojo que el fondo pasó a gris claro (`--bg`) y la tipografía a IBM Plex Sans (la UI vieja se verá rara: es esperado).

---

## Fase 2 — Utilidades puras (formato, parseo, texto, stock, DOM)

> Todas son funciones puras con tests exhaustivos: son la base de todo lo demás. Escribí primero el test, después la función.

**2.1 `utils/format.ts`** — reemplazar el contenido por:

```ts
const moneyFmt = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amountFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const intFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const MINUS = '−' // signo menos tipográfico

/** "$ 1.234,50"; negativos con "−". Si no es número devuelve el valor tal cual. */
export function formatMoney(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return String(value)
  const s = moneyFmt.format(Math.abs(n))
  return n < 0 ? `${MINUS}${s}` : s
}
/** Valor para mostrar dentro de un input de monto, sin "$": "1.234,50". '' si no es número. */
export function formatAmountInput(value: string | number | null): string { ... }
/** Enteros con separador de miles: 1284 → "1.284"; negativos con "−". */
export function formatInt(n: number): string { ... }
/** Con signo explícito: 24 → "+24", -2 → "−2", 0 → "0". */
export function formatSignedInt(n: number): string { ... }
/** 12.4 → "+12,4 %", -2.3 → "−2,3 %", 0 → "0,0 %". null → "—". */
export function formatPct(n: number | null): string { ... }
/** Fecha local → "24/10/2026". */
export function formatDate(d: Date): string { ... }
/** Fecha local → "24/10". */
export function formatDayMonth(d: Date): string { ... }
/** Hora local → "18:42". */
export function formatTime(d: Date): string { ... }
/** "24/10 18:42". */
export function formatDayMonthTime(d: Date): string { ... }
```

Implementación de fechas: con `getDate()/getMonth()/getFullYear()/getHours()/getMinutes()` y `padStart(2,'0')` (zona local, sin `Intl` para que los tests sean deterministas).

Tests `utils/__tests__/format.test.ts` (normalizá U+00A0 a espacio antes de comparar):
- `formatMoney(1234.5)` → `"$ 1.234,50"`; `formatMoney('1000')` → `"$ 1.000,00"`; `formatMoney(0)` → `"$ 0,00"`; `formatMoney(-3)` → `"−$ 3,00"`; `formatMoney('abc')` → `"abc"`.
- `formatAmountInput(4890)` → `"4.890,00"`; `formatAmountInput('1450.5')` → `"1.450,50"`; `formatAmountInput(null)` → `''`; `formatAmountInput('x')` → `''`.
- `formatInt(1284)` → `"1.284"`; `formatSignedInt(24)` → `"+24"`; `formatSignedInt(-2)` → `"−2"`; `formatSignedInt(0)` → `"0"`.
- `formatPct(12.4)` → `"+12,4 %"`; `formatPct(-2.345)` → `"−2,3 %"`; `formatPct(0)` → `"0,0 %"`; `formatPct(null)` → `"—"`.
- `formatDate(new Date(2026, 9, 4))` → `"04/10/2026"`; `formatDayMonthTime(new Date(2026, 9, 24, 8, 5))` → `"24/10 08:05"`.

> Ojo: `formatMoney` ahora usa `−` en negativos. Buscá usos que concatenen `-` delante (`SaleDetailModal`) — se reescriben en la Fase 10. En `Pages/Stats/statsUtils.ts` seguí re-exportando `formatMoney` desde `utils/format`.

**2.2 `utils/parse.ts`** — crear:

```ts
/**
 * Parseo de montos es-AR.
 * "1.234,50" | "1234,50" | "1234.50" | "$ 1.234" | "−5" → número; vacío o inválido → null.
 * Regla de puntos sin coma: si el texto es /^\d{1,3}(\.\d{3})+$/ los puntos son de miles ("1.500" → 1500);
 * si no, el punto es decimal ("2.5" → 2.5).
 */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/[\s$ ]/g, '').replace(/−/g, '-')
  if (s === '') return null
  let norm: string
  if (s.includes(',')) norm = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, '')
  else norm = s
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

/** Enteros: "24" → 24, "−2"/"-2" → -2, " 7 " → 7; "2,5", "abc", "" → null. */
export function parseInteger(input: string): number | null { ... }

/** "DD/MM/AAAA" → Date local 00:00; valida día/mes reales (31/02 → null). */
export function parseDateAR(input: string): Date | null { ... }

/** Máscara mientras se tipea: deja solo dígitos (máx 8) e inserta "/" → "24102026" → "24/10/2026", "241" → "24/1". */
export function maskDateInput(raw: string): string { ... }
```

Tests `utils/__tests__/parse.test.ts` (uno por línea, con `it.each`):
- parseDecimal: `"1.234,50"→1234.5`, `"1234,50"→1234.5`, `"1234.50"→1234.5`, `"1.500"→1500`, `"2.5"→2.5`, `"$ 1.234"→1234`, `"−5"→-5`, `"-5,5"→-5.5`, `"0"→0`, `""→null`, `"  "→null`, `"abc"→null`, `"1,2,3"→null`, `"1..2"→null`, `"10.000,00"→10000`.
- parseInteger: `"24"→24`, `"−2"→-2`, `"-2"→-2`, `" 7 "→7`, `"0"→0`, `"2,5"→null`, `"2.5"→null`, `"abc"→null`, `""→null`.
- parseDateAR: `"24/10/2026"` → Date con `getFullYear()==2026, getMonth()==9, getDate()==24, getHours()==0`; `"31/02/2026"→null`; `"00/10/2026"→null`; `"24/13/2026"→null`; `"2026-10-24"→null`; `""→null`; `"1/1/2026"→null` (exige 2 dígitos).
- maskDateInput: `"24102026"→"24/10/2026"`, `"241"→"24/1"`, `"24"→"24"`, `"24/10/2026x"→"24/10/2026"`, `"240"→"24/0"`, `"123456789"→"12/34/5678"`.

**2.3 `utils/text.ts`** — crear:

```ts
/** Quita tildes y pasa a minúsculas, conservando el largo (1 carácter → 1 carácter). */
export function foldText(s: string): string {
  return Array.from(s).map((ch) => ch.normalize('NFD')[0].toLowerCase()).join('')
}
/** Divide `text` en segmentos marcando la primera coincidencia de `query` (sin tildes ni mayúsculas). */
export function splitMatch(text: string, query: string): { text: string; match: boolean }[] { ... }
/** true si `text` contiene `query` ignorando tildes y mayúsculas. Query vacía → true. */
export function includesFolded(text: string, query: string): boolean { ... }
```

`splitMatch` usa `foldText(text).indexOf(foldText(query.trim()))` y corta `text` (original) con esos índices. Query vacía o sin coincidencia → `[{ text, match: false }]`.

Tests `utils/__tests__/text.test.ts`:
- `foldText('Serenísima')` → `'serenisima'` y mismo largo que el original.
- `splitMatch('Yerba Playadito', 'yer')` → `[{text:'Yer',match:true},{text:'ba Playadito',match:false}]`.
- `splitMatch('La Serenísima', 'serenisima')` → `[{text:'La ',match:false},{text:'Serenísima',match:true}]`.
- `splitMatch('Leche', 'xyz')` → `[{text:'Leche',match:false}]`; `splitMatch('Leche','')` igual.
- `includesFolded('Serenísima','SERENI')` → true; `includesFolded('Leche','yerba')` → false; `includesFolded('x','')` → true.

**2.4 `utils/stock.ts`** — crear:

```ts
export type StockTone = 'negative' | 'low' | null
/** negativo si stock < 0; bajo si 0 <= stock <= minStock; si no, null. */
export function stockTone(p: { stock: number; minStock: number }): StockTone { ... }
export function hasValidSalePrice(p: { salePrice: string }): boolean { ... } // número finito > 0 (misma regla que hoy usa Sells.hasValidPrice)
```

Tests: `{stock:-3,minStock:5}→'negative'`, `{stock:0,minStock:0}→'low'`, `{stock:6,minStock:8}→'low'`, `{stock:8,minStock:8}→'low'`, `{stock:9,minStock:8}→null`. `hasValidSalePrice`: `'0'→false`, `''→false`, `'abc'→false`, `'10'→true`, `'0.5'→true`.

**2.5 `utils/dom.ts`** — crear:

```ts
/** true si el target es un campo editable (input, textarea, select o contentEditable). */
export function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}
/** scrollIntoView seguro (happy-dom no lo implementa). */
export function scrollIntoViewSafe(el: Element | null): void {
  if (el && typeof (el as HTMLElement).scrollIntoView === 'function') (el as HTMLElement).scrollIntoView({ block: 'nearest' })
}
```

Tests: input/textarea/select → true; div/button/null → false.

**2.6 Verificación de la fase.** Tests + typecheck. Revisá que los tests viejos que usan `formatMoney` sigan pasando (debería: solo cambia negativos).

---

## Fase 3 — Componentes base del DS (`renderer/src/ui/`)

> Cada componente: archivo `.tsx` + test en `ui/__tests__/`. Copiá las clases del `preview.html` correspondiente. Ningún componente de `ui/` llama a `window.api`.

**3.0 Helpers de test.**
- `renderer/src/test/fixtures.ts`: `export function makeProduct(o: Partial<ProductFromApi> = {}): ProductFromApi` con defaults: `id:1, name:'Producto 1', barcode:7790000000001n, purchasePrice:'500', salePrice:'1000', stock:10, minStock:2, createdAt:new Date(2026,0,1), categoryId:1, supplierId:1, category:{id:1,name:'Almacén'}, supplier:{id:1,name:'Distribuidora Sur',phone:null,notes:null}`.
- `renderer/src/test/renderWithProviders.tsx`: `render(<ToastProvider><SalesProvider>{ui}</SalesProvider></ToastProvider>)` (crealo recién cuando existan ambos providers: Pasos 3.11 y 4.2; hasta ahí exportá solo `ToastProvider`).

**3.1 `Kbd.tsx`.** `export function Kbd({ children }: { children: string })` → `<kbd className="ig-kbd" aria-hidden="true">{children}</kbd>`. Test: renderiza el texto con clase `ig-kbd` y `aria-hidden`.

**3.2 `ShortcutBar.tsx`.** Props `{ items: { keys: string[]; label: string }[] }`. Render: `<div className="ig-shortcuts">` y por ítem `<span>{keys.map(k => <Kbd key={k}>{k}</Kbd>)} {label}</span>`. Para combinaciones (`['Ctrl','Enter']`) intercalá un `+` entre Kbds. Test: 2 ítems → 2 spans, el texto `Elegir` visible.

**3.3 `Button.tsx`.**
```ts
type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'edit' | 'danger'   // default 'secondary'
  size?: 'sm' | 'md' | 'lg' | 'xl'                                   // default 'md'
  icon?: LucideIcon
  iconOnly?: boolean   // agrega ig-btn-icon; exige aria-label
  shortcut?: string    // muestra <Kbd> a la derecha
  children?: React.ReactNode
}
```
Clases: `ig-btn ig-btn-{variant}` + (`ig-btn-sm|lg|xl` si no es md) + (`ig-btn-icon` si iconOnly) + `className`. `type="button"` por defecto. Ícono: `size` 16 si sm, 22 si xl, si no 18. Usá `forwardRef`.
Tests: clases por variante/tamaño; `shortcut="F2"` muestra `F2` y el nombre accesible del botón **no** incluye "F2" (`getByRole('button',{name:'Buscar'})`); `disabled` funciona; default `type="button"`.

**3.4 `Badge.tsx`.** Props `{ tone: 'neutral'|'danger'|'warning'|'success'|'info'; icon?: LucideIcon; children; title? }` → `<span className={`ig-badge ig-badge-${tone}`}>`. Ícono 14px. Test simple.

**3.5 `Segmented.tsx`.**
```ts
type SegmentedProps<V extends string> = { options: { value: V; label: string; icon?: LucideIcon }[]; value: V; onChange: (v: V) => void; ariaLabel: string }
```
`<div className="ig-seg" role="tablist" aria-label>` con `<button role="tab" aria-selected>`. Tab-stop único: el seleccionado `tabIndex=0`, el resto `-1`. ←/→ cambian la selección (llaman `onChange`) y mueven el foco. Tests: click llama `onChange`; ArrowRight desde el primero llama `onChange` con el segundo; `aria-selected` correcto.

**3.6 `Field.tsx`.** Componente contenedor + inputs:
```ts
type FieldProps = { label: string; htmlFor: string; required?: boolean; help?: React.ReactNode; error?: string | null; className?: string; children: React.ReactNode }
```
Render: `<div className={`ig-field ${className??''}`}><label className="ig-label" htmlFor>{label}{required && <span className="req">*</span>}</label>{children}{error ? <span className="ig-error" id={`${htmlFor}-error`}><CircleAlert size={16}/>{error}</span> : help ? <span className="ig-help" id={`${htmlFor}-help`}>{help}</span> : null}</div>`.
- Agregá `export const inputClass = (opts: { error?: boolean; amount?: boolean; lg?: boolean; mono?: boolean }) => string` que arma `ig-input` + `is-error` + `ig-input-amount` + `ig-input-lg`. Para mono usá `style={{ fontFamily: 'var(--font-mono)' }}` en el input (permitido: no es color).
- El input hijo debe llevar `aria-invalid={!!error}` y `aria-describedby` apuntando al id de error/ayuda (responsabilidad del que lo usa; documentalo en un comentario).
Tests: label asociado (`getByLabelText('Nombre')` encuentra el input hijo), muestra `*`, muestra error en lugar de ayuda.

**3.7 `DateField.tsx`.** Input de texto con máscara:
```ts
type DateFieldProps = { id: string; label: string; value: string; onChange: (masked: string) => void; error?: string | null; help?: string; required?: boolean; className?: string; inputRef?: React.Ref<HTMLInputElement>; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> }
```
Usa `Field` + `<input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} className="ig-input" value onChange={e => onChange(maskDateInput(e.target.value))}/>`. Tests: tipear `24102026` (fireEvent.change) llama `onChange('24/10/2026')`; placeholder correcto; label asociado.

**3.8 `InlineAlert.tsx`.** Props `{ tone; title?: string; children?; action?: ReactNode }`. Ícono por tono: danger `TriangleAlert`, warning `ArrowDown`, info `Info`, success `CircleCheck`. Markup: `<div className={`ig-alert ig-alert-${tone}`} role="status"><Icon/><div className="ig-alert-body">{title && <strong>{title}</strong>}{children && <span>{children}</span>}</div>{action}</div>`. Test: renderiza título, texto y acción.

**3.9 `EmptyState.tsx`.** Props `{ icon: LucideIcon; title: string; description?: string; action?: ReactNode; tone?: 'neutral'|'danger' }`. Markup como `States/preview.html`: `<div className="ig-empty"><div className="ico" ...>` (tone danger → `style={{ background:'var(--danger-soft)', color:'var(--danger)' }}`). Test simple.

**3.10 `useDelayedFlag.ts` + `TableSkeleton.tsx`.**
- `useDelayedFlag(active: boolean, delayMs = 300): boolean` → devuelve `true` solo si `active` sigue `true` después de `delayMs` (para que el skeleton no parpadee).
- `TableSkeleton({ rows = 8, cols = 4, label = 'Cargando…' })` → `<div className="ig-card" style={{padding:20, display:'grid', gap:18}} aria-busy="true">` con filas de `<i className="ig-skel"/>` en grilla y `<div className="ig-help" style={{textAlign:'center'}}>{label}</div>`.
- Tests con `vi.useFakeTimers()`: `useDelayedFlag(true)` es false al inicio y true tras `vi.advanceTimersByTime(300)`; si pasa a false antes, queda false. `TableSkeleton rows={3}` renderiza 3 filas.

**3.11 `Toast.tsx` (ToastProvider + useToast).**

```ts
export type ToastTone = 'danger' | 'warning' | 'success' | 'info'
export type ToastOptions = { tone: ToastTone; title: string; detail?: string }
type ToastItem = ToastOptions & { id: number; key: string; count: number; version: number }
```
Reglas (de `Alert/README.md`):
- `show(opts)`: `key = tone|title|detail`. Si ya existe un toast con esa key → `count+1`, `version+1` (reinicia su timer) y lo sube arriba. Si no, lo agrega **arriba**. Máximo 3: se descartan los más viejos.
- Duración: 4000 ms; 6000 ms si tiene `detail`. Hover pausa (onMouseEnter limpia el timer; onMouseLeave lo reinicia completo).
- No toma foco. Contenedor `<div className="ig-toast-stack">`; cada toast `<div className={`ig-toast ${tone}`} role="status" aria-live="polite">` con `<span className="tone">` (ícono: danger `CircleAlert`, warning `TriangleAlert`, success `CircleCheck`, info `Info`, 16px), `<div>{title}{detail && <small>{detail}</small>}</div>` y `{count>1 && <span className="count">×{count}</span>}`.
- Cada toast es un subcomponente con su propio `useEffect` que arma `setTimeout(onExpire, dur)` y depende de `version`.
- `useToast()` lanza `Error('useToast fuera de ToastProvider')` si no hay provider.

Tests `ui/__tests__/Toast.test.tsx` (fake timers; un componente de prueba con botones que llaman `show`):
1. muestra título y detalle; `role="status"`.
2. desaparece a los 4000 ms sin detalle y a los 6000 ms con detalle (no antes).
3. mismo toast dos veces → un solo toast con `×2`, y el timer se reinicia (a los 4000 ms del segundo show recién desaparece).
4. 4 toasts distintos → quedan 3, el más nuevo primero.
5. no roba el foco: con un input enfocado, `show()` no cambia `document.activeElement`.
6. `useToast` sin provider lanza.

**3.12 `modalStack.ts` + `Modal.tsx`.**

`modalStack.ts`:
```ts
let openCount = 0
export function pushModal(): void { openCount += 1 }
export function popModal(): void { openCount = Math.max(0, openCount - 1) }
export function openModalCount(): number { return openCount }
```

`Modal.tsx`:
```ts
type ModalProps = {
  open: boolean
  title: string
  subtitle?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'              // default 'md'
  onClose: () => void
  onEscape?: () => void                  // default: onClose
  closeOnOverlay?: boolean               // default false
  headerExtra?: React.ReactNode          // va entre el título y la X (ej. ShortcutBar "F2 cierra" o StepIndicator)
  hideCloseButton?: boolean
  shortcuts?: { keys: string[]; label: string }[]  // pie, a la izquierda
  footer?: React.ReactNode               // pie, a la derecha (botones)
  initialFocusRef?: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}
```
Comportamiento (implementarlo **exactamente** así):
1. Si `!open` → `return null`.
2. Se renderiza con `createPortal(..., document.body)`: `<div className="ig-overlay" onMouseDown={e => { if (closeOnOverlay && e.target === e.currentTarget) onClose() }}><div className={`ig-modal ${size==='sm'?'ig-modal-sm':size==='lg'?'ig-modal-lg':''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef} onKeyDown={handleKeyDown}>`.
3. Cabecera `ig-modal-head`: `<div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}{headerExtra}</div>` + botón `Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Cerrar" onClick={onClose}` (salvo `hideCloseButton`). `titleId` con `useId()`.
4. Cuerpo `ig-modal-body`; pie `ig-modal-foot` solo si hay `shortcuts` o `footer`.
5. Al abrir (`useEffect` con `[open]`): `pushModal()`; guardar `document.activeElement` en un ref (`returnFocus`); `setTimeout(0)` → enfocar `initialFocusRef.current` o, si no hay, el primer focusable dentro de `.ig-modal-body`, o el diálogo. Cleanup: `popModal()` y, si `returnFocus.current` sigue en el documento, `focus()`.
6. `handleKeyDown`:
   - `Escape` y `!e.defaultPrevented` → `e.preventDefault(); e.stopPropagation(); (onEscape ?? onClose)()`.
   - `Tab` → focus trap: lista de focusables con el selector `'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'` dentro del diálogo; si `shiftKey` y el activo es el primero → enfocar el último y `preventDefault`; si no `shiftKey` y es el último → el primero.
   - El `stopPropagation` en Escape es obligatorio: los eventos de React atraviesan portales, y sin esto un modal anidado cerraría también al de afuera.

Tests `ui/__tests__/Modal.test.tsx`:
1. `open=false` no renderiza nada.
2. `open` → `role="dialog"` con nombre = title; subtitle visible.
3. Escape llama `onClose`; con `onEscape` llama `onEscape` y **no** `onClose`.
4. Click (mouseDown) en el overlay: con `closeOnOverlay` cierra; sin él no.
5. Foco inicial va al primer input del cuerpo (usar `await waitFor`).
6. Focus trap: con foco en el último botón, `Tab` lleva al primero; `Shift+Tab` desde el primero al último (`fireEvent.keyDown(dialog,{key:'Tab'})` y verificar `document.activeElement`).
7. Al cerrar (rerender con `open=false`), el foco vuelve al botón que lo abrió.
8. `openModalCount()` vale 1 con el modal abierto y 0 al cerrarlo.
9. Modal anidado: Escape en el interno cierra solo el interno.

**3.13 `MenuButton.tsx`** (menú ⋮ y filtro de categoría).
```ts
type MenuItem = { id: string; label: string; icon?: LucideIcon; checked?: boolean; onSelect: () => void }
type MenuButtonProps = { label: string; items: MenuItem[]; iconOnly?: boolean; icon?: LucideIcon; variant?: 'secondary'|'ghost'; size?: 'sm'|'md'; align?: 'left'|'right'; buttonText?: React.ReactNode }
```
- Contenedor `<div className={`ig-anchor ${align==='right'?'ig-anchor-right':''}`}>`; botón con `aria-haspopup="menu"` y `aria-expanded`; si `iconOnly` → `aria-label={label}`.
- Abierto: `<ul className="ig-menu" role="menu">` con `<li role="none"><button role="menuitem" ...>`; si `checked` mostrar ícono `Check`.
- Abrir con click, Enter, Espacio o ↓ → foco al primer ítem. ↑/↓ mueven entre ítems; Enter/click → `onSelect()` y cerrar; Esc → cerrar, `stopPropagation`, foco vuelve al botón. Click afuera (listener `mousedown` en `document`) cierra.
Tests: abre con click y muestra ítems; ↓ mueve foco; Enter ejecuta `onSelect` y cierra; Esc cierra y devuelve el foco; click afuera cierra.

**3.14 `StepIndicator.tsx`.** Props `{ steps: string[]; current: number }` (0-based). Markup de `ScreenLoadStock/preview.html`: `ig-steps` con `step is-done` (dot con ícono `Check`), `step is-current`, `line` entre pasos. Test: con `current=1` el primero tiene `is-done` y el segundo `is-current`.

**3.15 `useRowNavigation.ts`.**
```ts
/** Navegación por teclado de una tabla con un único tab-stop (patrón grid). */
export function useRowNavigation<K extends string | number>(opts: {
  keys: K[]; activeKey: K | null; setActiveKey: (k: K) => void; onActivate?: (k: K) => void; rowDomId: (k: K) => string
}): (e: React.KeyboardEvent) => void
```
El handler devuelto: `ArrowDown`/`ArrowUp` → siguiente/anterior (si `activeKey` es null, el primero), `Home`/`End` → primero/último, `Enter` → `onActivate(activeKey)`. Siempre `preventDefault` en esas teclas y `scrollIntoViewSafe(document.getElementById(rowDomId(k)))`. No hace nada con listas vacías.
Tests con un componente de prueba: ↓ desde null activa el primero; ↓ en el último se queda; End va al último; Enter llama `onActivate` con el activo.

**3.16 `useFlash.ts`.** `useFlash<K>(): [K | null, (k: K) => void]` — setea la key y la limpia a los 600 ms (timer limpiado en unmount). Test con fake timers.

**3.17 Verificación de la fase.** Tests + typecheck. Nada visible cambió todavía en la app.

---

## Fase 4 — Shell de la app (navegación, header, tema, toasts, store de ventas)

**4.1 `navigation.ts`** (reemplaza `renderTypes.ts`):

```ts
export type Section = 'stock' | 'sells' | 'stats'
export type StockView = 'products' | 'movements'
export type SalesView = 'new' | 'history'
export type NavState = {
  section: Section
  stockView: StockView
  salesView: SalesView
  /** Producto con el que se abre Movimientos (desde ⋮ o desde Estadísticas). */
  movementsProduct: { id: number; name: string } | null
  /** Venta a seleccionar al abrir el Historial (desde Movimientos). */
  historySaleId: number | null
}
export const initialNav: NavState = { section: 'stock', stockView: 'products', salesView: 'new', movementsProduct: null, historySaleId: null }
export type Navigate = (patch: Partial<NavState>) => void
```
Borrá `renderTypes.ts` y reemplazá sus imports por `navigation.ts`.

**4.2 `store/SalesContext.tsx`.**

```ts
type SalesContextValue = {
  cart: CartState
  dispatchCart: React.Dispatch<CartAction>
  discountPct: number
  setDiscountPct: (n: number) => void
  payments: PaymentsDraft
  setPayments: React.Dispatch<React.SetStateAction<PaymentsDraft>>
  /** Vacía carrito, descuento a 0 y pagos a ''. */
  resetSale: () => void
}
export function SalesProvider({ children }: { children: React.ReactNode }) { /* useReducer(cartReducer, initialCart) + useState */ }
export function useSales(): SalesContextValue  // lanza Error('useSales fuera de SalesProvider')
```
Tests `store/__tests__/SalesContext.test.tsx`: agregar un producto vía `dispatchCart({type:'ADD',...})` y verlo reflejado; `resetSale` deja todo vacío/0/''; el estado **sobrevive** a desmontar y volver a montar un hijo (renderizar el provider con un hijo condicional, ocultarlo y mostrarlo de nuevo, y verificar que el carrito sigue con 1 línea); `useSales` sin provider lanza.

Ahora completá `test/renderWithProviders.tsx` (Paso 3.0).

**4.3 `Components/AppHeader/ThemeToggle.tsx`.** Botón `ig-btn ig-btn-ghost ig-btn-sm ig-btn-icon ig-theme-toggle`; estado inicial `getStoredTheme()`; ícono `Moon` cuando el tema es claro (aria-label `"Activar tema oscuro"`) y `Sun` cuando es oscuro (aria-label `"Activar tema claro"`); click → `saveTheme(next)`. Test: click cambia `document.documentElement.dataset.theme` a `dark` y el aria-label; segundo click vuelve a `light`.

**4.4 `Components/AppHeader/AppHeader.tsx`.** Props `{ section: Section; onNavigate: (s: Section) => void }`. Markup (de `AppHeader/preview.html`):
```tsx
<header className="ig-header">
  <button type="button" className="ig-brand" aria-label="Factor Integral — ir a Stock" onClick={() => onNavigate('stock')}>
    <img className="ig-logo" src={logoDark} alt="Factor Integral" />
  </button>
  <nav className="ig-nav" aria-label="Secciones">
    {/* 3 botones: Stock (Package) · Ventas (ShoppingCart) · Estadísticas (ChartColumn); ícono 16px; aria-current="page" en el activo; title con el atajo ("Ctrl+1") */}
  </nav>
  <div className="ig-spacer" />
  <ExpiryAlertWidget />
  <ThemeToggle />
</header>
```
`logoDark` = `import logoDark from '../../assets/brand/factor-integral-horizontal-oscuro.png'`.
Tests `Components/AppHeader/__tests__/AppHeader.test.tsx` (mockeá `window.api.listExpiringStockMovements` → `[]`): muestra botones Stock/Ventas/Estadísticas; el activo tiene `aria-current="page"`; click en "Ventas" llama `onNavigate('sells')`; click en el logo llama `onNavigate('stock')`; **no** existe botón "Historial".

**4.5 `ExpiryAlertWidget` (re-skin).** Archivo `Components/ExpiryAlert/ExpiryAlertWidget.tsx`. Mantener toda la lógica de datos (carga, `sessionDismissed`, `dismissStockMovementExpiry`, clasificación con `classifyExpiry`). Cambia solo el render:
- Si `loading || error || visible.length === 0` → `null` (igual que hoy).
- Contenedor `<div className="ig-anchor" ref={wrapperRef}>`.
- Botón `<button type="button" className="ig-expiry" aria-haspopup="dialog" aria-expanded={popupOpen}>` con `<TriangleAlert size={16}/>` y los segmentos: `"{n} vencido(s)"` y `"{n} vence(n) hoy"` separados por `<span className="sep">·</span>` (singular/plural correcto: "1 vencido", "2 vencidos", "1 vence hoy", "3 vencen hoy"). **Sin** `aria-label` (el texto visible es el nombre). **Sin** el glifo ⚠.
- Popup `<div className="ig-expiry-pop" role="dialog" aria-label="Lotes a revisar">` con cabecera `ig-modal-head` (`<h2>Lotes a revisar</h2><p>Sacalos de la góndola o recordalos más tarde.</p>` + botón cerrar `X`), grupos `<div className="ig-expiry-group">Vencidos · {n}</div>` y `Vencen hoy · {n}`, y filas:
  ```tsx
  <div className="ig-expiry-row">
    <div className="what"><strong>{m.product.name}</strong><span>{detalle}</span></div>
    <Button size="sm" variant="secondary" onClick={...}>Recordame luego</Button>
    <Button size="sm" variant="primary" icon={Check} onClick={...}>Ya lo saqué</Button>
  </div>
  ```
  Detalle: vencido → `Venció el {formatDate(expiryDate)} · lote cargado el {formatDayMonth(m.date)} · {m.quantity} u.`; vence hoy → `Vence hoy · {m.quantity} u.`.
- Esc con el popup abierto lo cierra y devuelve el foco al botón (`onKeyDown` en el popup). Click afuera cierra (ya existe).
- Cuando `visible` queda vacío el componente devuelve `null` (el popup desaparece solo).
- Borrar `ExpiryAlertWidget.css` y su import.

Actualizar `Components/ExpiryAlert/__tests__/ExpiryAlertWidget.test.tsx`: reemplazar `getByRole('button', { name: /Ver lotes vencidos/i })` por `getByRole('button', { name: /vencid|vence/i })`; ajustar los textos de fila al nuevo detalle; agregar tests: (a) "1 vencido" en singular y "2 vencidos · 3 vencen hoy" combinado; (b) Esc cierra el popup; (c) no aparece el carácter `⚠` (`expect(container.textContent).not.toContain('⚠')`).

**4.6 `App.tsx`.** Reescribir:
```tsx
export default function App() {
  const [nav, setNav] = useState<NavState>(initialNav)
  const navigate: Navigate = useCallback((patch) => setNav((n) => ({ ...n, ...patch })), [])

  // Ctrl+1/2/3 → secciones (ignorar si hay un modal abierto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey || openModalCount() > 0) return
      const map: Record<string, Section> = { '1': 'stock', '2': 'sells', '3': 'stats' }
      const s = map[e.key]
      if (s) { e.preventDefault(); navigate({ section: s }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <ToastProvider>
      <SalesProvider>
        <div className="ig-app">
          <AppHeader section={nav.section} onNavigate={(section) => navigate({ section })} />
          <div className="app-body">
            {nav.section === 'stock' && <StockPage nav={nav} navigate={navigate} />}
            {nav.section === 'sells' && <SalesPage nav={nav} navigate={navigate} />}
            {nav.section === 'stats' && <Stats navigate={navigate} />}
          </div>
        </div>
      </SalesProvider>
    </ToastProvider>
  )
}
```
Hasta que existan `StockPage`/`SalesPage` (Fases 5 y 9), creá versiones mínimas temporales que rendericen lo viejo: `StockPage` → `<Stock />` y `SalesPage` → `nav.salesView==='history' ? <SalesHistory/> : <Sells/>` + un `Segmented` Nueva venta|Historial. **`Sells` ahora debe usar `useSales()`** en lugar de su `useReducer`/`useState` locales para carrito, descuento y pagos (cambio mínimo: reemplazar esas 3 declaraciones por `const { cart, dispatchCart: dispatch, discountPct, setDiscountPct, payments, setPayments, resetSale } = useSales()` y en el éxito de la venta usar `resetSale()`).
Borrar `Pages/Header.tsx`.

Tests:
- `src/__tests__/App.test.tsx` (nuevo; mockeá todo `window.api` que usan las pantallas con arrays vacíos): arranca en Stock (botón Stock con `aria-current`); `Ctrl+2` cambia a Ventas; `Ctrl+3` a Estadísticas; con un modal abierto (abrí "Nuevo producto" si ya existe, o simulá con `pushModal()`/`popModal()` en el test) `Ctrl+2` no navega.
- Actualizar `Pages/Sells/__tests__/Sells.confirm.test.tsx` para renderizar con `renderWithProviders`.

**4.7 Verificación de la fase.** Tests + typecheck. Corré la app: header azul noche con logo, nav con píldora blanca, widget de vencimientos (si hay datos), botón luna/sol que cambia el tema.

---

## Fase 5 — Stock › Productos

**5.1 `Pages/Stock/StockPage.tsx`.** Props `{ nav: NavState; navigate: Navigate }`. Renderiza `<main className="ig-page">` con:
- Cabecera `<div className="ig-page-head"><h1>Stock</h1><Segmented ariaLabel="Vista de stock" options=[{value:'products',label:'Productos'},{value:'movements',label:'Movimientos'}] value={nav.stockView} onChange={(v)=>navigate({stockView:v, movementsProduct: null})}/><div className="ig-spacer"/>{acciones}</div>`.
- Las acciones (Buscar F2 / Cargar stock / Nuevo producto) son de la vista Productos: `StockProducts` las recibe por un slot. Implementación simple: `StockPage` renderiza la cabecera y le pasa a `StockProducts` un prop `renderHeadActions` **o** (más simple) `StockProducts` renderiza su propia cabecera completa recibiendo el `Segmented` como prop `viewSwitcher`. **Usá la segunda opción**: `StockPage` solo decide qué vista montar y le pasa `viewSwitcher` (el `<Segmented>` ya armado) a ambas vistas; cada vista arma su `ig-page-head`.
- `nav.stockView==='products'` → `<StockProducts viewSwitcher navigate />`; `'movements'` → `<StockMovements viewSwitcher navigate product={nav.movementsProduct} />` (Fase 8; hasta entonces un placeholder `<EmptyState icon={History} title="Próximamente" />`).

**5.2 Mover y reescribir `Pages/Stock.tsx` → `Pages/Stock/StockProducts.tsx`.** Borrá `Pages/Stock.tsx` y `Pages/Stock.css`. Estado:
```ts
products: ProductFromApi[]; loading: boolean; error: boolean; reloadKey: number
query: string                 // buscador inline
categoryId: number | null     // null = Todas
onlyLow: boolean
showLots: boolean             // toggle "Vencimientos" (D5)
sort: { key: 'name' | 'salePrice' | 'stock'; dir: 'asc' | 'desc' }  // default name asc
activeId: number | null       // fila seleccionada
modal: { kind: 'none' } | { kind: 'create'; initial?: { name?: string; barcode?: string } } | { kind: 'edit'; product: ProductFromApi } | { kind: 'load'; product?: ProductFromApi } | { kind: 'search' }
lotsByProduct: Map<number, StockMovementFromApi[]>
```
Carga: `window.api.listProducts({ take: 5000 })` (antes 100: ahora el filtrado es en cliente). Manejo de error: `error=true` y `console.error`.

**5.3 Filtrado y orden (función pura).** Crear `Pages/Stock/productFilters.ts`:
```ts
export function filterProducts(list: ProductFromApi[], f: { query: string; categoryId: number | null; onlyLow: boolean }): ProductFromApi[]
export function sortProducts(list: ProductFromApi[], s: { key: 'name'|'salePrice'|'stock'; dir: 'asc'|'desc' }): ProductFromApi[]
```
- query: `includesFolded(p.name, q)` **o** el barcode (`p.barcode?.toString()`) contiene `q.trim()`.
- onlyLow: `stockTone(p) !== null` (incluye negativos).
- Orden por nombre con `localeCompare(b, 'es', { sensitivity: 'base' })`; precio con `Number(salePrice)`; no mutar el array original.
Tests `Pages/Stock/__tests__/productFilters.test.ts`: query por nombre sin tildes ("serenisima" encuentra "Serenísima"); query por parte del código; filtro de categoría; onlyLow incluye bajos y negativos y excluye normales; orden por nombre asc/desc con tildes; orden por stock; no muta el input.

**5.4 Cabecera de Productos.** Dentro de `StockProducts`:
```tsx
<div className="ig-page-head">
  <h1>Stock</h1>{viewSwitcher}<div className="ig-spacer" />
  <Button size="sm" variant="ghost" icon={Search} shortcut="F2" onClick={openSearch}>Buscar</Button>
  <Button variant="secondary" icon={PackagePlus} onClick={() => openLoad()}>Cargar stock</Button>
  <Button variant="primary" icon={Plus} onClick={() => openCreate()}>Nuevo producto</Button>
</div>
```

**5.5 Toolbar.**
```tsx
<div className="ig-toolbar">
  <div className="ig-input-wrap" style={{ width: 380 }}>
    <Search className="ig-icon" size={18} aria-hidden="true" />
    <input ref={searchRef} className="ig-input" placeholder="Buscar por nombre o código (Ctrl+F)" aria-label="Buscar productos" value={query} onChange=... onKeyDown={onSearchKeyDown} />
  </div>
  <MenuButton label="Filtrar por categoría" buttonText={`Categoría: ${nombre ?? 'Todas'}`} icon={ListFilter} size="sm" items={[{id:'all',label:'Todas',checked:categoryId===null,...}, ...categorías únicas de products ordenadas]} />
  <Button size="sm" variant="secondary" icon={ArrowDown} aria-pressed={onlyLow} onClick={toggle}>Solo stock bajo</Button>
  <Button size="sm" variant="secondary" icon={CalendarClock} aria-pressed={showLots} onClick={toggle}>Vencimientos</Button>
  <div style={{ flex: 1 }} />
  <span className="ig-help">{visibles.length} {visibles.length === 1 ? 'producto' : 'productos'}</span>
</div>
```
Para que el estado "presionado" se vea: en `app.css` agregá `.ig-btn[aria-pressed="true"] { background: var(--primary-soft); color: var(--on-primary-soft); border-color: var(--primary); }`.
`onSearchKeyDown`: Enter con query solo dígitos → buscar `products.find(p => p.barcode?.toString() === q)`; si existe, `setActiveId(p.id)` y hacer scroll a su fila; si no, toast danger `Producto no encontrado` / `Código {q}`.

**5.6 Alertas inline.**
- Si hay ≥1 negativo: `InlineAlert tone="danger"` con título `Hay 1 producto con stock negativo` / `Hay {n} productos con stock negativo`; texto (1) `«{nombre}» tiene {formatInt(stock)} unidades. Revisá las ventas o cargá stock.` o (n) `Revisá las ventas o cargá stock.`; acción `Button size="sm" icon={PackagePlus}` "Cargar stock" → `openLoad(primerNegativo)` (abre el modal directo en el paso 2).
- Si hay ≥1 bajo (no negativo) y `!onlyLow`: `InlineAlert tone="warning"` título `{n} producto(s) por debajo del stock mínimo` + acción "Filtrar" → `setOnlyLow(true)`.

**5.7 Tabla.** Markup de `ScreenStock/preview.html` + `Table/README.md`:
```tsx
<div className="ig-table-wrap ig-grid" style={{ flex: 1, overflow: 'auto' }} tabIndex={0} role="grid"
     aria-label="Productos" aria-activedescendant={activeId ? `stock-row-${activeId}` : undefined} onKeyDown={onGridKeyDown}>
  <table className="ig-table">
    <thead><tr>
      <th>Código de barras</th>
      <th aria-sort=...><button className="ig-th-sort" onClick={() => toggleSort('name')}>Nombre {flecha}</button></th>
      <th className="r" aria-sort=...><button className="ig-th-sort" ...>Precio</button></th>
      <th className="r" aria-sort=...><button className="ig-th-sort" ...>Stock</button></th>
      <th className="r">Stock mín.</th>
      <th>Categoría / Proveedor</th>
      {showLots && <th>Vencimientos</th>}
      <th className="actions">Acciones</th>
    </tr></thead>
    <tbody>{filas}</tbody>
  </table>
  <div className="ig-table-foot">...</div>
</div>
```
Fila:
- `<tr id={`stock-row-${p.id}`} className={[activeId===p.id&&'is-selected', flashId===p.id&&'ig-row-flash'].filter(Boolean).join(' ')} onClick={() => setActiveId(p.id)} onDoubleClick={() => openEdit(p)} aria-selected={activeId===p.id}>`
- `td.code` barcode o `—`; `td.name` nombre; `td.r` `formatMoney(p.salePrice)`; stock: tono `negative` → `td.r.is-negative` con `<span className="ig-stock"><TriangleAlert size={16}/>{formatInt(stock)}</span>`, `low` → `td.r.is-low` con `ArrowDown`, normal → `td.r`; `td.r` con `className="r ig-muted"` para mínimo; categoría + `<div className="ig-sub">{proveedor}</div>`; lotes → `<LotsList lots=.../>` (si `showLots`); acciones → `Button variant="edit" size="sm" icon={Pencil}` "Editar" (con `e.stopPropagation()`) + `MenuButton iconOnly icon={EllipsisVertical} label={`Más acciones para ${p.name}`} variant="ghost" size="sm" align="right" items=[{id:'mov',label:'Ver movimientos',icon:History,onSelect:()=>navigate({stockView:'movements', movementsProduct:{id:p.id,name:p.name}})},{id:'load',label:'Cargar stock de este producto',icon:PackagePlus,onSelect:()=>openLoad(p)}]`.
- Flecha de orden: `ArrowUp`/`ArrowDown` de 14px solo en la columna activa; `aria-sort="ascending|descending|none"`.
- `onGridKeyDown` = `useRowNavigation({ keys: visibles.map(p=>p.id), activeKey: activeId, setActiveKey: setActiveId, onActivate: id => openEdit(byId(id)), rowDomId: id => `stock-row-${id}` })`. Ignorá eventos cuyo `target` no sea el contenedor del grid (para no interferir con los botones de la fila): `if (e.target !== e.currentTarget) return`.
- Pie: `<span>{n} productos{neg>0 && <> · <b style={{color:'var(--danger)'}}>{neg} con stock negativo</b></>}{low>0 && <> · <b style={{color:'var(--warning)'}}>{low} con stock bajo</b></>}</span>` + `<ShortcutBar items={[{keys:['↑','↓'],label:'Moverse'},{keys:['Enter'],label:'Editar'},{keys:['Ctrl','N'],label:'Nuevo'},{keys:['Ctrl','L'],label:'Cargar stock'}]} />`.

**5.8 Estados.**
- Cargando: si `useDelayedFlag(loading)` → `<TableSkeleton rows={8} cols={4} label="Cargando productos…" />`; antes de los 300 ms, nada.
- Error: `EmptyState tone="danger" icon={CircleAlert} title="No pudimos leer los productos" description="Revisá que la base de datos esté disponible y probá de nuevo." action={<Button icon={RotateCcw} onClick={reload}>Reintentar</Button>}`.
- Vacío (sin productos en la base): `EmptyState icon={Package} title="Todavía no hay productos" description="Cargá el primero para empezar a vender." action={<Button variant="primary" icon={Plus} onClick={openCreate}>Nuevo producto</Button>}` dentro de `div.ig-card`.
- Sin resultados de filtro: una fila `<tr><td colSpan={n} className="c ig-muted">No encontramos «{query}»</td></tr>` (si no hay query: `Ningún producto coincide con los filtros`).

**5.9 Atajos de la vista** (un `useEffect` con listener en `window`):
- `F2` → si `openModalCount() > (modal.kind==='search' ? 1 : 0)` no hacer nada; si no, alternar el popup de búsqueda.
- Con `openModalCount() > 0` ignorar todo lo siguiente.
- `Ctrl+N` → `openCreate()`; `Ctrl+L` → `openLoad()`; `Ctrl+F` → `searchRef.current.focus(); select()`. Todos con `preventDefault`.
- Dígito (`/^\d$/`), sin Ctrl/Alt, con target **no** editable (`isEditableTarget`) → `setQuery('')` y `searchRef.current.focus()` (sin `preventDefault`, así el dígito entra al input). Esto implementa "escanear estando en Stock filtra la tabla".

**5.10 Integración con modales.**
- `ProductFormModal` crear: `open={modal.kind==='create'}`, `initialValues={modal.initial}`; edición: `product={modal.product}`. `onSuccess(product)` → cerrar, `reloadKey++`, `setActiveId(product.id)`, `flash(product.id)`; después de recargar, scroll a la fila (un `useEffect` que, cuando cambia `products` y hay `activeId`, llama `scrollIntoViewSafe`).
- `LoadStockModal`: `open={modal.kind==='load'}`, `initialProduct={modal.product}`, `onSuccess(productId)` → igual que arriba; `onRequestCreate(query)` → `setModal({kind:'create', initial: /^\d+$/.test(query) ? {barcode:query} : {name:query}})`.
- `SearchPopup` (F2): `open={modal.kind==='search'}`, `allowNumericEnter`, `showExpiry`, `onSelect={(p) => setModal({kind:'edit', product:p})}`.

**5.11 `LotsList` (re-skin).** En `Components/LotsList/LotsList.tsx` cambiar el render a badges: cada lote `<Badge tone={vencido?'danger':venceHoy?'info':'neutral'} icon={vencido?CalendarX:venceHoy?Clock:undefined}>{qty} u. · {fecha DD/MM/AAAA o 'sin vencimiento'}</Badge>` dentro de un `<div style={{display:'flex',flexWrap:'wrap',gap:4}}>`; vacío → `<span className="ig-muted">—</span>`. Borrar `LotsList.css`. Actualizar `LotsList.test.tsx`: la fecha ahora es `01/05/2026` (no `2026-05-01`); las clases `lots-list__item--expired` pasan a `ig-badge-danger`, `--today` a `ig-badge-info`.

**5.12 Tests de Stock.** Reescribir `Pages/Stock/__tests__/Stock.search.test.tsx` y `Pages/__tests__/Stock.expiryColumn.test.tsx` contra `StockProducts` (render con `renderWithProviders`, props `viewSwitcher={null}` y `navigate={vi.fn()}`). Casos mínimos:
1. Muestra skeleton solo después de 300 ms de carga (fake timers con una promesa que no resuelve).
2. Lista productos con precio `$ 1.000,00` y la columna Categoría/Proveedor.
3. Stock negativo: celda con clase `is-negative` + alerta "Hay 1 producto con stock negativo"; su botón "Cargar stock" abre el modal "Cargar stock" con el producto ya elegido (paso 2: aparece el label "Cantidad a agregar (negativo = merma)").
4. Stock bajo: clase `is-low` + alerta warning; "Filtrar" activa "Solo stock bajo" (`aria-pressed="true"`) y oculta los productos normales.
5. Buscador inline: tipear "serenisima" deja solo "Leche La Serenísima"; contador "1 producto".
6. Enter en el buscador con un código exacto selecciona la fila (`aria-selected="true"`).
7. Orden: click en "Precio" ordena ascendente; segundo click descendente (`aria-sort`).
8. Teclado: foco en el grid, ↓ selecciona la primera fila, Enter abre "Editar producto".
9. Doble click en una fila abre "Editar producto".
10. Menú ⋮ → "Ver movimientos" llama `navigate({ stockView: 'movements', movementsProduct: { id, name } })`.
11. F2 abre el popup de búsqueda (mantené el `vi.mock('../../Sells/SearchPopup', …)` existente ajustando la ruta); elegir un producto abre Editar producto.
12. `Ctrl+N` abre "Nuevo producto"; `Ctrl+F` enfoca el buscador.
13. Toggle "Vencimientos" agrega la columna y llama `listLotsByProductIds` con los ids (portar los casos de `Stock.expiryColumn.test.tsx`).
14. Error de carga → "No pudimos leer los productos"; "Reintentar" vuelve a llamar `listProducts`.
15. Base vacía → "Todavía no hay productos".

**5.13 Verificación de la fase.** Tests + typecheck + revisión visual contra `design-system/components/ScreenStock/preview.html`.

---

## Fase 6 — Selector con alta en el momento + modal de Producto

**6.1 `ui/EntityPicker.tsx`** (de `Picker/README.md` y `preview.html`):
```ts
type Entity = { id: number; name: string }
type EntityPickerProps = {
  id: string; label: string; required?: boolean
  entityName: 'categoría' | 'proveedor'          // plural: categorías / proveedores
  items: Entity[]; loading?: boolean
  valueId: number                                // 0 = sin selección
  onChange: (id: number) => void
  onCreate: (name: string, extra?: { phone?: string; notes?: string }) => Promise<Entity>
  withExtraFields?: boolean                      // proveedor: teléfono y notas
  error?: string | null
  triggerRef?: React.Ref<HTMLButtonElement>
}
```
Comportamiento:
1. Cerrado: `<div className="ig-field"><label className="ig-label" htmlFor={id}>…</label><div className="ig-anchor"><button id={id} type="button" className="ig-picker" aria-haspopup="listbox" aria-expanded={open} aria-invalid={!!error}>{seleccionado ? <span>{nombre}</span> : <span className="placeholder">Elegí o creá {entityName === 'categoría' ? 'una categoría' : 'un proveedor'}</span>}<ChevronsUpDown size={16}/></button>{popover}</div>{error}</div>`.
2. Abre con click, Enter, Espacio o ↓. Foco al buscador interno (`ig-pop-search` con `ig-input-wrap` + `Search`).
3. Lista `ul.ig-picker-list role="listbox"`: ítems filtrados con `includesFolded`, nombre resaltado con `splitMatch` (`<b>`), `li.is-active role="option" aria-selected`. Ícono por ítem: `Tag` (categoría) o `Building2` (proveedor).
4. Botón fijo final `button.ig-picker-create` con `Plus` y texto `Crear «{query}»` — solo si `query.trim()!==''`. Si no hay coincidencias: `li` informativo `No hay categorías con «x»` / `No hay proveedores con «x»` y el botón crear queda activo (Enter crea).
5. ↑/↓ mueven el activo (incluyendo el botón crear como último elemento); Enter elige (llama `onChange(id)`, cierra, foco al trigger) o abre el formulario de alta.
6. Formulario de alta `div.ig-picker-new`: `<div className="ig-overline">Nueva categoría|Nuevo proveedor</div>`, campo Nombre* (precargado con la query), y si `withExtraFields` una grilla 2 columnas con Teléfono y Notas (placeholder "Opcional"); botones `Cancelar` (ghost sm, vuelve a la lista) y `Crear y elegir` (primary sm). Validación: nombre vacío → `Ingresá un nombre.`; nombre repetido (comparar `foldText(trim)` contra `items`) → `Ya existe «{nombre existente}». Elegilo de la lista.`. Error de `onCreate` → mostrar `No se pudo crear. Probá de nuevo.` (y `console.error`).
7. Éxito de `onCreate` → `onChange(created.id)`, cerrar, foco al trigger.
8. Esc: si está el formulario de alta → volver a la lista; si no → cerrar y foco al trigger. **Siempre** `e.preventDefault(); e.stopPropagation()` (que no cierre el modal de producto).
9. Click afuera cierra (listener `mousedown` en `document`).
10. Enter dentro del picker nunca debe propagarse al formulario (`stopPropagation`).

Tests `ui/__tests__/EntityPicker.test.tsx` (props mock, sin `window.api`):
1. Placeholder "Elegí o creá una categoría" sin selección; con `valueId` muestra el nombre.
2. Click abre, el buscador recibe foco, la lista muestra todos los ítems.
3. Tipear "alm" filtra y resalta (`<b>` con "Alm").
4. ↓ + Enter elige el segundo ítem → `onChange(id)` y se cierra.
5. Sin coincidencias → "No hay categorías con «xyz»"; Enter abre el formulario con el nombre precargado.
6. "Crear y elegir" llama `onCreate('Bebidas', undefined)` y luego `onChange(nuevoId)`.
7. Nombre repetido ("almacén" vs "Almacén") → "Ya existe «Almacén». Elegilo de la lista." y **no** llama `onCreate`.
8. Proveedor con `withExtraFields`: completa Teléfono y Notas → `onCreate('Distri', { phone: '123', notes: 'x' })`.
9. Esc cierra el popover y devuelve el foco al trigger; un `onKeyDown` espía en un contenedor padre **no** recibe el Escape.
10. Click afuera cierra.

**6.2 `Pages/Stock/CategoryPicker.tsx` y `SupplierPicker.tsx`.** Wrappers que cargan con `window.api.listCategories()` / `listSuppliers()` al montar, y pasan `onCreate` = `createCategory({name})` / `createSupplier({name, phone: phone||null, notes: notes||null})` (agregando el creado a su lista local). Props: `{ id, valueId, onChange, error, triggerRef }`. Error de carga → `<span className="ig-error">No pudimos cargar las categorías.</span>` (o "los proveedores").
Tests `CategoryPicker.test.tsx` y `SupplierPicker.test.tsx`: llaman a la API al montar; crear agrega y selecciona; error de carga muestra el mensaje.
Borrar `CategorySelector.tsx`, `SupplierSelector.tsx` y sus tests.

**6.3 `validateProductForm.ts`.** Cambios:
- Precios: usar `parseDecimal` (acepta `1.650,00`). Vacío o inválido o `< 0` → `Ingresá un precio mayor o igual a 0.`
- Nombre vacío → `Ingresá el nombre del producto.`
- Categoría 0 → `Elegí o creá una categoría.`; proveedor 0 → `Elegí o creá un proveedor.`
- Barcode con no-dígitos **o** > 20 → `El código solo puede tener números (hasta 20).`
- Stock / stock mínimo inválidos → `Ingresá un número entero, 0 o mayor.` (usar `parseInteger`).
- Agregar `export function priceToPayload(raw: string): string` → `String(parseDecimal(raw))` (lanza si es null; solo se llama después de validar).
- Agregar `export const FIELD_ORDER = ['name','categoryId','supplierId','purchasePrice','salePrice','barcode','stock','minStock'] as const`.
- Agregar `export function marginInfo(purchase: string, sale: string): { pct: number; profit: number } | null` → null si alguno no parsea o `purchase <= 0`; `pct = (sale - purchase) / purchase * 100`.
Actualizar `validateProductForm.test.ts` a los mensajes nuevos y agregar: `"1.650,00"` es válido; `marginInfo('1650','2390')` → `{ pct ≈ 44.85, profit: 740 }`; `marginInfo('0','10')` → null; `priceToPayload('1.650,50')` → `'1650.5'`.

**6.4 `ProductFormModal.tsx` (reescritura del render, misma lógica de submit).** Props nuevas: `initialValues?: { name?: string; barcode?: string }`. Usar `Modal` con:
- `title` = `Nuevo producto` / `Editar producto`; `subtitle` = `Los campos con * son obligatorios.` (crear) / nombre actual (editar); `size="md"`; `closeOnOverlay={false}`.
- `onEscape` → si hay cambios (`dirty`) abrir confirmación; si no, `onClose()`.
- `shortcuts=[{keys:['Esc'],label:'Cancelar'},{keys:['Ctrl','Enter'],label:'Guardar'}]`.
- `footer` = `<Button variant="ghost" onClick={requestClose}>Cancelar</Button><Button variant="primary" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar producto'}</Button>`.
- Cuerpo `div.ig-form-grid` con este orden (orden de Tab):
  1. Nombre* (`span-2`, `initialFocusRef`).
  2. Categoría* (`CategoryPicker`) · 3. Proveedor* (`SupplierPicker`).
  4. Precio de compra* · 5. Precio de venta* — ambos `ig-input-wrap` con `<span className="ig-prefix">$</span>` + `input.ig-input.ig-input-amount inputMode="decimal"`; en blur reformatear con `formatAmountInput(parseDecimal(v))` si parsea. Bajo venta: si `marginInfo` → ayuda `Margen: {pct con 1 decimal y coma} % · ganancia {formatMoney(profit)} por unidad`; si `profit < 0` → ayuda en warning (`style={{color:'var(--warning)'}}`) `Estás vendiendo por debajo del costo.` (no bloquea).
  6. Código de barras (`span-2`): `ig-input-wrap` con `ScanBarcode` + input mono `inputMode="numeric"`; ayuda `Podés escanearlo con el lector. Solo números, hasta 20.`; **Enter** en este input → `preventDefault` y foco al siguiente campo (Stock inicial en crear, Stock mínimo en editar).
  7. Stock inicial (crear) / Stock (editar, `readOnly`, clase `is-readonly`, ayuda `Para modificar el stock usá «Cargar stock».`).
  8. Stock mínimo — ayuda `Avisamos cuando quede igual o menos.`
  9. Vencimiento del lote (`span-2`, solo crear y si `parseInteger(stock) > 0`): `DateField` con ayuda `Opcional. Aparece porque cargaste stock inicial.`; validar con `parseDateAR`; inválido → `Revisá la fecha (DD/MM/AAAA).`
- Edición: precargar precios con `formatAmountInput(p.purchasePrice)`.
- `Ctrl+Enter` en cualquier parte del modal → `handleSubmit()` (handler `onKeyDown` en un `div` que envuelve el cuerpo).
- Validación al guardar: mostrar **todos** los errores; foco al primer campo con error según `FIELD_ORDER` (mapa de refs; para categoría/proveedor el ref es el trigger del picker).
- Payload: `purchasePrice: priceToPayload(...)`, `salePrice: priceToPayload(...)`, `minStock: parseInteger(...) ?? 0`, `stock` (crear) `parseInteger(...) ?? 0`, `expiryDate` solo si corresponde.
- Error del backend: si hay barcode y el mensaje matchea `/unique|barcode/i` → `const other = await window.api.getProductByBarcode(barcode)`; si `other && other.id !== product?.id` → error en el campo barcode `Ese código ya lo usa «{other.name}». Usá otro o dejalo vacío.` y foco al campo. En cualquier otro caso → `InlineAlert tone="danger"` arriba del pie: `No se pudo guardar el producto. Probá de nuevo.` + `console.error(e)`. El modal **no** se cierra.
- Confirmación de descarte: un segundo `Modal size="sm" title="¿Descartar los cambios?" subtitle="Lo que tipeaste se va a perder."` con footer `Seguir editando` (primary, cierra la confirmación) y `Descartar` (ghost, cierra todo).
- `dirty` = el draft difiere del inicial o hay fecha tipeada.
- Borrar `CreateProductModal.css` y su import.

**6.5 Tests de `ProductFormModal.test.tsx`.** Reescribir sobre los mismos escenarios (Suite A crear, Suite B editar) adaptando consultas:
- Los selects de categoría/proveedor ahora son pickers: abrir con `getByRole('button', { name: /categoría/i })` y elegir con `getByRole('option', { name: 'Almacén' })`.
- Botón crear: `Guardar producto` (antes `Crear producto`).
- El vencimiento se tipea como `01052026` (máscara) y se espera `expiryDate` = `new Date(2026, 4, 1)`.
Casos obligatorios (además de portar los existentes):
1. Guardar vacío muestra los 5 errores obligatorios con los copys nuevos y el foco queda en "Nombre".
2. Precios con coma y puntos (`1.650,00`) se envían como `'1650'`.
3. Margen en vivo: compra 1650, venta 2390 → "Margen: 44,8 % · ganancia $ 740,00 por unidad"; venta < compra → "Estás vendiendo por debajo del costo." y **igual** permite guardar.
4. Vencimiento: no aparece con stock 0; aparece con stock 12; fecha inválida `31022026` → "Revisá la fecha (DD/MM/AAAA)." y no llama a la API.
5. Enter en "Código de barras" no guarda y mueve el foco a "Stock inicial".
6. `Ctrl+Enter` guarda.
7. Código duplicado: `createProduct` rechaza con `Error('Unique constraint failed on barcode')` y `getProductByBarcode` devuelve "Yerba" → error "Ese código ya lo usa «Yerba». Usá otro o dejalo vacío." y el modal sigue abierto.
8. Otro error del backend → "No se pudo guardar el producto. Probá de nuevo."
9. Esc sin cambios cierra; Esc con cambios muestra "¿Descartar los cambios?"; "Seguir editando" vuelve; "Descartar" llama `onClose`.
10. Edición: subtítulo con el nombre, Stock solo lectura con la ayuda, botón "Guardar cambios", el payload **no** incluye `stock`, precios precargados `1.000,00`.
11. `initialValues={{ barcode: '779123' }}` precarga el código.

**6.6 Verificación de la fase.** Tests + typecheck + revisión visual contra `ScreenProductNew` y `ScreenProductEdit`.

---

## Fase 7 — Modal Cargar stock

**7.1 Props nuevas de `LoadStockModal`:** `initialProduct?: ProductFromApi` (si viene, abre directo en el paso 2), `onSuccess: (productId: number) => void` (antes sin argumento), `onRequestCreate?: (query: string) => void`.

**7.2 Render con `Modal`** (`size="md"`, `title="Cargar stock"`, `headerExtra={<StepIndicator steps={['Buscar producto','Cantidad']} current={step==='search'?0:1} />}`, `closeOnOverlay={false}`):
- `onEscape`: en `search` → `onClose()`; en `confirm` → volver a `search` (si `initialProduct` vino de afuera, Esc en confirm **también** vuelve a search). Quitar el listener global de Escape que existe hoy (lo reemplaza `onEscape`).
- **Paso 1:** input grande con ícono (`ig-input-wrap` + `Search` + `input.ig-input.ig-input-lg`, placeholder `Buscá por nombre o escaneá el código`) y tabla (`ig-table-wrap` con `boxShadow:none`) Código de barras | Nombre (coincidencia en `<b>` con `splitMatch`) | Stock actual (con tonos `is-low`/`is-negative` e íconos como en Stock). Fila seleccionada `is-selected`. Teclado igual que hoy (↑/↓/Enter). **Escaneo:** Enter con query solo dígitos → `await window.api.getProductByBarcode(q)`; si existe → paso 2 con ese producto; si no, seguir con la lógica normal (resultados). Estados: skeleton de 3 filas tras 300 ms; sin resultados → `EmptyState icon={SearchX} title="No encontramos «{q}»" description="¿Es un producto nuevo?" action={onRequestCreate && <Button variant="primary" icon={Plus} onClick={() => onRequestCreate(q)}>Crear producto</Button>}`. Pie: `shortcuts=[↑↓ Elegir, Enter Continuar, Esc Cerrar]`.
- **Paso 2:** `ig-form-grid`:
  - Producto (`span-2`, readonly `is-readonly`, valor `{nombre} · stock actual {stock}`).
  - Cantidad* (label exacto `Cantidad a agregar (negativo = merma)`, `ig-input ig-input-amount ig-input-lg`, `inputMode="numeric"`, foco inicial). Vista previa debajo (calcular con `parseInteger`, aceptando `−`):
    - `n > 0` → ayuda success con `ArrowUp`: `Reposición: el stock queda en {stock+n}`.
    - `n < 0` y resultado ≥ 0 → warning con `ArrowDown`: `Merma: el stock queda en {stock+n}` (el texto del input también en warning).
    - resultado < 0 → danger con `TriangleAlert`: `El stock quedará en {formatInt(stock+n)}` (no bloquea).
  - Vencimiento del lote (`DateField`, ayuda `Opcional`).
  - Notas (`span-2`, opcional).
  - Error de cantidad: `Ingresá una cantidad distinta de 0, sin decimales.` Fecha inválida: `Revisá la fecha (DD/MM/AAAA).` Error del backend: `InlineAlert danger` `No se pudo cargar el stock. Probá de nuevo.`
  - **Enter** en cualquier input del paso 2 → `handleSubmit()`.
  - Pie: `shortcuts=[Esc Volver, Enter Confirmar]`, footer `Button variant="secondary" icon={ArrowLeft}` Volver + `Button variant="primary"` `Cargar stock` (`Cargando…` mientras envía).
- Envío: igual que hoy (`createStockMovement` tipo `IN`), con `expiryDate` de `parseDateAR`. Éxito → `onSuccess(product.id)`.
- Borrar `LoadStockModal.css`.

**7.3 Tests `LoadStockModal.test.tsx`** (portar los existentes y agregar):
1. Paso 1: busca con debounce y lista resultados con la coincidencia en negrita.
2. Escaneo: query `7790001` + Enter con `getProductByBarcode` → producto ⇒ salta al paso 2.
3. Sin resultados: "No encontramos «xyz»" + "Crear producto" llama `onRequestCreate('xyz')`.
4. `initialProduct` abre directo en el paso 2 con "Leche · stock actual 24".
5. Vista previa: `24` → "Reposición: el stock queda en 48"; `-2` → "Merma: el stock queda en 22"; `-30` → "El stock quedará en −6".
6. `0` o `2,5` → "Ingresá una cantidad distinta de 0, sin decimales." y no llama la API.
7. Enter en Cantidad envía con `{ productId, type:'IN', quantity:24 }`; con fecha `30062027` envía `expiryDate: new Date(2027,5,30)`.
8. Esc en paso 2 vuelve al paso 1; Esc en paso 1 llama `onClose`.
9. Éxito llama `onSuccess(productId)`.
10. Indicador de pasos: en paso 2 el primer paso tiene `is-done`.

**7.4 Verificación de la fase.** Tests + typecheck + revisión visual contra `ScreenLoadStock`.

---

## Fase 8 — Stock › Movimientos (pantalla nueva)

**8.1 `Pages/Stock/movements.ts`** (puro):
```ts
export type MovementKind = 'sale' | 'restock' | 'shrink' | 'initial' | 'adjustment'
export type MovementInfo = { kind: MovementKind; label: string; tone: 'neutral'|'success'|'warning'|'info'; delta: number | null }
export function classifyMovement(m: { type: string; quantity: number; appliedDelta: number | null }): MovementInfo {
  if (m.type === 'SALE') return { kind: 'sale', label: 'Venta', tone: 'neutral', delta: -m.quantity }
  if (m.type === 'IN' && m.appliedDelta === 0 && m.quantity > 0) return { kind: 'initial', label: 'Alta inicial', tone: 'info', delta: m.quantity }
  if (m.type === 'IN' && m.quantity < 0) return { kind: 'shrink', label: 'Merma', tone: 'warning', delta: m.quantity }
  if (m.type === 'IN') return { kind: 'restock', label: 'Reposición', tone: 'success', delta: m.quantity }
  return { kind: 'adjustment', label: 'Ajuste', tone: 'neutral', delta: m.appliedDelta }
}
export type MovementTypeFilter = 'all' | 'sale' | 'restock' | 'shrink' | 'adjustment'
/** 'restock' incluye también 'initial'. */
export function matchesTypeFilter(info: MovementInfo, f: MovementTypeFilter): boolean
/** Últimos 7 días: desde hoy-6 00:00 hasta hoy 23:59:59.999 (zona local). */
export function lastSevenDays(now?: Date): { from: Date; to: Date }
```
Tests `Pages/Stock/__tests__/movements.test.ts`: los 5 casos de `classifyMovement` (incluido `IN` con `appliedDelta: null` → restock y `ADJUSTMENT` con `appliedDelta: null` → delta null); `matchesTypeFilter` (`initial` matchea `restock`; `all` matchea todo); `lastSevenDays(new Date(2026,9,24,15))` → from `18/10/2026 00:00`, to `24/10/2026 23:59:59.999`.

**8.2 `Pages/Stock/StockMovements.tsx`.** Props `{ viewSwitcher: ReactNode; navigate: Navigate; product: { id: number; name: string } | null }`. Layout de `ScreenStockMovements/preview.html`:
- `ig-page-head`: `<h1>Stock</h1>{viewSwitcher}`.
- `div.ig-filters`:
  - Producto: `Field` + `ig-input-wrap` con `Search`, placeholder `Nombre o código`; si `product` viene por navegación, el input arranca con su nombre y se filtra por `productId` en la API; al tipear se descarta el `productId` y se filtra en el cliente (`includesFolded` sobre nombre o barcode contiene).
  - Tipo: `Segmented` Todos / Ventas / Reposiciones / Mermas / Ajustes.
  - Período: dos `DateField` "Desde" y "Hasta" (default `lastSevenDays()`, formateados con `formatDate`). Solo se recarga cuando ambas fechas parsean y desde ≤ hasta.
- Carga: `window.api.listStockMovements({ fromDate, toDate, productId?, take: 500 })` con debounce 250 ms al cambiar filtros de API.
- Tabla: Fecha (`formatDayMonthTime`) · Tipo (`Badge` con tono/label de `classifyMovement`) · Producto (`td.name`) · Cantidad (`td.r`, `formatSignedInt(delta)`; color: success si `delta>0`, warning si `shrink`, `var(--ink)` bold si venta; `delta===null` → `<span className="ig-muted">ajuste a {quantity}</span>`) · Detalle (`ig-muted`): venta con `saleId` → `<button className="ig-link" onClick={() => navigate({ section:'sells', salesView:'history', historySaleId: m.saleId })}>Venta #{saleId}</button>`; si no, `notes`; si tiene `expiryDate` agregar `Lote vence {formatDate}` (unir partes con ` · `).
- **No** hay columna "Stock resultante" (D1).
- Orden: el backend ya devuelve más reciente primero.
- Estados: skeleton (300 ms); error → `EmptyState danger` "No pudimos leer los movimientos" + Reintentar; vacío → `EmptyState icon={History} title="Todavía no hay movimientos" description="Cambiá el período o el producto para ver otros movimientos."`.

**8.3 Conectar en `StockPage`** (reemplazar el placeholder del Paso 5.1).

**8.4 Tests `StockMovements.test.tsx`:**
1. Llama `listStockMovements` con el rango de 7 días por defecto.
2. Con `product={{id:5,name:'Leche'}}` llama con `productId: 5` y el input muestra "Leche".
3. Badges: Venta / Reposición / Merma / Alta inicial con sus clases (`ig-badge-neutral`, `-success`, `-warning`, `-info`).
4. Cantidades `−4`, `+24`, `−2`.
5. Click en "Venta #1282" llama `navigate({ section:'sells', salesView:'history', historySaleId:1282 })`.
6. Segmentado "Mermas" deja solo las mermas.
7. Tipear en Producto filtra en el cliente.
8. Detalle "Lote vence 08/11/2026".
9. Vacío y error.

**8.5 Verificación.** Tests + typecheck + visual contra `ScreenStockMovements`.

---

## Fase 9 — Ventas › Nueva venta

**9.1 `payments.ts`.** Cambios:
- `parsePaymentAmount(raw)` → usa `parseDecimal`; `null` o negativo → 0. (**Crítico:** hoy `"10.000,00"` da 0.)
- `PAYMENT_EPSILON = 0.005`.
- Nueva `fillRemaining(state, method, total): PaymentsDraft` → `remaining = total - sumPayments(state)`; si `remaining <= PAYMENT_EPSILON` devuelve `state` sin cambios; si no, `state[method] = formatAmountInput(parsePaymentAmount(state[method]) + remaining)`.
- Nueva `formatPaymentOnBlur(raw: string): string` → `''` si no parsea o es ≤ 0; si no, `formatAmountInput(n)`.
- Nueva `export type ChangeState = { kind: 'due' | 'exact' | 'return'; amount: number }` y `changeState(paid: number, total: number): ChangeState` → `diff = paid - total`; `diff < -0.005` → `{kind:'due', amount: -diff}`; `|diff| <= 0.005` → `{kind:'exact', amount: 0}`; si no `{kind:'return', amount: diff}`.
- Nuevo `PAYMENT_TITLE_LABELS: Record<PaymentMethod,string>` = Efectivo, Débito, Crédito, Transferencia, Otros.
- Nuevo `PAYMENT_ICONS: Record<PaymentMethod, LucideIcon>` = CASH `Banknote`, DEBIT `CreditCard`, CREDIT `CreditCard`, TRANSFER `ArrowLeftRight`, OTHER `Wallet`.
- Mantené `autoFillFor` solo si algún test lo usa; si no, borralo (Sells usará `fillRemaining`).
Actualizar `payments.test.ts` y agregar: `parsePaymentAmount('10.000,00') === 10000`; `fillRemaining` con total 1500 y CASH `'1000'` en TRANSFER → TRANSFER `'500,00'`; con todo cubierto no cambia nada; sumando a un método que ya tenía monto (`CASH '1000'`, total 1500 → CASH `'1.500,00'`); `changeState` en los 3 casos y en el borde (diff = −0.004 → exact); `formatPaymentOnBlur('20000') === '20.000,00'`, `('abc') === ''`.

**9.2 `amount.ts`.** `validateGeneralAmount` usa `parseDecimal` (acepta `1.500,50`); mensajes: vacío o ≤ 0 o inválido → `Ingresá un monto mayor a 0.`; el `value` devuelto es `String(n)` con punto. Actualizar `amount.test.ts` (los textos viejos "Ingresá un monto" / "Ingresá un monto positivo" pasan al nuevo copy) y agregar `'1.500,50'` → `'1500.5'`.

**9.3 `BarcodeInput.tsx`.** Nueva API:
```ts
type Props = { onScan: (code: string) => Promise<boolean>; onArrowDown: () => void }
export type BarcodeInputHandle = { focus: () => void }
```
Markup (de `ScreenSales/preview.html`): `<div className={`ig-scan ${focused ? 'is-focus' : 'is-idle'}`}><ScanBarcode size={22}/><input ref aria-label="Código de barras" placeholder="Escaneá o escribí un código de barras" autoFocus .../><span className="ig-scan-state">{focused ? <><CircleCheck size={16}/>Listo para escanear</> : <><TriangleAlert size={16}/>Hacé click acá o tocá Esc para escanear</>}</span></div>`.
- Enter con valor → `const ok = await onScan(v)`; `ok` → limpiar; `!ok` → conservar el texto y `input.select()`.
- ↓ → `preventDefault(); onArrowDown()`.
- Debajo del `ig-scan`, en `Sells`, va la `ShortcutBar` (no dentro de este componente).
- Quitar el botón "F2" viejo (ahora está en la cabecera).
Test `BarcodeInput.test.tsx` (nuevo): Enter con `onScan`→true limpia; →false conserva y selecciona; muestra "Listo para escanear" con foco y "Hacé click acá o tocá Esc para escanear" sin foco; ↓ llama `onArrowDown`.

**9.4 `EditableCell.tsx`.**
```ts
type Props = {
  kind: 'int' | 'money'
  value: string | number          // valor confirmado (precio con punto, ej. "1450.5")
  ariaLabel: string
  modified?: boolean              // precio distinto al de lista → clase is-modified
  onCommit: (n: number) => void   // solo con valor válido y distinto
  onNavigate?: (dir: -1 | 1) => void  // ↑/↓ dentro de la celda
  onExit?: () => void             // Enter/Esc: devolver foco a la fila
  inputRef?: (el: HTMLInputElement | null) => void
}
```
- Muestra: sin edición → `kind==='money' ? formatAmountInput(value) : String(value)`.
- `onFocus` → `draft = display` y `select()`. `onChange` → draft. Clase `ig-cell-edit` + `is-editing` mientras `draft !== null` + `is-modified`.
- Commit (blur, Enter, ↑/↓): `int` → `parseInteger(draft)` válido si `>= 1`; `money` → `parseDecimal(draft)` válido si `>= 0`. Inválido o vacío → descartar **en silencio**. Válido y distinto → `onCommit(n)`. Siempre `draft = null`.
- Enter → commit + `onExit()`. Esc → descartar + `onExit()` + `preventDefault()` + `stopPropagation()`. ↑/↓ → commit + `onNavigate(dir)` + `preventDefault()`.
- `type="text"`, `inputMode` `numeric`/`decimal`.
Tests `EditableCell.test.tsx` (portar la lógica de `CartList.test.tsx`): valor inicial `1.450,00`; tipear `1.200,00` + Enter → `onCommit(1200)` y `onExit`; vacío → no commit; `0` en int → no commit; letras → no commit y vuelve al valor; Esc descarta y no propaga; ↓ hace commit y llama `onNavigate(1)`; blur hace commit.

**9.5 `CartTable.tsx`** (reemplaza `CartList.tsx`; borrar `CartList.tsx` y su test cuando este esté verde):
```ts
type Props = {
  lines: CartLine[]
  flashLineId: string | null
  onQuantityChange: (lineId: string, q: number) => void
  onUnitPriceChange: (lineId: string, price: string) => void
  onRemove: (lineId: string) => void
  onExit: () => void              // foco al input de código
}
export type CartTableHandle = { focusFirstRow: () => void }
```
Markup de `Cart/preview.html` (`ig-table-wrap` > `table.ig-table.ig-cart`), columnas Producto · Cantidad (`th.r`) · Precio unit. (`th.r`) · Total (`th.r`) · `th.actions` con `<span className="ig-sr">Quitar</span>`.
- Fila `tr tabIndex={-1} data-line-id` con `is-selected` cuando tiene el foco (estado `activeId` actualizado en `onFocus` de la fila o de cualquier hijo) y `ig-row-flash` si `flashLineId`.
- Producto: `td.name` nombre; si `quantity > product.stock` → `<Badge tone="warning" icon={TriangleAlert} title="Sin stock suficiente">Sin stock</Badge>`. Línea general: `<span className="general"><Receipt size={16}/>General <Badge tone="neutral">F10</Badge></span>`.
- Cantidad: `EditableCell kind="int"`. Precio: `EditableCell kind="money"` con `modified` si es línea de producto y `Number(unitPrice) !== Number(product.salePrice)`; en ese caso, debajo `<div className="ig-cell-orig"><s>{formatMoney(product.salePrice)}</s></div>`. `onCommit` de precio → `onUnitPriceChange(lineId, String(n))`.
- Total: `td.r.line-total` `formatMoney(lineTotal(line))`.
- Quitar: `Button variant="ghost" size="sm" iconOnly icon={X} aria-label={`Quitar ${nombre}`}`.
- Teclado en la fila (solo si `e.target === e.currentTarget`): ↓/↑ → foco a la fila siguiente/anterior; Enter → foco al input de cantidad; `Delete` → `onRemove` y foco a la siguiente fila (o la anterior si era la última; si el carrito queda vacío, `onExit()`); `Escape` → `onExit()`.
- En las celdas: `onNavigate(dir)` → foco a la misma celda de la fila de arriba/abajo; `onExit` → foco a su fila.
- Para manejar foco tras borrar, guardá el índice antes de `onRemove` y usá un `useEffect` sobre `lines.length` para enfocar la fila en ese índice (o la anterior).
- Vacío (`lines.length===0`): no se renderiza la tabla; en su lugar (lo hace `Sells`) el estado vacío del Paso 9.9.
Tests `CartTable.test.tsx`: columnas; badge "Sin stock" cuando cantidad > stock; precio modificado con `is-modified` y el precio original tachado; línea General con "General" y "F10"; ✕ llama `onRemove`; Delete en una fila llama `onRemove` y el foco pasa a la siguiente; Delete con foco en un input **no** borra la línea; Esc en una fila llama `onExit`; ↓ en la fila mueve el foco a la siguiente; Enter en la fila enfoca el input de cantidad; `focusFirstRow()` enfoca la primera fila.

**9.6 `ChangeIndicator.tsx`.** Props `{ paid: number; total: number }`. Usa `changeState`. Markup de `ChangeIndicator/preview.html`:
- due → `ig-change is-due`, ícono `CircleAlert`, `Falta cubrir`, monto `formatMoney(amount)`.
- exact → `is-exact`, `Equal`, `Pago exacto`, `$ 0,00`.
- return → `is-return`, `HandCoins`, `Vuelto`, monto.
- Accesibilidad: el bloque visible sin `aria-live`; aparte `<span className="ig-sr" aria-live="polite">{label}</span>` cuyo texto es solo la etiqueta (cambia solo al cambiar de categoría).
Test: los 3 estados con su clase, etiqueta e ícono (verificar por clase y texto); sin pagos y total 100 → "Falta cubrir $ 100,00".

**9.7 `PaymentPanel.tsx` (reescritura).**
```ts
type Props = {
  subtotal: number; total: number
  discountPct: number; onDiscountChange: (pct: number) => void
  payments: PaymentsDraft
  onPaymentChange: (m: PaymentMethod, value: string) => void
  onPaymentBlur: (m: PaymentMethod) => void
  onFillRemaining: (m: PaymentMethod) => void
  canApprove: boolean; disabledReason: string | null
  onApprove: () => void; saving: boolean
}
export type PaymentPanelHandle = { focusMethod: (m: PaymentMethod) => void }
```
Markup exacto de `PaymentPanel/preview.html`:
- `<section className="ig-pay" aria-label="Pago">` → `div.ig-pay-left` y `div.ig-pay-sum`.
- Izquierda, línea 1 (`ig-pay-line`): `ig-pay-row` Subtotal con `span.v formatMoney(subtotal)`; `ig-pay-row` con `<label htmlFor="discount-input">{discountPct < 0 ? 'Recargo' : 'Descuento'}</label>` + `ig-input-wrap` con `input#discount-input.ig-input aria-label="Descuento" inputMode="decimal" style={{paddingRight:28}}` (+ `is-recargo` si negativo) y `<span className="ig-suffix">%</span>` + `<span className="ig-help">positivo = descuento · negativo = recargo</span>`. Mantener el patrón de draft actual (commit en blur/Enter, Esc restaura, rango [−200, 200], fuera de rango vuelve al último válido) pero parseando con `parseDecimal`.
- Izquierda, línea 2: `<div className="ig-overline" style={{marginBottom:8}}>Medios de pago</div>` + `div.ig-pay-methods` con 5 `div.ig-pay-method` (+ `is-filled` si `parsePaymentAmount(value) > 0`): `<button type="button" className="ig-pay-tag" aria-label={`Autocompletar ${PAYMENT_LABELS[m]}`} title="Completar con lo que falta">{icono 16}{PAYMENT_LABELS[m]}</button>` y `<input className="ig-input" aria-label={PAYMENT_LABELS[m]} placeholder="0,00" inputMode="decimal" value onChange onBlur={() => onPaymentBlur(m)} ref/>`.
- Click en la etiqueta → `onFillRemaining(m)` y luego `setTimeout(0)` → foco al input de ese medio y `select()`.
- Derecha: `div.ig-pay-total` (`span.k` TOTAL, `span.v` `formatMoney(total)`); `<ChangeIndicator paid={sumPayments(payments)} total={total} />`; botón `Button variant="primary" size="xl" icon={Check} shortcut="F12" disabled={!canApprove || saving}` con texto `saving ? 'Guardando…' : 'APROBAR VENTA'`; si `disabledReason && !saving` → `<div className="ig-hint" style={{justifyContent:'center'}}><Info size={16}/>{disabledReason}</div>`.
- **No** hay hint de líneas General (D2).
Actualizar `PaymentPanel.test.tsx`: reemplazar `getByText('VUELTO')` por los estados del `ChangeIndicator`; mantener consultas por `aria-label` (`EFECTIVO`, `Autocompletar EFECTIVO`, `Descuento`, botón `APROBAR VENTA`). Agregar: label cambia a "Recargo" con descuento negativo; `is-filled` con monto; hint visible con `disabledReason`; "Guardando…" con `saving`; click en etiqueta enfoca y selecciona su input (`await waitFor` sobre `document.activeElement`); `onPaymentBlur` se llama en blur.

**9.8 `SearchPopup.tsx` (re-skin; lo usan Ventas y Stock).** Props nuevas opcionales: `warnMissingPrice?: boolean` (Ventas: mostrar badge "Sin precio"). Usar `Modal size="lg" title="Buscar producto" subtitle="Por nombre o por código de barras." closeOnOverlay headerExtra={<ShortcutBar items={[{keys:['F2'],label:'cierra'}]} />} shortcuts=[↑↓ Elegir, Enter (Ventas: "Agregar al carrito" / Stock: "Abrir"), Esc Cerrar]`.
- Input `ig-input-wrap` + `Search` + `input.ig-input.ig-input-lg` (foco inicial).
- Tabla (`ig-table-wrap`, `boxShadow:'none'`): Código de barras (`td.code`) | Nombre (`td.name` con `splitMatch` → `<b>`; si `warnMissingPrice && !hasValidSalePrice(p)` → `<Badge tone="danger">Sin precio</Badge>`) | Stock (`td.r` con tonos) | Vencimientos (si `showExpiry`, con `LotsList`). Fila activa `is-selected`, `onMouseEnter` la activa, click selecciona.
- Si `!allowNumericEnter && /^\d+$/.test(query.trim())` → debajo de la tabla `InlineAlert tone="info"` `Si buscás solo números se busca el código exacto: hacé click en el producto para agregarlo.`
- Sin resultados (query no vacía, no cargando) → fila única `No encontramos «{query}»`. Cargando → `TableSkeleton rows={3}` tras 300 ms.
- La lógica de teclado/búsqueda/lotes se mantiene; Escape ahora lo maneja `Modal` (quitar el `case 'Escape'` del input). Borrar `SearchPopup.css`.
Actualizar `SearchPopup.test.tsx`: `.search-popup__overlay` → `.ig-overlay`; agregar: resaltado `<b>`; hint info con query numérica en modo Ventas (y no en modo Stock); badge "Sin precio"; "No encontramos «zzz»".

**9.9 `GeneralAmountPopup.tsx` (re-skin).** `Modal size="sm" title="Ítem general" closeOnOverlay shortcuts=[Enter Agregar, Esc Cancelar]`. Cuerpo: `Field label="Monto" htmlFor="general-amount" help="Mayor a 0. Podés usar coma o punto." error=…` con `ig-input-wrap` + `ig-prefix $` + `input#general-amount.ig-input.ig-input-amount.ig-input-lg inputMode="decimal"`. Enter valida con `validateGeneralAmount`; error `Ingresá un monto mayor a 0.` sin cerrar. Actualizar `GeneralAmountPopup.test.tsx` (nuevo copy; `1.500,50` → `onConfirm('1500.5')`).

**9.10 `Sells.tsx` (reescritura).** Usa `useSales()`. Estructura (ver `ScreenSales/preview.html`):
```tsx
<>
  <main className="ig-page" style={{ paddingBottom: 16, gap: 12 }}>
    <div className="ig-page-head">
      <h1>Ventas</h1>{viewSwitcher}<div className="ig-spacer" />
      <Button size="sm" icon={Search} shortcut="F2" onClick={toggleSearch}>Buscar</Button>
      <Button size="sm" icon={Receipt} shortcut="F10" onClick={toggleGeneral}>Ítem general</Button>
    </div>
    <BarcodeInput ref={barcodeRef} onScan={handleScan} onArrowDown={() => cartRef.current?.focusFirstRow()} />
    <ShortcutBar items={[{keys:['F2'],label:'Buscar producto'},{keys:['F10'],label:'Ítem general'},{keys:['↓'],label:'Ir al carrito'},{keys:['Supr'],label:'Quitar línea'},{keys:['F12'],label:'Aprobar venta'}]} />
    {cart.lines.length === 0
      ? <div className="ig-card"><div className="ig-cart-empty"><div className="ig-empty"><div className="ico"><ScanBarcode size={22}/></div></div><h3>Escaneá un producto para empezar</h3><ShortcutBar items={[{keys:['F2'],label:'Buscar por nombre'},{keys:['F10'],label:'Monto suelto'}]} /></div></div>
      : <CartTable ref={cartRef} ... />}
  </main>
  {cart.lines.length > 0 && <PaymentPanel ref={payRef} ... />}
  <SearchPopup open={popupOpen} warnMissingPrice ... />
  <GeneralAmountPopup ... />
</>
```
Props: `{ viewSwitcher: ReactNode }`.
Lógica:
- `subtotal`, `total = Math.max(0, subtotal * (1 - discountPct/100))`, `paid = sumPayments(payments)`.
- `disabledReason`: carrito vacío → `Agregá al menos un producto`; `paid < total - PAYMENT_EPSILON` → `Falta cubrir ${formatMoney(total - paid)}`; si no `null`. `canApprove = disabledReason === null`. (Sin regla de líneas General: D2.)
- `addProduct(p)`: sin precio (`!hasValidSalePrice`) → toast danger `El producto no tiene un precio cargado` / `«${p.name}» — no se agregó` y devuelve false. Si no, igual que hoy + `flash(lineId)`; si `cantidad > stock` → toast warning `Sin stock suficiente` / `«${p.name}» se agregó igual`. Devuelve true.
- `handleScan(code)`: `getProductByBarcode`; null o excepción → toast danger `Producto no encontrado` / `Código ${code}` y `return false`; si no `return addProduct(p)` (si no tiene precio también devuelve false → el texto queda seleccionado).
- `handleApprove()`: si `!canApprove || saving` return; `setSaving(true)`; `createSale({ items: buildSaleItems(cart.lines), payments: PAYMENT_METHODS.map(...parsePaymentAmount...).filter(a>0), total: Math.round(total*100)/100, discountPct })`; éxito → `resetSale()`, foco al barcode; error → `console.error(e)` + toast danger `No se pudo guardar la venta. Probá de nuevo.` (no se vacía nada); `finally setSaving(false)`.
- `onPaymentBlur(m)` → `setPayments(p => ({...p, [m]: formatPaymentOnBlur(p[m])}))`; `onFillRemaining(m)` → `setPayments(p => fillRemaining(p, m, total))`.
- Al cerrar F2/F10 el foco vuelve al barcode (mantener los efectos actuales con `prevOpenRef`).
- **Listener global en `window`** (`keydown`):
  - `F2` / `F10`: toggle excluyente (como hoy) — permitido aunque haya un modal **de Ventas** abierto; si hay otro modal (`openModalCount() > (popupOpen||generalOpen ? 1 : 0)`) no hacer nada.
  - Si `openModalCount() > 0` → ignorar el resto.
  - `F12` → `preventDefault(); handleApprove()`.
  - `Alt+1…Alt+5` (con `e.altKey` y `e.key` `'1'..'5'`) → `preventDefault()`; método `PAYMENT_METHODS[n-1]`; si hay líneas: `onFillRemaining(m)` y `payRef.current?.focusMethod(m)`.
  - `Escape` sin `defaultPrevented` → foco al barcode.
  - Dígito sin Ctrl/Alt/Meta y target **no** editable → `barcodeRef.current?.focus()` (sin `preventDefault`).
  - Usá refs (`useRef`) para leer el estado más reciente dentro del listener (o `useEffect` con dependencias completas) para evitar closures viejas.
- Borrar el `alert-banner` viejo y `Sells.css`.

**9.11 `Pages/Sells/SalesPage.tsx`.** Props `{ nav; navigate }`. `viewSwitcher = <Segmented ariaLabel="Vista de ventas" options=[{value:'new',label:'Nueva venta'},{value:'history',label:'Historial'}] value={nav.salesView} onChange={v => navigate({ salesView: v, historySaleId: null })} />`. `new` → `<Sells viewSwitcher />`; `history` → `<SalesHistory viewSwitcher initialSaleId={nav.historySaleId} />`. Reemplaza la versión temporal del Paso 4.6.

**9.12 Tests de Ventas** (`Sells.confirm.test.tsx` reescrito + `Sells.keyboard.test.tsx` nuevo; render con `renderWithProviders(<Sells viewSwitcher={null} />)`):
1. Carrito vacío: "Escaneá un producto para empezar" y **no** hay panel de pago.
2. Escanear agrega la línea; el panel aparece; el input queda vacío y con foco.
3. Escanear el mismo código suma 1 (una sola fila, cantidad 2).
4. Código inexistente → toast "Producto no encontrado" con "Código 999"; el input conserva "999".
5. Stock insuficiente → toast "Sin stock suficiente" + badge "Sin stock" en la fila; la línea **sí** se agrega.
6. Producto sin precio → toast "El producto no tiene un precio cargado" y no se agrega.
7. APROBAR deshabilitado con hint "Falta cubrir $ 1.000,00"; click en "Autocompletar EFECTIVO" completa `1.000,00`, el hint desaparece, se ve "Pago exacto" y APROBAR se habilita.
8. Pago `20000` en EFECTIVO + blur → input `20.000,00` y "Vuelto $ 19.000,00".
9. Pago combinado: EFECTIVO `1000` sobre total 1500 → "Falta cubrir $ 500,00"; etiqueta TRANSFERENCIA → `500,00` y "Pago exacto".
10. Aprobar: `createSale` recibe `items`, `payments` (solo > 0, con montos numéricos), `total` y `discountPct`; después el carrito queda vacío, el foco en el input y no hay toast.
11. `createSale` rechaza → toast "No se pudo guardar la venta. Probá de nuevo." y el carrito **sigue** con la línea.
12. Línea General (F10, monto 850,50) → se puede aprobar (D2): `createSale` con un ítem sin `productId`.
13. Teclado: `F12` aprueba cuando está habilitado (y no hace nada si no); `Alt+1` completa EFECTIVO; `F2` abre "Buscar producto" y `F10` lo cierra y abre "Ítem general"; `Escape` con foco en un botón devuelve el foco al input; un dígito con foco en `document.body` mueve el foco al input de código; ↓ desde el input enfoca la primera fila del carrito.
14. Descuento 10 → TOTAL recalculado; descuento `-10` → label "Recargo".
15. Persistencia (D6): renderizar `<SalesProvider>` con `Sells` condicional, agregar un producto, desmontar `Sells` y volver a montarlo → la línea sigue.

**9.13 Verificación.** Tests + typecheck + visual contra `ScreenSales`, `ScreenSalesSearch`, `ScreenSalesGeneral`. Probá en la app real una venta completa **sin mouse**: escanear (o tipear código + Enter) → `Alt+1` → `F12`.

---

## Fase 10 — Ventas › Historial

**10.1 `salesHistoryFilters.ts`.** Nuevo modelo:
```ts
export type SalesMethodFilter = '' | 'CASH' | 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'OTHER' | 'MIXED'
export interface SalesHistoryFilters {
  fromDate: string   // "DD/MM/AAAA" o ''
  toDate: string     // "DD/MM/AAAA" o ''
  product: string    // texto: nombre o código
  method: SalesMethodFilter
  fromTime: string; toTime: string      // "HH:MM" o ''  (extras, D3)
  minTotal: string; maxTotal: string    // texto es-AR o '' (extras, D3)
}
export function defaultFilters(now = new Date()): SalesHistoryFilters  // hoy-hoy, resto vacío
export function hasActiveFilters(f: SalesHistoryFilters, now = new Date()): boolean  // distinto del default
export function buildApiFilters(f): ListSalesFiltersPayload   // fechas con parseDateAR (to = 23:59:59.999); method solo si es uno de los 5 simples; min/max con parseDecimal
export function filterSalesClientSide(sales: SaleFromApi[], f): SaleFromApi[]  // hora (filterByTime existente) + producto (includesFolded en item.product?.name o barcode contiene) + MIXED (payments.length > 1)
export function lastSevenDaysFilters(now = new Date()): SalesHistoryFilters
export function formatMethods(payments: SaleFromApi['payments']): string  // "Efectivo + Transferencia"; sin pagos "—"
```
Conservar `filterByTime` y `getSaleLocalTime`. Actualizar `salesHistoryFilters.test.ts` a fechas `DD/MM/AAAA` y agregar tests de `hasActiveFilters`, `MIXED`, filtro por producto (con y sin tildes), `formatMethods`, `buildApiFilters` (method `MIXED` no se envía; `minTotal '1.000,50'` → `1000.5`).

**10.2 `SaleDetailCard.tsx`** (reemplaza `SaleDetailModal`; borrar el modal, su CSS y su test). Props `{ sale: SaleFromApi }`. Markup de `ScreenSalesHistory/preview.html` (tarjeta derecha):
- `ig-card-head`: `<div><h3>Venta #{id}</h3><div className="ig-help">{formatDate(date)} · {formatTime(date)}</div></div>` + `Badge tone="success" icon={Check}` "Pagada". (Sin "Cajero": no existe el dato.)
- Tabla ítems: Producto (`item.product?.name ?? 'General'`) · Cant. · Precio · Total.
- `ig-card-body` con filas `ig-pay-row`: Subtotal; si `pct>0` `Descuento {pct} %` con `−{formatMoney(subtotal*pct/100)}` (el `−` ya lo pone formatMoney si pasás negativo: usá `formatMoney(-x)`); si `pct<0` `Recargo {|pct|} %` con `+{formatMoney(...)}`; Total en `amount-lg`; `<div className="ig-overline">Pagos</div>`; una fila por pago con `PAYMENT_ICONS` + `PAYMENT_TITLE_LABELS`; Vuelto (success) si `Σpagos − total > 0.005`.
- Pie reservado (comentario `{/* Futuro: Reimprimir ticket · Anular venta (admin) */}`), sin botones.
Tests `SaleDetailCard.test.tsx` (portar los de `SaleDetailModal.test.tsx`): título, ítem "General" para `product: null`, descuento y recargo, pagos con labels "Efectivo", vuelto.

**10.3 `CajaSummary.tsx` (re-skin).** `div.ig-card` con `ig-card-head` `<h3>Resumen de caja</h3>` y `ig-card-body` con `ig-pay-row` (Total del período en negrita + una fila por medio). Borrar `CajaSummary.css`. Actualizar su test si consultaba clases.

**10.4 `SalesHistory.tsx` (reescritura).** Props `{ viewSwitcher: ReactNode; initialSaleId: number | null }`.
- `<main className="ig-page">` + `ig-page-head` (`<h1>Ventas</h1>{viewSwitcher}`).
- `div.ig-filters`: `DateField` Desde, `DateField` Hasta, Producto (`ig-input-wrap` + `Search`, placeholder `Nombre o código`, ancho 260), Medio de pago (`<select className="ig-input" style={{width:200}}>` con Todos, Efectivo, Débito, Crédito, Transferencia, Otros, Combinado), `Button variant="ghost"` "Más filtros" (`aria-expanded`), `Button variant="ghost"` "Limpiar filtros" **solo** si `hasActiveFilters`, espaciador, y resumen a la derecha `<div style={{textAlign:'right'}}><div className="ig-help">{n} ventas · {rango legible}</div><div className="amount-lg num">{formatMoney(total)}</div></div>`.
- "Más filtros" despliega una segunda `ig-filters` con Desde hora / Hasta hora (`<input type="time" className="ig-input">`) y Monto mín / Monto máx (`ig-input ig-input-amount inputMode="decimal"`).
- Los filtros aplican **al instante** con debounce de 250 ms (no hay botón "Buscar").
- `div.ig-master-detail`: izquierda tabla en `ig-table-wrap ig-grid` (tab-stop único, `useRowNavigation`, `aria-activedescendant`) con N° (`td.code` `#id`) · Fecha y hora (`formatDayMonthTime`) · Ítems (`td.r`, suma de cantidades) · Medio de pago (`formatMethods`) · Total (`td.r.name`). Selección por defecto: la primera; ↑/↓ cambian el detalle. Derecha: `<div style={{display:'grid', gap:16, alignContent:'start'}}><SaleDetailCard sale={seleccionada}/><CajaSummary sales={ventas}/></div>`.
- `initialSaleId`: al montar, `getSaleById(id)`; si existe, poner `fromDate=toDate=formatDate(sale.date)` y seleccionarla.
- Estados: skeleton; error → `EmptyState danger` "No pudimos leer las ventas" + Reintentar; vacío → `EmptyState icon={Receipt} title="No hay ventas en este período" action={<Button onClick={() => setFilters(lastSevenDaysFilters())}>Ver últimos 7 días</Button>}`.
- Borrar `SalesHistory.css`.

**10.5 Tests `SalesHistory.test.tsx`** (reescribir):
1. Al montar llama `listSales` con `fromDate`/`toDate` de hoy.
2. Lista ventas y la primera aparece en el detalle ("Venta #N").
3. ↓ en la tabla cambia el detalle a la siguiente venta.
4. Medio "Combinado" deja solo ventas con >1 pago (sin pasar `method` a la API).
5. Producto "yerba" filtra en el cliente.
6. "Limpiar filtros" aparece solo con filtros activos y restaura los de hoy.
7. "Más filtros" muestra los campos de hora y monto.
8. Vacío → "No hay ventas en este período"; "Ver últimos 7 días" vuelve a llamar `listSales` con el rango de 7 días.
9. `initialSaleId=5` llama `getSaleById(5)` y la deja seleccionada.
10. Resumen: "2 ventas" y la suma de totales.
(Usá fake timers o `await waitFor` por el debounce de 250 ms.)

**10.6 Verificación.** Tests + typecheck + visual contra `ScreenSalesHistory`.

---

## Fase 11 — Estadísticas

**11.1 `statsUtils.ts`.** Agregar (y testear en `statsUtils.test.ts`):
- `formatRange(r: DateRange): string` → mismo mes y año: `"1 – 24 oct 2026"`; distinto mes: `"28 sep – 4 oct 2026"`; distinto año: `"28 dic 2025 – 3 ene 2026"`. Meses abreviados: `['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']`.
- `comparedToLabel(preset: PeriodPreset, prev: DateRange): string` → today `vs. ayer`, week `vs. semana anterior`, month `vs. {nombre del mes de prev.from en minúscula}` (ej. `vs. septiembre`), custom `vs. período anterior`.
- `HOUR_LABEL(label: string)` → `'18'` → `"18–19 h"`.
- `formatPctChange` pasa a usar `formatPct` de `utils/format` (`+12,4 %`). Actualizar los tests que esperaban el formato viejo.
- `peakIndex(rows: SalesByPeriodFromApi[]): number` → índice con mayor `saleCount` (−1 si vacío).

**11.2 `Pages/Stats/StatCard.tsx`.** Props `{ label: string; icon: LucideIcon; value: string; deltaPct: number | null; comparedTo: string; empty?: boolean }`. Markup de `StatCard/preview.html` (`ig-card ig-kpi` → `span.k`, `span.v`, delta). Reglas: `empty` → valor `—` y sin delta; `deltaPct === null` → `<span className="ig-help">Sin datos para comparar</span>`; `> 0` → `ig-delta up` + `TrendingUp`; `< 0` → `down` + `TrendingDown`; `0` → `flat` + `Minus`; texto `formatPct(deltaPct)` + `<span>{comparedTo}</span>`.
Tests: los 4 casos de delta + empty.

**11.3 `Pages/Stats/RankingList.tsx`.** Props `{ items: { id: number; name: string; value: number }[]; format: (v: number) => string; onSelect?: (id: number, name: string) => void }`. `ol.ig-rank`; `li` con `span.pos`, nombre (si `onSelect`: `<button className="ig-link" style={{textDecoration:'none', color:'var(--ink)', textAlign:'left'}}>`), `span.val`, `span.bar > i` con `width: {value/max*100}%`. Vacío → `<EmptyState icon={ChartColumn} title="Sin ventas en este período" />`. Tests: anchos (primero 100 %), click llama `onSelect(id, name)`, vacío.

**11.4 `Stats.tsx` (reescritura del render; misma carga en `Promise.all`).** Props `{ navigate: Navigate }`.
- `ig-page-head`: `<h1>Estadísticas</h1><div className="ig-spacer"/><span className="ig-help">{formatRange(actual)} · comparado con {formatRange(anterior)}</span>` + `Segmented` (Hoy · Esta semana · Este mes · Personalizado con ícono `Calendar`).
- Personalizado: fila `ig-filters` debajo con `DateField` Desde / Hasta y dos `Button size="sm" variant="ghost"` "Últimos 7 días" y "Mes pasado" que completan las fechas. Solo carga cuando ambas fechas parsean y desde ≤ hasta.
- `div.ig-kpi-grid` con 4 `StatCard` en este orden: Ventas totales (`Banknote`), Cantidad de ventas (`Receipt`, valor `formatInt`), Ticket promedio (`ShoppingBasket`), Ganancia total (`PiggyBank`). `deltaPct = calcPctChange(cur, prev)`. `empty = summary.saleCount === 0`.
- `div.ig-grid-2` con 4 tarjetas `ig-card`:
  1. "Productos más vendidos" (`ig-help` `top 5 · unidades`) → `RankingList` con `format={v => `${formatInt(v)} u.`}`.
  2. "Productos que más facturan" (`top 5 · monto`) → `RankingList` con `formatMoney`.
  3. "Cuándo se vende más" con `Segmented` Por hora / Por día de semana en la cabecera; tabla Franja · Ventas (`td` con `div.ig-bar > i` ancho proporcional al máximo, `is-peak` en el pico) · Tickets (`td.r`) · Monto (`td.r`). Etiquetas: hora `HOUR_LABEL`, día `WEEKDAY_LABELS`. Vacía → EmptyState "Sin ventas en este período".
  4. "Menor rotación" (`10 menos vendidos`) → tabla # · Producto · Vendidos (`{n} u.`); muestra 5 y un `Button variant="ghost" size="sm"` "Ver los 10" / "Ver menos" en `ig-table-foot`. (Sin "Última venta": D1.)
- Click en un producto de los rankings o de Menor rotación → `navigate({ section:'stock', stockView:'movements', movementsProduct:{ id, name } })`.
- Cargando → `TableSkeleton` por tarjeta (tras 300 ms); error → `EmptyState danger` "No pudimos calcular las estadísticas" + Reintentar.
- Borrar `Stats.css`.

**11.5 Tests `Stats.test.tsx`** (reescribir): llama las 7 funciones de la API; default "Este mes" seleccionado (`aria-selected`); KPIs con montos `$ …` y delta `+…%` y "vs. {mes}"; período anterior en 0 → "Sin datos para comparar"; sin ventas → KPIs "—" y "Sin ventas en este período"; cambiar a "Hoy" recarga; "Personalizado" muestra Desde/Hasta y "Últimos 7 días" dispara la carga; tab "Por día de semana" muestra días; click en un producto del ranking llama `navigate` con `movementsProduct`; "Ver los 10" muestra 10 filas.

**11.6 Verificación.** Tests + typecheck + visual contra `ScreenStats`.

---

## Fase 12 — Limpieza y barrido de calidad

**12.1** Borrá todos los archivos de la lista "Eliminados" (sección 0.5) que sigan existiendo y sus imports. `git status` para revisar.

**12.2 Barridos con Grep** en `renderer/src` (excluyendo `styles/tokens.css` y `__tests__`). Cada uno debe dar **0 resultados**; si no, corregí:
- `#[0-9a-fA-F]{3,8}\b` en `.tsx`/`.css` (colores hardcodeados). Excepción permitida: ninguna.
- `type="number"`.
- `⚠|✕`.
- `type="date"`.
- `className="(stock-|cart-list|payment-panel|search-popup|load-stock|create-product|sales-history|stats-|expiry-alert__|lots-list|modal-overlay|Header)` (clases viejas).
- `alert\(|confirm\(` (diálogos nativos).

**12.3** `npm --workspace renderer run lint` → no más errores que en la Fase 0. Arreglá los que introdujiste (en especial `jsx-a11y`: `onClick` en elementos no interactivos — las filas `<tr>` con click deben tener `aria-selected`/rol de grid, o desactivá la regla puntual con comentario justificado).

**12.4** Tema oscuro: con la app corriendo, alterná el tema y recorré todas las pantallas. Nada debe quedar con texto ilegible ni fondos blancos fuera del widget de vencimientos (que es blanco en ambos temas por diseño).

**12.5 Verificación.** Tests + typecheck.

---

## Fase 13 — Verificación final y documentación

**13.1** `npm --workspace renderer test`, `npm run typecheck`, `npm run test:backend` (debe seguir igual que en la base: no tocamos backend).

**13.2 Checklist de aceptación del DS** (de `guia/04-implementacion.md`), verificado **en la app real** (`npm start`). Marcá cada ítem en tu respuesta final:
- [ ] Ninguna pantalla usa colores, tamaños o radios fuera de los tokens.
- [ ] Todo elemento interactivo muestra el anillo de foco al navegar con Tab (también en el header, en celeste).
- [ ] En Ventas se completa una venta entera sin mouse.
- [ ] Un escaneo (tipear dígitos + Enter) con el foco fuera del input igual agrega el producto.
- [ ] Ningún input numérico tiene spinners; todos aceptan coma y punto.
- [ ] Montos `$ 1.234,50`, alineados a la derecha con cifras tabulares.
- [ ] Las alertas de stock no impiden agregar; los toasts no roban el foco.
- [ ] APROBAR deshabilitado siempre muestra el motivo.
- [ ] Vuelto: los 3 estados se distinguen por palabra e ícono.
- [ ] Widget de vencimientos oculto si no hay alertas; "Recordame luego" vuelve al reabrir la app.
- [ ] Tema claro y oscuro se ven bien y el elegido se recuerda al reabrir.
- [ ] Todas las vistas de datos tienen estado vacío, cargando y error.
- [ ] El carrito sobrevive a ir a Stock y volver (D6).
- [ ] Ventana no se puede achicar por debajo de 1280×720.

**13.3 Empaquetado** (las fuentes y PNG deben viajar y la CSP/ofuscación no debe romper nada): cerrá Integral, `npm run package`, `npm run verify:package`, `npm run test:smoke-packaged`. Abrí `out/Integral-win32-x64/Integral.exe` y confirmá que se ven las fuentes Plus Jakarta / IBM Plex y el logo. Si las fuentes no cargan, revisá en DevTools la CSP (`font-src 'self' data:` ya las permite) y la ruta de `@font-face`.

**13.4 Actualizar `CLAUDE.md`** (sin tocar la sección "Diseño" que agregó el usuario):
- Estructura de carpetas del renderer: agregar `styles/`, `ui/`, `store/`, `navigation.ts`, `Components/AppHeader/`, los archivos nuevos de Stock/Sells/Stats y quitar los eliminados (`Header.tsx`, `HomeScreen.tsx`, `Stock.tsx`, `Stock.css`, `renderTypes.ts`).
- Tabla "Estado del frontend": Stock (Productos + Movimientos) implementado con el DS; Ventas (Nueva venta + Historial) implementado; Estadísticas implementado; tema claro/oscuro.
- Nueva subsección "UI / Design system en el código": tokens en `renderer/src/styles/tokens.css` (copiado de `design-system/tokens.css`), clases `ig-` en `styles/bundle.css` (copia sin cambios) y agregados en `styles/app.css`; componentes base en `renderer/src/ui/`; íconos `lucide-react@0.468.0`; fechas `DD/MM/AAAA` con `DateField`; montos con `parseDecimal`/`formatAmountInput`; toasts con `useToast`; modales con `Modal` (focus trap, `modalStack`); carrito en `store/SalesContext.tsx`; atajos (tabla de `design-system/guia/02-teclado-y-foco.md`, ahora implementados).
- Decisiones D2 (líneas General se aprueban) y D3 (Historial dentro de Ventas, con extras).
- Quitar de "Iteración actual" lo que ya no aplica (botón "Historial" del header, `alert-banner`, etc.).

**13.5** Proponé al usuario el commit final (o uno por fase si no los hizo) con mensaje tipo `feat(ui): nueva UI/UX con el design system Integral` y la línea de atribución que corresponda.

---

## Troubleshooting

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `lucide-react` no exporta un ícono | Nombre nuevo no presente en 0.468.0 | Usar el alias viejo (sección 0.3). |
| Test con `toBe('$ 1.234,50')` falla | Espacio duro U+00A0 | Normalizar (sección 1.2) o usar `getByText`. |
| Escape en un selector/celda cierra el modal entero | Falta `stopPropagation` | Ver Paso 3.12 punto 6 y 6.1 punto 8. |
| Un atajo de página se dispara con un modal abierto | Falta el chequeo de `openModalCount()` | Agregarlo al inicio del handler. |
| `scrollIntoView is not a function` en tests | happy-dom | Usar `scrollIntoViewSafe`. |
| El dígito redirigido no aparece en el input en tests | happy-dom no reenvía el carácter al cambiar el foco | En tests verificar solo que el foco se movió. En la app real sí entra. |
| Montos `10.000,00` se guardan como 0 | Se usó `replace(',', '.')` en vez de `parseDecimal` | Ver Paso 9.1. |
| Pantalla en blanco en el `.exe` | Error de runtime ofuscado o CSP | Correr `INTEGRAL_NO_OBFUSCATE=1 npm run package` para depurar; nunca activar `selfDefending`. |
| `npm start` no abre ventana | `ELECTRON_RUN_AS_NODE=1` heredado | Ver sección 1.1. |
| Closures viejas en listeners globales (F12 aprueba con datos viejos) | `useEffect` con dependencias incompletas | Leer estado desde refs actualizadas en cada render. |
