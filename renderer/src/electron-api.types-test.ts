// Archivo de test de tipos para el renderer. NO se usa en runtime.

async function _checkWindowApi() {
  const products = await window.api.listProducts({ take: 10 })
  const first = products[0]

  // Shape esperado
  const _id: number = first.id
  const _name: string = first.name
  const _barcode: bigint | null = first.barcode
  const _purchase: string = first.purchasePrice
  const _sale: string = first.salePrice
  const _created: Date = first.createdAt
  const _catName: string = first.category.name
  const _supName: string = first.supplier.name

  const maybe = await window.api.getProductById(1)
  // Puede ser null
  const _n: ProductFromApi | null = maybe

  const deleted = await window.api.deleteProduct(1)
  // deleteProduct NO trae category/supplier.
  // @ts-expect-error - deleteProduct devuelve BareProductFromApi.
  const _shouldFail1 = deleted.category

  const movements = await window.api.listStockMovements()
  const m = movements[0]
  const _mDate: Date = m.date
  // product dentro del movimiento viene desnudo.
  // @ts-expect-error - StockMovement.product es BareProductFromApi.
  const _shouldFail2 = m.product.category

  const delMov = await window.api.deleteStockMovement(1, false)
  // @ts-expect-error - deleteStockMovement no incluye product.
  const _shouldFail3 = delMov.product
}

void _checkWindowApi
