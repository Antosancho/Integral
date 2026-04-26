# Plan: Soporte de ítems "General" en createSale

## Objetivo
Permitir que una venta se confirme aunque el carrito tenga líneas de tipo `'general'` (sin `productId`). Esas líneas se persistirán en `SaleItem` con `productId = null`. Se elimina la restricción que bloqueaba el botón "APROBAR VENTA" ante líneas general.

## Alcance de cambios
- Prisma schema + migración (hacer `SaleItem.productId` opcional)
- Backend `saleService.ts` (soportar items sin productId)
- Contrato IPC `electron/ipcContract.ts` (tipos nullable)
- Tipos del renderer `renderer/src/electron-api.d.ts` (tipos nullable)
- `renderer/src/Pages/Sells/Sells.tsx` (mapear todas las líneas, quitar guard)
- `renderer/src/Pages/Sells/PaymentPanel.tsx` (quitar prop y restricción)
- `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx` (manejar product null)
- Tests nuevos en `renderer/src/Pages/Sells/__tests__/`

---

## Pasos

### Paso 1 — Actualizar el schema Prisma

Archivo: `backend/prisma/schema.prisma`

En el modelo `SaleItem`:
- Cambiar `productId Int` → `productId Int?`
- Cambiar la relación `product Product @relation(...)` → `product Product? @relation(...)`

El campo `productId` en el índice `@@index([productId])` puede quedarse igual (SQLite lo soporta con valores null).

### Paso 2 — Crear la migración Prisma

Ejecutar en terminal desde la raíz del proyecto:
```
npx prisma migrate dev --name allow_null_product_in_sale_item
```

Verificar que la migración generada hace exactamente un cambio: vuelve `productId` nullable en `SaleItem`. No debe tocar ningún otro modelo.

### Paso 3 — Actualizar `saleService.ts`

Archivo: `backend/services/saleService.ts`

**3a. Interfaz `CreateSaleItemInput`:** hacer `productId` opcional:
```ts
productId?: number
```

**3b. En `normalizedItems` (función `createSale`):** el campo `productId` del objeto normalizado puede ser `number | undefined`. Preservar el valor tal cual viene (sin forzar a número).

**3c. Validación de productos existentes:** antes de la transacción hay un bloque que obtiene todos los `productId` del array y verifica que existan en la DB. Modificarlo para:
- Solo incluir en `productIds` los items cuyo `productId` no sea `undefined` ni `null`.
- Si `productIds` queda vacío (todas las líneas son general), omitir la consulta de verificación.
- La condición de error (`existingProducts.length !== productIds.length`) solo aplica cuando `productIds.length > 0`.

**3d. Creación del `SaleItem` (dentro de `tx.sale.create`):** en el `create` de cada ítem:
```ts
productId: item.productId ?? null
```

**3e. Loop post-creación (stock y StockMovement):** el loop `for (const item of normalizedItems)` solo debe ejecutar el `tx.product.update` y `tx.stockMovement.create` si `item.productId` existe. Agregar condición:
```ts
if (item.productId == null) continue
```
al inicio del cuerpo del loop.

### Paso 4 — Actualizar `electron/ipcContract.ts`

**4a. `CreateSaleItemPayload`:** hacer `productId` opcional:
```ts
productId?: number
```

**4b. `SaleItemFromApi`:** actualizar los dos campos que pueden ser nulos cuando el ítem es general:
```ts
productId: number | null
product: BareProductFromApi | null
```

### Paso 5 — Actualizar `renderer/src/electron-api.d.ts`

Localizar la interfaz `SaleItemFromApi` en este archivo (es el espejo del contrato IPC para el renderer). Hacer los mismos dos cambios:
```ts
productId: number | null
product: BareProductFromApi | null
```

> Nota: este archivo duplica los tipos de `ipcContract.ts`; ambos deben quedar en sincronía.

### Paso 6 — Actualizar `renderer/src/Pages/Sells/Sells.tsx`

En la función `handleConfirmSale`:

**6a. Quitar el guard de líneas general:**
Eliminar completamente la línea:
```ts
if (cart.lines.some(l => l.kind === 'general')) return
```

**6b. Quitar el filtro a solo líneas 'product':**
Eliminar la línea:
```ts
const productLines = cart.lines.filter(l => l.kind === 'product')
```

**6c. Actualizar la guard de carrito vacío:**
Cambiar:
```ts
if (productLines.length === 0) return
```
por:
```ts
if (cart.lines.length === 0) return
```

**6d. Mapear todas las líneas al payload:**
Reemplazar el bloque de `items` para mapear `cart.lines` (no `productLines`) distinguiendo por `kind`:
- Si `l.kind === 'product'`: `{ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice }`
- Si `l.kind === 'general'`: `{ quantity: l.quantity, unitPrice: l.unitPrice }` (sin `productId`)

**6e. Quitar la variable `hasGeneralLines`:**
Eliminar la línea:
```ts
const hasGeneralLines = cart.lines.some(l => l.kind === 'general')
```

