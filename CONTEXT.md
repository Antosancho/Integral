# Integral — Contexto del Proyecto

## Descripción general

App de escritorio Electron para gestión de stock y ventas. Orientada inicialmente a un minimarket, pero diseñada para ser un producto genérico que funcione en múltiples tipos de negocio. Moneda: ARS (Argentina). No hay deadline definido.

**Visión de producto:** software comercial distribuible a múltiples negocios. El código fuente no puede quedar expuesto al cliente final (se distribuye como instalador compilado).

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Shell | Electron |
| Renderer | React + TypeScript + Vite |
| Main process | TypeScript compilado a `dist/` |
| Base de datos | SQLite via Prisma ORM |
| IPC bridge | `contextBridge` + handlers tipados |

---

## Estructura de carpetas

```
Integral/
├── backend/
│   ├── db/client.ts              # Prisma client singleton
│   ├── prisma/schema.prisma      # Schema de la DB
│   ├── repositories/             # Acceso a datos (CRUD por entidad)
│   └── services/index.ts         # Re-exporta repositories (capa vacía por ahora)
├── electron/
│   ├── main.ts                   # Entry point Electron, crea BrowserWindow
│   ├── setupEnv.ts               # Setea DATABASE_URL antes de cargar Prisma (dev/prod)
│   ├── preload.ts                # Expone window.api via contextBridge
│   ├── ipcContract.ts            # Tipado del API y builder de ElectronApi
│   ├── ipcHandlers.ts            # Registra handlers en ipcMain
│   └── ipcSerialize.ts           # Serializa BigInt/Decimal para IPC
├── renderer/
│   ├── src/
│   │   ├── App.tsx               # Router simple: Home | Stock | Sells
│   │   ├── renderTypes.ts        # type Cont = 'sells' | 'stock' | null
│   │   ├── electron-api.d.ts     # Tipos de window.api para el renderer
│   │   └── Pages/
│   │       ├── Header.tsx        # Nav: Home / Sells / Stock
│   │       ├── HomeScreen.tsx    # Placeholder (retorna null)
│   │       ├── Stock.tsx         # Tabla de productos (implementada — solo lectura)
│   │       └── Stock.css
└── scripts/dev.js                # Arranca renderer + electron en orden
```

---

## Modelos de datos actuales (Prisma)

### Category
- `id`, `name` (unique)

### Supplier
- `id`, `name`, `phone?`, `notes?`

### Product
- `id`, `name`, `barcode?` (BigInt, unique)
- `purchasePrice` (Decimal), `salePrice` (Decimal) — **ambos precios incluyen IVA**
- `stock` (Int), `minStock` (Int)
- `categoryId` → Category, `supplierId` → Supplier (**supplier es obligatorio**)
- `createdAt`

### StockMovement
- `id`, `productId`, `type` (string: "IN" | "SALE" | "ADJUSTMENT"), `quantity`, `date`, `notes?`, `saleId?`
- `saleId?`: FK opcional a `Sale`. Los movimientos tipo `SALE` generados desde `SaleService.createSale` guardan acá el id de la venta origen para trazabilidad (historial de stock → venta). `onDelete: SetNull` (si se borra la venta, el movimiento queda con `saleId = null`).
- Tipos de movimiento:
  - `IN`: suma stock (reposición)
  - `SALE`: resta stock (venta — se genera automáticamente al confirmar una venta)
  - `ADJUSTMENT`: corrección manual; `quantity` representa el **nuevo valor absoluto de stock**; el sistema calcula el delta internamente

---

## Modelos pendientes de agregar (Sale)

El módulo de ventas requiere tres tablas nuevas:

### Sale (cabecera de venta)
- `id`, `date`, `total` (Decimal — total **final** después de aplicar descuento/recargo)
- `discountPct` (Decimal) — porcentaje aplicado sobre el subtotal. Positivo = descuento, negativo = recargo. Rango permitido `[-200, 200]`. Se guarda para trazabilidad (saber que la venta tuvo descuento/recargo y de cuánto).
- Relaciones: SaleItem[], SalePayment[]

### SaleItem (línea de venta)
- `id`, `saleId`, `productId?` (**opcional** — ver nota sobre ítems "general")
- `quantity` (Int)
- `unitPrice` (Decimal) — **precio snapshot al momento de la venta**, no el precio actual del producto
- Nota: `productId` es opcional para permitir **ítems "general"** (monto libre sin producto asociado, ingresado por el cajero con F10). Cuando `productId` es `null`, la línea representa un cobro genérico sin impacto en stock ni trazabilidad a Product.

