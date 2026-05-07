import type { IpcMain } from "electron"
import {
  changeProductStock,
  createCategory,
  createProduct,
  createStockMovement,
  createSupplier,
  deleteCategory,
  deleteProduct,
  deleteStockMovement,
  deleteSupplier,
  dismissStockMovementExpiry,
  getCategoryById,
  getProductByBarcode,
  getProductById,
  getStockMovementById,
  getSupplierById,
  listLotsByProductIds,
  listCategories,
  listExpiringStockMovements,
  listProducts,
  listStockMovements,
  listSuppliers,
  updateCategory,
  updateProduct,
  updateProductStock,
  updateSupplier,
  getSalesSummary,
  getTopProductsByQuantity,
  getTopProductsByRevenue,
  getSalesByHour,
  getSalesByWeekday,
  getLowRotationProducts,
  type CreateCategoryInput,
  type CreateProductInput,
  type CreateStockMovementInput,
  type CreateSupplierInput,
  type ListStockMovementsFilters,
  type ProductFilters,
  type UpdateCategoryInput,
  type UpdateProductInput,
  type UpdateSupplierInput
} from "../backend/repositories"
import { toIpcSafe } from "./ipcSerialize"
import {
  createSale,
  getSaleById,
  listSales,
  type CreateSaleInput,
  type ListSalesFilters
} from "../backend/services/saleService"

export type IpcPayload = unknown
export type IpcHandler = (payload: IpcPayload) => Promise<unknown>
export type IpcHandlerMap = Record<string, IpcHandler>

function toIpcError(channel: string, error: unknown): Error {
  if (error instanceof Error) {
    const maybeCode = (error as { code?: unknown }).code
    const code = typeof maybeCode === "string" ? maybeCode : null
    return new Error(code ? `[${channel}] ${code}: ${error.message}` : `[${channel}] ${error.message}`)
  }

  if (typeof error === "string") {
    return new Error(`[${channel}] ${error}`)
  }

  return new Error(`[${channel}] Unknown error`)
}

function withChannelError<TPayload>(
  channel: string,
  handler: (payload: TPayload) => Promise<unknown> | unknown
): IpcHandler {
  return async (payload) => {
    try {
      const result = await handler(payload as TPayload)
      return toIpcSafe(result)
    } catch (error) {
      throw toIpcError(channel, error)
    }
  }
}

