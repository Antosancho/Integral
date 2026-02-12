import { Prisma } from "@prisma/client"
import prisma from "./db/client"

async function main() {
  const category = await prisma.category.create({
    data: {
      name: "Bebidas"
    }
  })

  const supplier = await prisma.supplier.create({
    data: {
      name: "Distribuidora Central"
    }
  })

  const product = await prisma.product.create({
    data: {
      name: "Coca Cola 500ml",
      purchasePrice: new Prisma.Decimal(500),
      salePrice: new Prisma.Decimal(750),
      categoryId: category.id,
      supplierId: supplier.id
    }
  })

  console.log("Producto creado:", product)
}

main()