### SalePayment (pago/s asociados a la venta)
- `id`, `saleId`
- `method`: `CASH` | `TRANSFER` | `DEBIT` | `CREDIT` | `OTHER`
- `amount` (Decimal)
- Una venta puede tener **múltiples pagos** (ej: parte efectivo + parte transferencia)

---

## Flujo de creación de una venta

1. El usuario agrega productos al carrito — principalmente via **lector de código de barras** (scanner físico que actúa como teclado); también hay un buscador manual.
2. Al confirmar la venta:
   - Se crea un registro `Sale`
   - Se crean los `SaleItem` con el precio actual de cada producto (snapshot)
   - Se registran uno o más `SalePayment` con el/los método(s) de pago y montos
   - Se actualiza el stock de cada producto (resta la cantidad vendida)
3. La suma de los `SalePayment.amount` debe igualar el total de la venta.
4. La app **calcula el vuelto** en tiempo real mientras el usuario completa los campos de pago. El formulario de pago permite múltiples entradas (ej: $1000 efectivo + $500 transferencia), mostrando cuánto falta cubrir o cuánto es el vuelto.
5. Si un producto no tiene stock suficiente, la app **muestra una alerta pero permite continuar la venta** (no bloquea).

---

## Comportamientos de negocio definidos

### Stock
- El stock **puede ir a negativo**, pero la app debe mostrar una alerta visible cuando esto ocurre.
- Los ajustes manuales (`ADJUSTMENT`) se ingresan como el **nuevo valor absoluto** de stock. El sistema calcula la diferencia (`delta = nuevo - actual`) y registra el movimiento correspondiente.
- El historial de movimientos de stock **debe ser visible en la UI**.

### Productos
- Todo producto debe tener un proveedor (`supplierId` obligatorio).
- Todos los productos se venden **por unidad** (sin fracciones ni granel por ahora).
- Los precios (`purchasePrice`, `salePrice`) **ya incluyen IVA**; la app no desglosa impuestos.

### Ventas
- No hay cancelación/anulación de ventas en el MVP (será función de rol admin en el futuro).
- El historial de ventas necesita **filtros** (por fecha, producto, método de pago).

---

## Funcionalidades: MVP vs Futuro

| Funcionalidad | Estado |
|---|---|
| Gestión de productos (CRUD) | **MVP** |
| Gestión de categorías y proveedores | **MVP** |
| Pantalla de ventas (carrito + pagos + vuelto) | **MVP — próximo** |
| Historial de ventas con filtros | **MVP** |
| Historial de movimientos de stock | **MVP** |
| Roles y niveles de acceso (admin / cajero) | Futuro |
| Cuenta corriente / fiado | Futuro |
| Impresión de tickets (impresora térmica) | Futuro |
| Reportes (ventas, ganancia, productos más vendidos) | **MVP — próximo (en planificación)** |
| Migración de datos desde Excel / Google Sheets | Futuro |
| Backup de base de datos | Futuro |

---

## Estado del frontend

| Pantalla | Estado |
|----------|--------|
| Header (nav) | Implementado |
| Home | **Eliminada** — la app arranca directamente en Stock |
| Stock (lista de productos) | Implementado — tabla con crear y cargar stock; **editar producto en curso** |
| Sells | **Pendiente — próximo a desarrollar** |
| Stats (estadísticas) | **Planificada — ver sección abajo** |

### Próximo trabajo: pantalla Sells
- **Historial de ventas**: lista filtrable con detalle de ítems y pagos
- **Crear venta**: flujo tipo carrito → productos via scanner/buscador → form de pagos con cálculo de vuelto → confirmar

#### Iteración actual (en curso): medios de pago + confirmación de venta + layout sticky

- **Layout**: pantalla dividida en 2 zonas: zona scrolleable del carrito (`cart-list`) + panel de pago sticky en la parte inferior (`PaymentPanel`).
- **5 medios de pago**: EFECTIVO, DÉBITO, CRÉDITO, TRANSFERENCIA, OTROS. Cada uno tiene un botón-label (click autocompleta el faltante) y un input de monto libre.
- **Vuelto**: se calcula como `Σpagos - total` (con signo). Negativo = falta cubrir (déficit); `0` = pago exacto; positivo = cambio a devolver. Se muestra debajo del TOTAL.
- **Botón APROBAR VENTA**: bloqueado (disabled + atenuado) salvo que `(carrito no vacío) ∧ (Σpagos ≥ total − 0.01) ∧ (sin líneas 'general')`. Se acepta que el cliente pague de más (recibe vuelto positivo).
- **Líneas general**: aún no se persisten (el backend exige `productId`). Si el carrito tiene alguna línea general, APROBAR se bloquea y aparece el hint "Las líneas General aún no se pueden guardar".
- **En éxito**: vaciar carrito (RESET), resetear `discountPct = 0`, resetear todos los inputs de pago a `''`, devolver foco al barcode input. Sin alerta de éxito.
- **IPC**: nuevos canales `sale:create`, `sale:list`, `sale:getById` expuestos via `window.api`. No se modificó el schema Prisma ni `saleService.ts`.

