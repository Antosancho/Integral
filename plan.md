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
