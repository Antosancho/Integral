/*
  Warnings:

  - You are about to alter the column `barcode` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "barcode" INTEGER,
    "purchasePrice" DECIMAL NOT NULL,
    "salePrice" DECIMAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "categoryId", "createdAt", "id", "minStock", "name", "purchasePrice", "salePrice", "stock", "supplierId") SELECT "barcode", "categoryId", "createdAt", "id", "minStock", "name", "purchasePrice", "salePrice", "stock", "supplierId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