#### Iteración anterior (completa): pie de carrito con subtotal, total y descuento/recargo
Se agrega al pie del `CartList` un bloque con: **Subtotal** (suma de `lineTotal` de todas las filas), **input de Descuento %** (positivo = descuento, negativo = recargo), **Total final** (subtotal aplicando el %). El footer fue removido de `CartList` y movido al `PaymentPanel` en la iteración siguiente.

**Decisiones de comportamiento del descuento:**
1. **Signo**: positivo = descuento, negativo = recargo. Confirmado con el usuario a pesar de ser un UX poco convencional en cajas.
2. **Rango permitido**: `[-200, 200]`. Valores fuera de rango se descartan al confirmar (patrón draft — el input vuelve al último valor válido), no se clamp-ean silenciosamente.
3. **Aplica a todo el subtotal**: incluye tanto filas `'product'` como `'general'` (F10). No se discrimina por tipo de línea.
4. **Fórmula**: `total = Math.max(0, subtotal * (1 - discountPct / 100))`. El `max(0, ...)` cubre el caso `discountPct = 200` (total = 0).
5. **Persistencia**: el descuento vive en `Sells.tsx` junto al carrito. Se resetea a `0` en tres casos:
   - Al navegar fuera de Sells (unmount del componente — heredado del mismo comportamiento que el carrito).
   - Al confirmar una venta (cuando se implemente el flujo de confirmar, pendiente de iteraciones siguientes).
   - Al vaciar el carrito **no** se resetea: si el cajero quita todos los productos, el input queda con el último valor. Si el carrito está vacío no se muestra el pie, así que tampoco es visible.
6. **Trazabilidad**: al confirmar una venta (iteración futura), el `discountPct` se guardará como campo en `Sale` — ver modelo actualizado más arriba.
7. **Input UX**: usa draft local como string (mismo patrón que los inputs de cantidad y precio unitario de las filas del carrito), con commit en blur/Enter y descarte en Escape. No se usa `value={number}` directo porque rompe la edición de decimales y del signo negativo.
8. **Ubicación**: el pie se ubica alineado a la derecha, debajo de las filas del carrito. El input de descuento está en el bloque derecho junto a las casillas de Subtotal y Total.

#### Iteración anterior (completa): buscador + carrito de productos
Primer paso del módulo Sells. Sólo la selección de productos; los pagos, confirmación y creación de `Sale`/`SaleItem` quedan para iteraciones siguientes.

**Layout:**
- Input superior de código de barras (el scanner actúa como teclado y dispara Enter al final).
- Botón/tecla `F2` abre una ventana emergente de búsqueda con input propio y una tabla de resultados con columnas `Código de barras | Nombre | Stock`.
- Debajo del input de barcode se lista el carrito con columnas `Nombre | Cantidad | Precio unitario | Total del producto`.

**Decisiones de comportamiento:**
1. **Producto repetido:** al agregar un producto que ya está en el carrito, se **suma 1 a la cantidad** de la fila existente (no se crea fila nueva). La cantidad inicial al agregar un producto nuevo es `1`.
2. **Tecla `Delete` sobre una fila:** elimina la **línea completa** (con toda su cantidad), no decrementa. Para bajar cantidades se usa el input numérico de la columna Cantidad. Adicionalmente cada fila tiene un botón `✕` que cumple la misma función. Si el foco está dentro de un input editable, `Delete` conserva su significado de edición de texto.
3. **Edición inline:** tanto `cantidad` como `precio unitario` se editan en el lugar, en la propia fila del carrito.
    - Mientras el usuario está tipeando, el input usa un **draft local como string** (admite temporalmente vacío o parcialmente inválido) y **no** despacha al estado del carrito.
    - El cambio se **confirma** al hacer **blur** o presionar **Enter**. Si al confirmar el draft es vacío, no numérico, o fuera de rango (`quantity < 1`, `unitPrice < 0`), se **descarta** silenciosamente y el input vuelve al valor previo del estado — la fila nunca se elimina por un valor intermedio de edición.
    - **Escape** descarta el draft y restaura el valor previo.
    - Las flechas ↑/↓ del spinner respetan `min` (no bajan de 1 en cantidad, no bajan de 0 en precio).
    - Para eliminar una fila se usa `✕` o `Delete` sobre la fila (no el input en `0`).
