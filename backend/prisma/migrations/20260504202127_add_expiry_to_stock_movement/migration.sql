-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "expiryDate" DATETIME;
ALTER TABLE "StockMovement" ADD COLUMN "expiryDismissedAt" DATETIME;

-- CreateIndex
CREATE INDEX "StockMovement_expiryDate_idx" ON "StockMovement"("expiryDate");
