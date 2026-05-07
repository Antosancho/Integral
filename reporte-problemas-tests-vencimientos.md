# Reporte para continuar depuracion

## Contexto

Se implemento la feature indicada en `plan.md`: columna toggleable de `Vencimientos` en Stock, `showExpiry` en `SearchPopup`, helper `sortLots/groupLotsByProduct`, componente `LotsList` y canal IPC `stockMovement:listLotsByProductIds`.

Durante la verificacion aparecieron dos fallas en scripts integrales existentes. Las fallas no parecen originadas por la feature nueva: al retirar los chequeos agregados temporalmente en esos scripts, los mismos comandos siguieron fallando en el mismo punto.

## Estado de verificacion

Comandos que pasan:

```powershell
npm --workspace renderer test
```

Resultado: 29 test files, 366 tests, todo en verde.

```powershell
npm run test:backend
```

Resultado: pasa completo.

```powershell
npm run build
```

Resultado: `tsc` pasa.

Comandos que fallan:

```powershell
npm run test:backend-db
```

Falla:

```text
FAILED: deleteStockMovement should remove movement rows, got 1 remaining
```

```powershell
npm run test:ipc-bridge
```

Falla:

```text
FAILED: deleteStockMovement should remove rows
```

## Archivos relevantes

- `backend/test.ts`
- `backend/testIpcBridge.ts`
- `backend/repositories/stockMovementRepository.ts`
- `backend/repositories/productRepository.ts`
- `backend/services/saleService.ts`

## Punto exacto de falla

En `backend/test.ts`, la falla ocurre despues de estos pasos:

1. Se crea un producto.
2. Se crean movimientos:
   - `movementIn` (`IN`)
   - `movementSale` (`SALE`)
   - `movementAdjustment` (`ADJUSTMENT`)
3. Se borran algunos movimientos con y sin revert.
4. Luego se crean escenarios de stock negativo:
   - `negativeSale`
   - `inToRevert`
5. Se ejecuta:

```ts
await deleteStockMovement(movementIn.id)
await deleteStockMovement(negativeSale.id)
const remainingMovements = await listStockMovements({ productId: product.id })
assert(remainingMovements.length === 0, ...)
```

Pero queda 1 movimiento remanente.

En `backend/testIpcBridge.ts` ocurre el equivalente via `api.deleteStockMovement(...)` y `api.listStockMovements({ productId })`.

## Hipotesis principal

Probablemente queda sin borrar un movimiento creado en los escenarios intermedios, no necesariamente uno de los dos que se eliminan justo antes de la asercion.

Candidatos a revisar:

- `inToRevert`: se borra con `deleteStockMovement(inToRevert.id, true)`, pero conviene confirmar que realmente desaparece de DB.
- `movementSale`: se borra antes con revert.
- `movementAdjustment`: se borra antes con revert.
- Cualquier movimiento creado por side effects en `createSale` o por operaciones de ajuste/stock negativo.

La forma mas rapida de aislarlo es instrumentar temporalmente el test antes de la asercion:

```ts
const remainingMovements = await listStockMovements({ productId: product.id })
console.log(remainingMovements.map((m) => ({
  id: m.id,
  type: m.type,
  quantity: m.quantity,
  appliedDelta: m.appliedDelta,
  notes: m.notes,
  saleId: m.saleId
})))
```

Hacer lo mismo en `backend/testIpcBridge.ts` usando `asRecord` sobre cada item.

## Feature nueva relacionada

La feature nueva agrego:

- `listLotsByProductIds(productIds: number[])` en `backend/repositories/stockMovementRepository.ts`.
- Handler IPC `stockMovement:listLotsByProductIds` en `electron/ipcHandlers.ts`.
- Metodo `listLotsByProductIds` en `electron/ipcContract.ts` y `renderer/src/electron-api.d.ts`.

El repo nuevo solo hace `findMany`; no escribe ni borra datos:

```ts
return prisma.stockMovement.findMany({
  where: {
    productId: { in: productIds },
    type: "IN",
    expiryDismissedAt: null,
    quantity: { gt: 0 }
  },
  orderBy: { expiryDate: "asc" },
  include: { product: true }
})
```

Por eso no deberia afectar la limpieza de movimientos.

## Recomendacion para la proxima AI

1. Reproducir con:

```powershell
npm run test:backend-db
npm run test:ipc-bridge
```

2. Agregar logging temporal del movimiento remanente justo antes de la asercion.
3. Identificar cual movimiento queda vivo y en que paso deberia borrarse.
4. Decidir si el bug esta en:
   - el test, porque espera 0 pero creo un movimiento que no borra;
   - `deleteStockMovement`, porque alguna rama no borra cuando `revertStock=true`;
   - algun flujo que crea un movimiento adicional no contemplado.
5. Agregar una asercion especifica para el caso hallado, no solo `remainingMovements.length === 0`.

## Nota de cuidado

El repo estaba sucio antes de esta implementacion, con muchos archivos ya modificados. No usar `git reset --hard` ni revertir cambios globales. Limitar la correccion a los archivos relacionados y verificar el diff antes de tocar tests o DB.