4. **Buscador emergente (`F2`):** el mismo input busca **por nombre y por código de barras a la vez**. Match case-insensitive y parcial para nombre; exacto para barcode. La búsqueda por barcode sólo se activa si la query es **exclusivamente dígitos** (`/^\d+$/`); queries mixtas (ej. `"coca 2l"`) se tratan como búsqueda por nombre.
5. **`F2` toggle:** si el popup está cerrado, F2 lo abre; si está abierto, lo cierra. Cerrar (por F2, Escape o click fuera) siempre devuelve el foco al input de código de barras.
6. **Código escaneado inexistente:** mostrar alerta visible al usuario ("Producto no encontrado") — no silencioso.
7. **Precio unitario en el carrito:** es **editable** (permite aplicar descuentos manuales). Valor inicial = `salePrice` del producto.
8. **Stock insuficiente al agregar:** mostrar alerta visible ("Sin stock suficiente") pero **permitir sumar** el producto. Coherente con el comportamiento general definido para stock.
9. **Navegación por teclado:** todo debe ser operable con flechas ↑/↓, `Tab`, `Enter`, `Esc`, `Delete`, además del mouse. El flujo natural es: scanner dispara Enter → producto se agrega → foco vuelve al input de barcode.
10. **Escaneo dentro del popup de búsqueda:** si el usuario escanea un código de barras mientras el foco está dentro del popup, el producto **aparece listado** en la tabla de resultados pero **no se agrega automáticamente** al carrito. Regla concreta: dentro del popup, `Enter` sólo agrega al carrito si la query **no es puramente numérica** (`!/^\d+$/.test(query)`); cuando la query son sólo dígitos (caso típico del scanner) `Enter` no hace nada — el usuario debe hacer click en la fila para agregarla. Esto evita que el `Enter` que manda el scanner al final del barcode agregue al carrito algo que el usuario solamente estaba buscando.
11. **Producto sin precio cargado:** si el `salePrice` del producto es `0`, vacío, o no representa un número válido, **no se agrega** al carrito y se muestra una alerta visible ("El producto no tiene un precio cargado"). Esto vale tanto para el flujo de scanner como para el de selección desde el popup.
12. **Persistencia del carrito:** el carrito vive sólo mientras la pantalla Sells está montada. Si el usuario navega a Home/Stock y vuelve, el carrito se pierde. Aceptado como limitación explícita para esta iteración; si se vuelve un problema de UX real (cajero pierde una venta por un click accidental), se resuelve en una iteración futura moviendo el estado a un store por encima de `App.tsx`.
13. **Ítem "general" (F10):** `F10` abre un popup con un único input de monto. Al confirmar, se agrega al carrito una **fila "general"** sin producto asociado: nombre literal `"General"`, cantidad inicial `1`, monto = lo ingresado. Reglas:
    - Cada `F10` confirmado genera una fila **independiente** (no se mergea con otras "general" aunque tengan igual monto).
    - La fila "general" es editable inline en cantidad y monto, igual que una fila de producto, y puede eliminarse con `✕` / `Delete`.
    - **No** dispara alertas de stock ni se valida contra stock alguno.
    - Validación del monto: positivo (`> 0`), finito, admite decimales. **Acepta tanto punto como coma decimal** (es-AR); la coma se normaliza a punto antes de parsear y el valor se guarda internamente con punto.
    - `F10` es **toggle**: abre/cierra el popup. Mutuamente excluyente con el popup de búsqueda (`F2`): abrir uno cierra el otro. `Enter` confirma, `Escape` cancela, click fuera cierra. Al cerrar por cualquier motivo, el foco vuelve al input de código de barras.
    - F10 en Windows activa por default el menú nativo de Electron. Para evitarlo, el main process deshabilita el menú de la ventana (`Menu.setApplicationMenu(null)`) — ver decisión en la sección de `electron/`.

