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
- `id`, `productId`, `type` (string: "IN" | "SALE" | "ADJUSTMENT"), `quantity`, `date`, `notes?`
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
