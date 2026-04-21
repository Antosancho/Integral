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
- `id`, `date`, `total` (Decimal — suma de items)
- Relaciones: SaleItem[], SalePayment[]

### SaleItem (línea de venta)
- `id`, `saleId`, `productId`
- `quantity` (Int)
- `unitPrice` (Decimal) — **precio snapshot al momento de la venta**, no el precio actual del producto

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
| Reportes (ventas, ganancia, productos más vendidos) | Futuro |
| Migración de datos desde Excel / Google Sheets | Futuro |
| Backup de base de datos | Futuro |

---

## Estado del frontend

| Pantalla | Estado |
|----------|--------|
| Header (nav) | Implementado |
| Home | Pantalla de bienvenida sin datos (placeholder OK por ahora) |
| Stock (lista de productos) | Implementado — tabla solo lectura; **falta CRUD** |
| Sells | **Pendiente — próximo a desarrollar** |

### Próximo trabajo: pantalla Sells
- **Historial de ventas**: lista filtrable con detalle de ítems y pagos
- **Crear venta**: flujo tipo carrito → productos via scanner/buscador → form de pagos con cálculo de vuelto → confirmar

#### Iteración actual (en curso): buscador + carrito de productos
Primer paso del módulo Sells. Sólo la selección de productos; los pagos, confirmación y creación de `Sale`/`SaleItem` quedan para iteraciones siguientes.

**Layout:**
- Input superior de código de barras (el scanner actúa como teclado y dispara Enter al final).
- Botón/tecla `F2` abre una ventana emergente de búsqueda con input propio y una tabla de resultados con columnas `Código de barras | Nombre | Stock`.
- Debajo del input de barcode se lista el carrito con columnas `Nombre | Cantidad | Precio unitario | Total del producto`.

**Decisiones de comportamiento:**
1. **Producto repetido:** al agregar un producto que ya está en el carrito, se **suma 1 a la cantidad** de la fila existente (no se crea fila nueva). La cantidad inicial al agregar un producto nuevo es `1`.
2. **Tecla `Delete` sobre una fila:** elimina la **línea completa** (con toda su cantidad), no decrementa. Para bajar cantidades se usa el input numérico de la columna Cantidad. Adicionalmente cada fila tiene un botón `✕` que cumple la misma función. Si el foco está dentro de un input editable, `Delete` conserva su significado de edición de texto.
3. **Edición inline:** tanto `cantidad` como `precio unitario` se editan en el lugar, en la propia fila del carrito.
4. **Buscador emergente (`F2`):** el mismo input busca **por nombre y por código de barras a la vez**. Match case-insensitive y parcial para nombre; exacto para barcode. La búsqueda por barcode sólo se activa si la query es **exclusivamente dígitos** (`/^\d+$/`); queries mixtas (ej. `"coca 2l"`) se tratan como búsqueda por nombre.
5. **`F2` toggle:** si el popup está cerrado, F2 lo abre; si está abierto, lo cierra. Cerrar (por F2, Escape o click fuera) siempre devuelve el foco al input de código de barras.
6. **Código escaneado inexistente:** mostrar alerta visible al usuario ("Producto no encontrado") — no silencioso.
7. **Precio unitario en el carrito:** es **editable** (permite aplicar descuentos manuales). Valor inicial = `salePrice` del producto.
8. **Stock insuficiente al agregar:** mostrar alerta visible ("Sin stock suficiente") pero **permitir sumar** el producto. Coherente con el comportamiento general definido para stock.
9. **Navegación por teclado:** todo debe ser operable con flechas ↑/↓, `Tab`, `Enter`, `Esc`, `Delete`, además del mouse. El flujo natural es: scanner dispara Enter → producto se agrega → foco vuelve al input de barcode.
10. **Escaneo dentro del popup de búsqueda:** si el usuario escanea un código de barras mientras el foco está dentro del popup, el producto **aparece listado** en la tabla de resultados pero **no se agrega automáticamente** al carrito. Regla concreta: dentro del popup, `Enter` sólo agrega al carrito si la query **no es puramente numérica** (`!/^\d+$/.test(query)`); cuando la query son sólo dígitos (caso típico del scanner) `Enter` no hace nada — el usuario debe hacer click en la fila para agregarla. Esto evita que el `Enter` que manda el scanner al final del barcode agregue al carrito algo que el usuario solamente estaba buscando.
11. **Producto sin precio cargado:** si el `salePrice` del producto es `0`, vacío, o no representa un número válido, **no se agrega** al carrito y se muestra una alerta visible ("El producto no tiene un precio cargado"). Esto vale tanto para el flujo de scanner como para el de selección desde el popup.
12. **Persistencia del carrito:** el carrito vive sólo mientras la pantalla Sells está montada. Si el usuario navega a Home/Stock y vuelve, el carrito se pierde. Aceptado como limitación explícita para esta iteración; si se vuelve un problema de UX real (cajero pierde una venta por un click accidental), se resuelve en una iteración futura moviendo el estado a un store por encima de `App.tsx`.

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

### Próximo trabajo: Stock CRUD
- Crear / editar / eliminar productos desde la UI
- Al crear/editar, si la categoría o el proveedor no existen, el usuario puede **crearlos en el momento** via un modal/selector emergente (patrón tipo explorador de archivos de Windows: ventana que lista los existentes y permite crear uno nuevo sin salir del formulario principal)

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

## Convenciones del proyecto

- El renderer **nunca importa** de `backend/` directamente; toda comunicación es via `window.api`
- Los tipos del renderer están en `electron-api.d.ts` (duplicados manualmente de los tipos del backend)
- Los precios se muestran formateados con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`
- `BigInt` del barcode se serializa a `string` en el IPC antes de llegar al renderer
- Los `Decimal` de Prisma se serializan a `string` en el IPC
- La pantalla de ventas debe ser **operable principalmente con teclado y lector de barras** (scanner actúa como teclado); el mouse es secundario en el flujo de caja
