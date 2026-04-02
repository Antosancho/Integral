# Plan: Fix ADJUSTMENT stock bug en stockMovementRepository

## Problema raiz

En `backend/repositories/stockMovementRepository.ts`, la funcion `resolveStockDelta` retorna
`quantity` directamente para `ADJUSTMENT`, tratandolo como un delta. Pero segun el dominio,
`quantity` para ADJUSTMENT es un **valor absoluto** (el stock deseado).

```ts
// Lineas 80-81 — comportamiento actual (BUG)
const delta = resolveStockDelta(type, quantity)  // devuelve quantity tal cual
const nextStock = product.stock + delta           // suma en vez de reemplazar
```

**Ejemplo:** hay 10 unidades, usuario ajusta a 15 -> `delta = 15`, `nextStock = 25`. Incorrecto.

---

## Decisiones de diseno

1. **Revert de ADJUSTMENT en `deleteStockMovement`:** se agrega un campo `appliedDelta` (nullable)
   en la tabla StockMovement para guardar el delta real que se aplico. Esto permite revertir
   correctamente sin importar si hubo movimientos posteriores.

2. **Registros viejos sin `appliedDelta`:** se bloquea el revert para movimientos ADJUSTMENT
   que tengan `appliedDelta = null` (registros creados antes del fix).

3. **Stock negativo en ADJUSTMENT:** se permite. ADJUSTMENT puede dejar el stock en negativo
   (ej: el usuario quiere registrar un faltante real). Se remueve el check `nextStock < 0`
   para ADJUSTMENT.

4. **`default` en `resolveStockDelta`:** se cambia a `throw new Error(...)` para detectar
   tipos no manejados en tiempo de ejecucion.

---

## Pasos

### [ ] Paso 1 — Agregar campo `appliedDelta` al schema de Prisma

Archivo: `backend/prisma/schema.prisma`

Agregar al modelo `StockMovement`:

```prisma
appliedDelta Int?
```

Campo nullable porque los registros existentes no lo tienen, y porque para IN/SALE
no es estrictamente necesario (su delta es derivable).

---

### [ ] Paso 2 — Crear la migracion de Prisma

```bash
npx prisma migrate dev --name add-applied-delta-to-stock-movement
```

Esto genera el SQL y actualiza la DB de desarrollo.

---

### [ ] Paso 3 — Regenerar el cliente Prisma

```bash
npx prisma generate
```

Para que los tipos de TypeScript reflejen el nuevo campo.

---

### [ ] Paso 4 — Modificar firma de `resolveStockDelta`

Archivo: `backend/repositories/stockMovementRepository.ts`, linea 31.

Agregar parametro `currentStock`:

```ts
// Antes
function resolveStockDelta(type: StockMovementType, quantity: number): number

// Despues
function resolveStockDelta(type: StockMovementType, quantity: number, currentStock: number): number
```

El parametro NO es opcional: todas las llamadas deben proveer el stock actual.

---

### [ ] Paso 5 — Corregir el case ADJUSTMENT en `resolveStockDelta`

Archivo: `backend/repositories/stockMovementRepository.ts`, lineas 37-38.

```ts
// Antes
case "ADJUSTMENT":
  return quantity

// Despues
case "ADJUSTMENT":
  return quantity - currentStock
```

Ahora el delta es la diferencia entre el valor absoluto deseado y el stock actual.

---

### [ ] Paso 6 — Cambiar el `default` a throw

Archivo: `backend/repositories/stockMovementRepository.ts`, lineas 39-41.

```ts
// Antes
default:
  return quantity

// Despues
default:
  throw new Error(`Unknown stock movement type: ${type}`)
```

---

### [ ] Paso 7 — Pasar `product.stock` en la llamada de `createStockMovement`

Archivo: `backend/repositories/stockMovementRepository.ts`, linea 80.

```ts
// Antes
const delta = resolveStockDelta(type, quantity)

// Despues
const delta = resolveStockDelta(type, quantity, product.stock)
```

**Ejemplo corregido:** stock actual 10, ajuste a 15 -> delta = 5, nextStock = 15. Correcto.

---

### [ ] Paso 8 — Permitir stock negativo para ADJUSTMENT

Archivo: `backend/repositories/stockMovementRepository.ts`, lineas 82-84.

```ts
// Antes
if (nextStock < 0) {
  throw new Error("Stock cannot be negative")
}

// Despues
if (nextStock < 0 && type !== "ADJUSTMENT") {
  throw new Error("Stock cannot be negative")
}
```

Esto permite que un ADJUSTMENT fije el stock a un valor negativo (ej: faltante real),
mientras que IN y SALE siguen bloqueados.

---

### [ ] Paso 9 — Guardar `appliedDelta` en el registro de StockMovement

Archivo: `backend/repositories/stockMovementRepository.ts`, dentro del `tx.stockMovement.create`
(lineas 92-99).

Agregar el campo `appliedDelta` al `data`:

```ts
// Antes
return tx.stockMovement.create({
  data: {
    productId: data.productId,
    type,
    quantity,
    notes: normalizeOptionalString(data.notes),
    ...(data.date ? { date: data.date } : {})
  },
  include: { product: true }
})

// Despues
return tx.stockMovement.create({
  data: {
    productId: data.productId,
    type,
    quantity,
    notes: normalizeOptionalString(data.notes),
    ...(data.date ? { date: data.date } : {}),
    ...(applyToStock ? { appliedDelta: delta } : {})
  },
  include: { product: true }
})
```

Notas:
- `quantity` sigue guardando el valor absoluto (15) para auditoria.
- `appliedDelta` guarda el delta real aplicado (5) para poder revertir.
- Solo se guarda si `applyToStock` es true (si no se aplico, no hay delta que revertir).

---

### [ ] Paso 10 — Actualizar `deleteStockMovement`: leer `appliedDelta` para ADJUSTMENT

Archivo: `backend/repositories/stockMovementRepository.ts`, dentro de `deleteStockMovement`,
bloque `if (revertStock)` (lineas 142-163).

Reemplazar el calculo del `inverseDelta` para manejar ADJUSTMENT por separado:

```ts
// Antes
const movementType = normalizeStockMovementType(movement.type)
const inverseDelta = -resolveStockDelta(movementType, movement.quantity)

// Despues
const movementType = normalizeStockMovementType(movement.type)
let inverseDelta: number

if (movementType === "ADJUSTMENT") {
  if (movement.appliedDelta === null) {
    throw new Error(
      "Cannot revert this ADJUSTMENT: missing appliedDelta (record created before bug fix)"
    )
  }
  inverseDelta = -movement.appliedDelta
} else {
  inverseDelta = -resolveStockDelta(movementType, movement.quantity, product.stock)
}
```

---

### [ ] Paso 11 — Mover la lectura de `product` antes del calculo de `inverseDelta`

Archivo: `backend/repositories/stockMovementRepository.ts`, dentro de `deleteStockMovement`.

Actualmente `product` se lee despues de calcular `inverseDelta` (linea 146). Hay que moverlo
antes, porque ahora `resolveStockDelta` necesita `product.stock` para los tipos IN/SALE.

```ts
// Orden correcto dentro del if (revertStock):
const movementType = normalizeStockMovementType(movement.type)

const product = await tx.product.findUnique({
  where: { id: movement.productId }
})
if (!product) {
  throw new Error(`Product ${movement.productId} not found`)
}

let inverseDelta: number
if (movementType === "ADJUSTMENT") {
  if (movement.appliedDelta === null) {
    throw new Error(
      "Cannot revert this ADJUSTMENT: missing appliedDelta (record created before bug fix)"
    )
  }
  inverseDelta = -movement.appliedDelta
} else {
  inverseDelta = -resolveStockDelta(movementType, movement.quantity, product.stock)
}

const nextStock = product.stock + inverseDelta
if (nextStock < 0 && movementType !== "ADJUSTMENT") {
  throw new Error("Stock cannot be negative after reverting movement")
}

await tx.product.update({
  where: { id: movement.productId },
  data: { stock: nextStock }
})
```

---

### [ ] Paso 12 — Compilar y verificar tipos

```bash
npx tsc --noEmit
```

Corregir cualquier error de tipos que surja.

---

### [ ] Paso 13 — Test manual: ADJUSTMENT fija stock correctamente

Verificar con `testIpcBridge.ts` o similar:
1. Crear un producto con stock = 10.
2. Crear un ADJUSTMENT con quantity = 15.
3. Verificar que el stock del producto sea 15 (no 25).
4. Verificar que el StockMovement tenga `quantity = 15` y `appliedDelta = 5`.

---

### [ ] Paso 14 — Test manual: revert de ADJUSTMENT

1. Sobre el movimiento del paso anterior, ejecutar `deleteStockMovement(id, true)`.
2. Verificar que el stock vuelva a 10.

---

### [ ] Paso 15 — Test manual: ADJUSTMENT a valor negativo

1. Crear un producto con stock = 3.
2. Crear un ADJUSTMENT con quantity = -2.
3. Verificar que el stock sea -2.
4. Verificar que `appliedDelta = -5`.

---

## Resumen del cambio

| Tipo       | `quantity` significa | `resolveStockDelta` retorna (antes) | `resolveStockDelta` retorna (despues) |
|------------|----------------------|--------------------------------------|----------------------------------------|
| IN         | delta (+)            | `quantity`                           | `quantity` (sin cambio)                |
| SALE       | delta (-)            | `-quantity`                          | `-quantity` (sin cambio)               |
| ADJUSTMENT | valor absoluto       | `quantity` (BUG)                     | `quantity - currentStock` (FIX)        |
| default    | -                    | `quantity` (silencioso)              | `throw Error` (FIX)                   |

## Archivos modificados

1. `backend/prisma/schema.prisma` — campo `appliedDelta`
2. `backend/repositories/stockMovementRepository.ts` — fix principal