**Modelo interno del carrito (renderer):** `CartLine` es una **unión discriminada** por `kind: 'product' | 'general'`. Cada fila tiene un `lineId: string` único (generado con `crypto.randomUUID()` con fallback) que es el identificador usado por las acciones `REMOVE`/`SET_QUANTITY`/`SET_UNIT_PRICE`. Para filas `'product'` se sigue haciendo merge por `productId` en `ADD` (la identidad `lineId` se preserva entre sumas). Las filas `'general'` nunca se mergean.

**Estructura de datos del carrito (renderer, no persiste aún):**
```ts
type CartLine = {
  productId: number
  product: ProductFromApi   // snapshot para mostrar nombre/stock/barcode
  quantity: number
  unitPrice: string         // string por coherencia con el Decimal del IPC; editable
}
```

**No requiere cambios de backend.** Se usan los endpoints existentes `window.api.getProductByBarcode(...)` y `window.api.listProducts({ nameContains, take })`. La búsqueda combinada barcode+nombre se hace en el renderer, mergeando resultados y deduplicando por `id`.

**Cambio transversal al renderer incluido en esta iteración:**
- Los tipos `ProductFromApi`, `CategoryFromApi`, `SupplierFromApi`, etc. de [electron-api.d.ts](renderer/src/electron-api.d.ts) pasan a ser **exportados explícitamente** (antes estaban declarados sin `export` y el archivo es un módulo por `export {}`, por lo que no eran ni globales ni importables).
- `formatMoney` se extrae de [Stock.tsx](renderer/src/Pages/Stock.tsx) a un util compartido en `renderer/src/utils/format.ts` para reutilizar en Sells.

### Módulo de Estadísticas (planificado)

Nueva pantalla `Stats` accesible desde el Header (botón "Estadísticas"). Período de análisis con 4 presets: **Hoy | Esta semana | Este mes | Personalizado** (default: Este mes).

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

**Backend**: repositorio `statsRepository.ts` con 6 funciones de agregación. 6 canales IPC nuevos: `stats:getSummary`, `stats:getTopProductsByQuantity`, `stats:getTopProductsByRevenue`, `stats:getSalesByHour`, `stats:getSalesByWeekday`, `stats:getLowRotationProducts`.

**Frontend**: Las 7 llamadas se hacen en `Promise.all`. Comparación de períodos: el frontend llama a `getSalesSummary` dos veces en paralelo (período actual + período anterior). `getPreviousPeriod` es calendar-aware: para 'month' retorna el mes calendario anterior; para 'week' retrocede 7 días; para el resto usa el mismo rango en ms.

---

### Próximo trabajo: Stock CRUD
- Crear / editar / eliminar productos desde la UI
- Al crear/editar, si la categoría o el proveedor no existen, el usuario puede **crearlos en el momento** via un modal/selector emergente (patrón tipo explorador de archivos de Windows: ventana que lista los existentes y permite crear uno nuevo sin salir del formulario principal)

#### Iteración actual (en curso): Editar productos + eliminar pantalla Home + quitar flechas del input de descuento

