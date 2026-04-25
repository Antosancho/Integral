-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL NOT NULL,
    "discountPct" DECIMAL NOT NULL DEFAULT 0
);
INSERT INTO "new_Sale" ("date", "id", "total") SELECT "date", "id", "total" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_date_idx" ON "Sale"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
