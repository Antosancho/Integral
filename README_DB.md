# Database Guide (SQLite + Prisma + Backend Repositories)

This document explains how data access works in this project and how to use the repository functions from the backend layer.

## Architecture
Renderer (React) -> Electron/Backend -> Prisma Client -> SQLite (`backend/prisma/dev.db`)

## Key files
- `backend/prisma/schema.prisma`: database models and relations.
- `backend/prisma/migrations/`: migration history.
- `backend/db/client.ts`: shared Prisma client instance.
- `backend/repositories/`: backend-facing data access functions.
- `backend/repositories/utilities.ts`: shared validation/normalization helpers.

## Commands
- `npm run prisma:generate`: regenerate Prisma client.
- `npm run prisma:migrate`: create/apply migrations.
- `npm run prisma:reset`: drop and recreate local database (destructive).
- `npm run prisma:studio`: open DB explorer.

## Models
- `Category`: `id`, `name` (unique)
- `Supplier`: `id`, `name`, `phone?`, `notes?`
- `Product`: `id`, `name`, `barcode?` (unique integer), `purchasePrice`, `salePrice`, `stock`, `minStock`, `categoryId`, `supplierId`
- `StockMovement`: `id`, `productId`, `type` (`IN|SALE|ADJUSTMENT` in app-level validation), `quantity`, `date`, `notes?`

## How to import repository functions
Use the backend service barrel:

```ts
import {
  createProduct,
  listProducts,
  createCategory,
  createSupplier,
  createStockMovement
} from "../services"
```

You can also import directly from `backend/repositories`.

## Repository API

### Category
- `createCategory({ name })`
- `listCategories()`
- `getCategoryById(id)`
- `updateCategory(id, { name? })`
- `deleteCategory(id)`

### Supplier
- `createSupplier({ name, phone?, notes? })`
- `listSuppliers()`
- `getSupplierById(id)`
- `updateSupplier(id, { name?, phone?, notes? })`
- `deleteSupplier(id)`

### Product
- `createProduct({ name, purchasePrice, salePrice, categoryId, supplierId, barcode?, stock?, minStock? })`
- `listProducts({ id?, barcode?, categoryId?, supplierId?, nameContains?, skip?, take? })`
- `getProductById(id)`
- `getProductByBarcode(barcode)`
- `updateProduct(id, { ...partial fields... })`
- `updateProductStock(id, stock)` (absolute value)
- `changeProductStock(id, delta)` (relative value)
- `deleteProduct(id)`

### StockMovement
- `createStockMovement({ productId, type, quantity, notes?, date?, applyToStock? })`
- `listStockMovements({ productId?, type?, fromDate?, toDate?, skip?, take? })`
- `getStockMovementById(id)`
- `deleteStockMovement(id, revertStock?)`

## Usage examples

### Create a product
```ts
const product = await createProduct({
  name: "Coke 500ml",
  purchasePrice: "500.00",
  salePrice: "750.00",
  categoryId: 1,
  supplierId: 1,
  barcode: 123456789,
  stock: 20,
  minStock: 5
})
```

### Filter by id or barcode
```ts
const byId = await getProductById(1)
const byBarcode = await getProductByBarcode(123456789)
```

### List products with search and pagination
```ts
const rows = await listProducts({
  nameContains: "coke",
  take: 20,
  skip: 0
})
```

### Register stock movement
```ts
await createStockMovement({
  productId: 1,
  type: "SALE",
  quantity: 2,
  notes: "Counter sale",
  applyToStock: true
})
```

## Validation and behavior notes
- Prices accept `number | string | Prisma.Decimal` and are normalized to `Decimal`.
- `barcode` is an optional unique integer.
- `stock` and `minStock` cannot be negative.
- `createStockMovement` runs in a transaction:
  - `IN` adds stock
  - `SALE` subtracts stock
  - `ADJUSTMENT` applies quantity as delta
- `deleteStockMovement(id, true)` reverts stock impact before deleting movement.

## Common workflow
1. Update schema in `backend/prisma/schema.prisma` if model changes are needed.
2. Run `npm run prisma:migrate`.
3. Run `npm run prisma:generate`.
4. Call repository functions from services/controllers.
5. Verify with `npm run prisma:studio`.