**Feature 1 — Editar productos:**
- Botón "Editar" por fila en la tabla de Stock. Abre `ProductFormModal` (componente unificado que reemplaza `CreateProductModal`) en modo edición, con los campos pre-rellenos con los datos actuales del producto.
- `ProductFormModal.tsx` reemplaza completamente `CreateProductModal.tsx`. Recibe prop opcional `product?: ProductFromApi`; si está presente = modo edición, si no = modo creación.
- En modo edición: campo "Stock" es read-only (con nota "Para modificar el stock usá 'Cargar stock'"); todos los demás campos son editables incluyendo "Stock mínimo". No se envía `stock` en el payload de edición.
- En modo creación: comportamiento idéntico al `CreateProductModal` original.
- El backend ya tiene `product:update` implementado en todas las capas (repositorio, handler IPC, contrato, tipos del renderer).
- `CreateProductModal.tsx` y su test se eliminan; `ProductFormModal.tsx` con su test unificado (Suite A: creación + Suite B: edición) los reemplaza.
- CSS: columna "Acciones" suma una 7.ª columna al grid (`repeat(7, 1fr)`). Botón editar en amarillo (#f59e0b). Clase nueva `.create-product-modal__field-help` para el texto de ayuda del stock read-only.

**Feature 2 — Eliminar pantalla Home:**
- `Cont` ya no incluye `null`. El estado inicial de la app arranca en `'stock'` en lugar de `null`.
- Se elimina el botón "Home" del Header, el branch `{content === null && <div>Home</div>}` de App.tsx y el archivo `HomeScreen.tsx`.

**Feature 3 — Quitar flechas del input de descuento:**
- En `PaymentPanel.tsx`, el input de descuento pasa de `type="number"` + `step="0.01"` a `type="text"` + `inputMode="decimal"`. Alinea el input con el patrón del resto del proyecto.

#### Iteración anterior (completa): Crear producto desde la pantalla Stock

**Feature**: botón "+ Nuevo producto" en la pantalla Stock que abre un modal con formulario completo de alta de producto.

**Componentes nuevos a crear bajo `renderer/src/Pages/Stock/`:**
- `validateProductForm.ts` — validación pura, sin dependencias de UI
- `CategorySelector.tsx` — select con inline-create de categoría
- `SupplierSelector.tsx` — select con inline-create de proveedor (campos adicionales: phone, notes opcionales)
- `CreateProductModal.tsx` — modal principal de alta
- `CreateProductModal.css` — estilos del modal
- `__tests__/` — tests unitarios de cada componente con Vitest + Testing Library

**Campos del formulario y restricciones:**
- `name` — **obligatorio**
- `purchasePrice` — Decimal IVA incluido, **obligatorio**, >= 0 (acepta coma decimal es-AR)
- `salePrice` — Decimal IVA incluido, **obligatorio**, >= 0
- `categoryId` — FK a Category, **obligatorio** (0 = sin selección)
- `supplierId` — FK a Supplier, **obligatorio** (0 = sin selección)
- `barcode` — BigInt único, **opcional** (solo dígitos, máx 20 chars; unicidad la valida el backend)
- `stock` — Int, **opcional** (default 0, debe ser entero >= 0)
- `minStock` — Int, **opcional** (default 0, debe ser entero >= 0)

**Patrón de recarga de lista**: `reloadKey` (Int state) agregado como dependencia del `useEffect` de carga en `Stock.tsx`. Incrementar `reloadKey` en `onSuccess` del modal fuerza el re-fetch sin desmontar el componente.

**Decisiones de validación:**
1. Los campos de precio usan `normalizeDecimal` (trim + reemplaza coma por punto) antes de parsear con `Number()`.
2. Barcode: primero valida que sean solo dígitos, luego que no supere 20 chars. La unicidad la rechaza el backend (error de constraint que se muestra en el modal sin cerrarlo).
3. Stock vacío (`''`) se mapea a `0` en el payload; no es error de validación.
4. El formulario usa `ProductFormDraft` (todos campos como string, excepto `categoryId`/`supplierId` que son `number`) para evitar problemas de edición de decimales y signos negativos.

**El backend IPC no requiere cambios**: `product:create`, `category:list`, `category:create`, `supplier:list`, `supplier:create` ya están implementados en `electron/ipcHandlers.ts` y `electron/ipcContract.ts`.

#### Próxima feature (definida, pendiente de implementación): Vencimiento de lotes + alerta en header

**Requerimiento del cliente:**
- En "Cargar stock", agregar un campo para indicar el **vencimiento del lote** que se está ingresando.
- Al abrir la aplicación, advertir si hay lotes que **vencen hoy** o están **vencidos**.
- La advertencia aparece como una **alerta blanca con borde rojo** ubicada en el **header**, alineada a la **derecha** (donde están los botones de navegación de ventanas).
- Cada lote alertado tiene **2 botones**:
  - **"Ya lo saqué"** — descarta la alerta de forma permanente (no vuelve a aparecer).
  - **"Recordame la próxima vez"** — descarta solo en la sesión actual; al reabrir la app vuelve a aparecer.

**Granularidad y semántica acordadas (ver `plan.md` para detalle de implementación):**
- El vencimiento se guarda **por lote** (= por `StockMovement` tipo `IN`), no por producto. Un mismo producto puede tener varios lotes con vencimientos distintos.
- Campo opcional: si un producto no perece, se deja vacío y no genera alerta.
- El campo aparece en `LoadStockModal` (siempre) y en `ProductFormModal` modo creación **solo cuando el stock inicial es > 0**.
- Clasificación en zona horaria local: `expired` = `expiryDate < hoy 00:00`; `expiring_today` = `hoy 00:00 ≤ expiryDate ≤ hoy 23:59`.
- "Ya lo saqué" persiste un timestamp `expiryDismissedAt` en DB. **No** ajusta stock automáticamente.
- "Recordame luego" vive solo en estado del renderer (set de IDs en sesión).
- Botón consolidado: solo muestra la(s) categoría(s) con count > 0. Ej: "⚠ 2 vencidos" si no hay ninguno venciendo hoy; "⚠ 3 vencen hoy" si no hay vencidos.
- **Lotes vencidos con stock ya vendido**: la alerta igual aparece (el sistema no mira el stock residual, solo filtra por `expiryDate` y `expiryDismissedAt`).
- **`LoadStockModal` acepta cantidades negativas** para registrar merma/baja manual de stock. Cantidad positiva → ingreso; cantidad negativa → merma. La UI valida entero ≠ 0. El backend permite `type: 'IN'` con quantity negativo.
- **Producto nuevo con stock > 0 sin vencimiento**: siempre se crea el `StockMovement IN` para trazabilidad, aunque no tenga `expiryDate`. Así el stock inicial queda registrado como lote. Si la fecha se omitió, el campo queda `null`.
- Componente ubicado en `renderer/src/Components/ExpiryAlert/` (no en Pages).

---

#### Iteración actual (en curso): Cargar stock desde la pantalla Stock

**Feature**: botón "Cargar stock" al lado de "+ Nuevo producto" en la pantalla Stock. Abre un modal independiente que permite sumar unidades a un **producto existente** (no se pueden crear productos nuevos desde aquí).

**UX — flujo en dos pasos:**
- **Paso "search"**: input de búsqueda con debounce 250ms + tabla de resultados (Código de barras | Nombre | Stock actual). Reutiliza `searchProducts.ts` de Sells. Navegación por teclado (↑/↓/Enter). Escape cierra el modal.
- **Paso "confirm"**: muestra nombre del producto (read-only), input de cantidad (entero > 0, obligatorio), input de notas (opcional). Botón "Volver" regresa a search. Escape regresa a search (no cierra el modal). Botón "Cargar stock" confirma.

**Comportamiento post-submit exitoso**: cierra el modal e incrementa `reloadKey` en `Stock.tsx` para refrescar la tabla (mismo patrón que `CreateProductModal`).

**Archivos nuevos:**
- `renderer/src/Pages/Stock/LoadStockModal.tsx`
- `renderer/src/Pages/Stock/LoadStockModal.css`
- `renderer/src/Pages/Stock/__tests__/LoadStockModal.test.tsx`

**Archivos modificados:**
- `renderer/src/Pages/Stock.tsx` — agrega estado `showLoadStockModal`, botón y uso del modal

**Backend**: usa IPC `stockMovement:create` existente con `type: 'IN'`. Sin cambios de backend.

**Decisiones de implementación:**
- `searchProducts.ts` se importa directamente desde `../Sells/searchProducts` sin mover el archivo.
- La cantidad solo acepta enteros positivos (`Number.isInteger(n) && n > 0`); no se usa `normalizeDecimal` porque no hay decimales.
- `notes` vacío se envía como `undefined` (omitido del payload).
- El `useEffect` del listener global de Escape para el paso "confirm" debe listar `[open, step, submitting, onClose]` como dependencias para evitar stale closures.

#### Iteración siguiente: Vencimiento de lotes + alerta en header

**Schema**:
- `StockMovement` agrega `expiryDate DateTime?` y `expiryDismissedAt DateTime?` (ambos nullables, retrocompatible). Migración `add_expiry_to_stock_movement`. Índice `@@index([expiryDate])`.

**Backend**:
- `utilities.ts` agrega `ensureNonZeroInteger` (permite negativos, rechaza 0).
- `createStockMovement` acepta `expiryDate?: Date | null` y permite `quantity` negativo para tipo `IN` (merma).
- `createProduct` acepta `expiryDate?: Date | null`. **Siempre** crea StockMovement IN cuando `stock > 0`, con o sin `expiryDate` (trazabilidad del lote inicial). `appliedDelta: 0` porque el stock ya quedó persistido en `Product.create`.
- Nuevas funciones: `listExpiringStockMovements()` y `dismissStockMovementExpiry(id)`. Nuevos canales IPC: `stockMovement:listExpiring`, `stockMovement:dismissExpiry`.

**Frontend**:
- `LoadStockModal` agrega input opcional de vencimiento en paso "confirm". La cantidad acepta negativos (merma/baja de stock): label actualizado a "Cantidad a agregar (negativo = merma) *".
- `ProductFormModal` (modo creación) muestra el input solo cuando el stock inicial > 0. En edición no aparece.
- Util compartido `renderer/src/utils/expiry.ts` con `parseExpiryInput` (con validación de bounds de mes/día), `formatExpiryInput`, `classifyExpiry`.
- Componente `ExpiryAlertWidget` en `renderer/src/Components/ExpiryAlert/`, montado dentro del `<header>`. Al abrir la app pide `listExpiringStockMovements`, clasifica en `expired` vs `expiring_today`, y muestra un botón blanco con borde rojo que solo incluye los segmentos con count > 0 (`"⚠ 2 vencidos"`, `"⚠ 3 vencen hoy"` o `"⚠ 2 vencidos · 3 vencen hoy"`). Cada fila del popup tiene 2 botones: "Ya lo saqué" (persiste descarte vía `dismissStockMovementExpiry`) y "Recordame luego" (descarte solo de sesión). Si no hay items, el widget retorna `null`.
- Las clasificaciones de "expired" y "expiring_today" se calculan en el renderer con zona local del SO; el backend solo filtra `expiryDate <= endOfToday AND expiryDismissedAt IS NULL`.

---

## IPC bridge (cómo se llama al backend desde el renderer)

```ts
// En cualquier componente React:
const products = await window.api.listProducts({ take: 100 })
const sale = await window.api.createSale(data)
```

- `window.api` es expuesto por `preload.ts` via `contextBridge`
- Los tipos están en `renderer/src/electron-api.d.ts`
- Cada función llama a un canal IPC con `ipcRenderer.invoke(channel, payload)`
- Los valores `BigInt` y `Decimal` de Prisma se serializan automáticamente en `ipcSerialize.ts`

---

## Configuración de la base de datos (DATABASE_URL)

Prisma necesita la variable `DATABASE_URL` para conectarse a SQLite. Se resuelve en dos lugares (en este orden de prioridad):

1. **`electron/setupEnv.ts`** — se importa como **primer import** de `main.ts` (antes de cualquier import que pueda cargar el Prisma client). Setea `process.env.DATABASE_URL` programáticamente:
   - En desarrollo (`app.isPackaged === false`): apunta a `backend/prisma/dev.db` (resuelto desde `__dirname` del compilado en `dist/electron/`).
   - En producción (app empaquetada): apunta a `<userData>/integral.db` usando `app.getPath("userData")`. Ese path es per-usuario y escribible por el instalador.
   - Las barras invertidas de Windows se convierten a `/` para el formato `file:` de Prisma.
   - No pisa la variable si ya está seteada (permite override por entorno).

2. **`backend/db/client.ts`** tiene un fallback `loadEnv()` que lee un `.env` desde la raíz del proyecto si `DATABASE_URL` no está seteada. Esto es útil para scripts standalone (`test:backend-db`, `test:ipc-bridge`) que se ejecutan via `ts-node` y no pasan por `main.ts`.

**Por qué este diseño:** el código fuente se distribuye compilado al cliente final, así que un `.env` en la raíz del proyecto no llega al instalador. Hay que setear `DATABASE_URL` desde el main process con un path conocido y escribible. El `.env` de la raíz queda solo como conveniencia para desarrollo y scripts CLI.

**Trampa conocida con `.env` y `DATABASE_URL`:**
Prisma resuelve rutas relativas en `DATABASE_URL` respecto al directorio del schema (`backend/prisma/`), no respecto al CWD. Por eso, en este proyecto, el `.env` raíz debe usar `DATABASE_URL="file:./dev.db"` y no `DATABASE_URL="file:./backend/prisma/dev.db"`. El runtime de Electron resuelve el path programáticamente en `setupEnv.ts` y apunta a `backend/prisma/dev.db`. Los scripts `test:db-path-config` y `test:schema-db-sync` verifican que ambos paths coincidan y que el schema esté sincronizado con la DB.

**Pendiente para producción:** la primera ejecución en una máquina nueva todavía no genera la base ni corre las migraciones automáticamente. Cuando se empaquete el instalador, hay que decidir entre (a) bundlear una `dev.db` semilla y copiarla a `userData` en el primer arranque o (b) ejecutar `prisma migrate deploy` programáticamente al iniciar.

---

## Convenciones del proyecto

- El renderer **nunca importa** de `backend/` directamente; toda comunicación es via `window.api`
- Los tipos del renderer están en `electron-api.d.ts` (duplicados manualmente de los tipos del backend)
- Los precios se muestran formateados con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`
- `BigInt` del barcode se serializa a `string` en el IPC antes de llegar al renderer
- Los `Decimal` de Prisma se serializan a `string` en el IPC
- La pantalla de ventas debe ser **operable principalmente con teclado y lector de barras** (scanner actúa como teclado); el mouse es secundario en el flujo de caja