**6f. Quitar la prop `hasGeneralLines` del JSX:**
En el `<PaymentPanel ...>`, eliminar la prop `hasGeneralLines={hasGeneralLines}`.

### Paso 7 — Actualizar `renderer/src/Pages/Sells/PaymentPanel.tsx`

**7a. Quitar `hasGeneralLines` del tipo `Props`:**
Eliminar el campo `hasGeneralLines: boolean` de la interfaz `Props`.

**7b. Quitar del destructuring:**
Eliminar `hasGeneralLines` de la lista de parámetros destructurados.

**7c. Actualizar `canConfirm`:**
Cambiar:
```ts
const canConfirm = hasItems && covers && !hasGeneralLines
```
por:
```ts
const canConfirm = hasItems && covers
```

**7d. Quitar el hint:**
Eliminar el bloque:
```tsx
{hasItems && hasGeneralLines && (
  <p className="payment-panel__hint">Las líneas General aún no se pueden guardar</p>
)}
```

### Paso 8 — Actualizar `renderer/src/Pages/SalesHistory/SaleDetailModal.tsx`

En la tabla de ítems, la celda de nombre del producto accede actualmente a `item.product.name`. Ahora `item.product` puede ser `null` para ítems general. 

Cambiar la celda `<td>{item.product.name}</td>` por:
```tsx
<td>{item.product?.name ?? 'General'}</td>
```

---

## Tests a agregar

### Paso 9 — Crear `renderer/src/Pages/Sells/__tests__/confirmSaleItems.test.ts`

Este archivo testea la lógica de mapeo de `CartLine` → `CreateSaleItemPayload` de forma pura (sin montar el componente). Para hacerlo testeable sin montar el componente, extraer la función de mapeo como utilidad privada en un archivo auxiliar **o** testear directamente la lógica inline.

**Opción preferida:** extraer la función de mapeo a `renderer/src/Pages/Sells/confirmSaleUtils.ts`, exportarla, e importarla tanto desde `Sells.tsx` como desde el test.

La función a extraer:
```ts
export function buildSaleItems(lines: CartLine[]): CreateSaleItemPayload[]
```

Que implementa exactamente la lógica del paso 6d.

**Tests a escribir** en `confirmSaleItems.test.ts`:

1. **Línea 'product' genera item con productId:** una línea `kind='product'` con `productId=5`, `quantity=2`, `unitPrice='100'` → el array resultado tiene un objeto con `productId: 5`, `quantity: 2`, `unitPrice: '100'`.

2. **Línea 'general' genera item sin productId:** una línea `kind='general'` con `quantity=1`, `unitPrice='500'` → el array resultado tiene un objeto sin `productId` (o con `productId` ausente/undefined).

3. **Carrito mixto (product + general):** un carrito con una línea product y una general → resultado tiene dos ítems: uno con `productId` y uno sin `productId`.

4. **Carrito solo general:** dos líneas general → dos ítems sin `productId`.

5. **Carrito vacío:** array vacío → resultado es array vacío.

### Paso 10 — Agregar tests al test de `PaymentPanel` (si existe) o crear uno nuevo

Si no existe `renderer/src/Pages/Sells/__tests__/PaymentPanel.test.tsx`, crearlo. Si existe, agregar estos casos:

Testear el componente `PaymentPanel` con `@testing-library/react`:

1. **Sin hasGeneralLines, con items y pagos suficientes:** el botón "APROBAR VENTA" está habilitado.

2. **Con carrito vacío (hasItems=false):** el botón está deshabilitado.

3. **Con pagos insuficientes (covers=false):** el botón está deshabilitado.

4. **El hint "Las líneas General" no aparece nunca** en el DOM (verificar que el texto no existe).

> Nota: si el proyecto no tiene configurado `@testing-library/react`, omitir el test del componente y solo agregar el test unitario de `confirmSaleUtils.ts` del paso 9.

---

## Criterios de éxito (checklist)

- [ ] La migración Prisma corre sin errores y `SaleItem.productId` es nullable en la DB
- [ ] `createSale` acepta items sin `productId` y los persiste con `productId = null`
- [ ] `createSale` NO actualiza stock ni crea `StockMovement` para items sin `productId`
- [ ] `createSale` sigue validando que los productos con `productId` existan en la DB
- [ ] El botón "APROBAR VENTA" se habilita cuando hay ítems general en el carrito (siempre que pagos ≥ total)
- [ ] El hint "Las líneas General aún no se pueden guardar" no aparece más en la UI
- [ ] En el historial de ventas, los ítems general muestran "General" como nombre de producto (no crashean)
- [ ] Las ventas solo con productos (sin general) siguen funcionando igual que antes
- [ ] Todos los tests nuevos de `confirmSaleItems.test.ts` pasan
- [ ] Los tests existentes de `cartReducer.test.ts`, `payments.test.ts`, `SalesHistory.test.tsx`, etc. siguen pasando sin modificación