export function buildIpcHandlers(): IpcHandlerMap {
  return {
    "category:create": withChannelError<{ data: CreateCategoryInput }>("category:create", ({ data }) =>
      createCategory(data)
    ),
    "category:list": withChannelError<Record<string, never>>("category:list", () => listCategories()),
    "category:getById": withChannelError<{ id: number }>("category:getById", ({ id }) =>
      getCategoryById(id)
    ),
    "category:update": withChannelError<{ id: number; data: UpdateCategoryInput }>(
      "category:update",
      ({ id, data }) => updateCategory(id, data)
    ),
    "category:delete": withChannelError<{ id: number }>("category:delete", ({ id }) =>
      deleteCategory(id)
    ),

    "supplier:create": withChannelError<{ data: CreateSupplierInput }>("supplier:create", ({ data }) =>
      createSupplier(data)
    ),
    "supplier:list": withChannelError<Record<string, never>>("supplier:list", () => listSuppliers()),
    "supplier:getById": withChannelError<{ id: number }>("supplier:getById", ({ id }) =>
      getSupplierById(id)
    ),
    "supplier:update": withChannelError<{ id: number; data: UpdateSupplierInput }>(
      "supplier:update",
      ({ id, data }) => updateSupplier(id, data)
    ),
    "supplier:delete": withChannelError<{ id: number }>("supplier:delete", ({ id }) =>
      deleteSupplier(id)
    ),

    "product:create": withChannelError<{ data: CreateProductInput }>("product:create", ({ data }) =>
      createProduct(data)
    ),
    "product:list": withChannelError<{ filters?: ProductFilters }>("product:list", ({ filters }) =>
      listProducts(filters)
    ),
    "product:getById": withChannelError<{ id: number }>("product:getById", ({ id }) =>
      getProductById(id)
    ),
    "product:getByBarcode": withChannelError<{ barcode: bigint | number | string }>(
      "product:getByBarcode",
      ({ barcode }) => getProductByBarcode(barcode)
    ),
    "product:update": withChannelError<{ id: number; data: UpdateProductInput }>(
      "product:update",
      ({ id, data }) => updateProduct(id, data)
    ),
    "product:updateStock": withChannelError<{ id: number; stock: number }>(
      "product:updateStock",
      ({ id, stock }) => updateProductStock(id, stock)
    ),
    "product:changeStock": withChannelError<{ id: number; delta: number }>(
      "product:changeStock",
      ({ id, delta }) => changeProductStock(id, delta)
    ),
    "product:delete": withChannelError<{ id: number }>("product:delete", ({ id }) =>
      deleteProduct(id)
    ),

    "stockMovement:create": withChannelError<{ data: CreateStockMovementInput }>(
      "stockMovement:create",
      ({ data }) => createStockMovement(data)
    ),
    "stockMovement:list": withChannelError<{ filters?: ListStockMovementsFilters }>(
      "stockMovement:list",
      ({ filters }) => listStockMovements(filters)
    ),
    "stockMovement:listLotsByProductIds": withChannelError<{ productIds?: unknown }>(
      "stockMovement:listLotsByProductIds",
      (payload) => {
        const productIds = payload?.productIds
        if (!Array.isArray(productIds)) {
          throw new Error("productIds must be an array")
        }
        if (!productIds.every((id) => typeof id === "number" && Number.isInteger(id))) {
          throw new Error("productIds must contain only integer numbers")
        }

        return listLotsByProductIds(productIds)
      }
    ),
    "stockMovement:getById": withChannelError<{ id: number }>("stockMovement:getById", ({ id }) =>
      getStockMovementById(id)
    ),
    "stockMovement:delete": withChannelError<{ id: number; revertStock?: boolean }>(
      "stockMovement:delete",
      ({ id, revertStock }) => deleteStockMovement(id, revertStock ?? false)
    ),
    "stockMovement:listExpiring": withChannelError<Record<string, never>>(
      "stockMovement:listExpiring",
      () => listExpiringStockMovements()
    ),
    "stockMovement:dismissExpiry": withChannelError<{ id: number }>(
      "stockMovement:dismissExpiry",
      ({ id }) => dismissStockMovementExpiry(id)
    ),

    "sale:create": withChannelError<{ data: CreateSaleInput }>("sale:create", ({ data }) =>
      createSale(data)
    ),
    "sale:list": withChannelError<{ filters?: ListSalesFilters }>("sale:list", ({ filters }) =>
      listSales(filters)
    ),
    "sale:getById": withChannelError<{ id: number }>("sale:getById", ({ id }) =>
      getSaleById(id)
    ),

    "stats:getSummary": withChannelError<{ from: Date; to: Date }>(
      "stats:getSummary",
      ({ from, to }) => getSalesSummary(from, to)
    ),
    "stats:getTopProductsByQuantity": withChannelError<{ from: Date; to: Date; limit: number }>(
      "stats:getTopProductsByQuantity",
      ({ from, to, limit }) => getTopProductsByQuantity(from, to, limit)
    ),
    "stats:getTopProductsByRevenue": withChannelError<{ from: Date; to: Date; limit: number }>(
      "stats:getTopProductsByRevenue",
      ({ from, to, limit }) => getTopProductsByRevenue(from, to, limit)
    ),
    "stats:getSalesByHour": withChannelError<{ from: Date; to: Date }>(
      "stats:getSalesByHour",
      ({ from, to }) => getSalesByHour(from, to)
    ),
    "stats:getSalesByWeekday": withChannelError<{ from: Date; to: Date }>(
      "stats:getSalesByWeekday",
      ({ from, to }) => getSalesByWeekday(from, to)
    ),
    "stats:getLowRotationProducts": withChannelError<{ from: Date; to: Date; limit: number }>(
      "stats:getLowRotationProducts",
      ({ from, to, limit }) => getLowRotationProducts(from, to, limit)
    )
  }
}

export function registerIpcHandlers(ipcMain: Pick<IpcMain, "handle">) {
  const handlers = buildIpcHandlers()

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, payload) => handler(payload))
  }
}

export async function invokeIpcHandler(
  handlers: IpcHandlerMap,
  channel: string,
  payload: unknown
) {
  const handler = handlers[channel]
  if (!handler) {
    throw new Error(`[${channel}] No handler registered`)
  }

  return handler(payload)
}
