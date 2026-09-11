-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymobIntentionId" TEXT,
ADD COLUMN     "paymobTransactionId" TEXT;

-- CreateTable
CREATE TABLE "ProcessedPaymobEvent" (
    "id" TEXT NOT NULL,
    "paymobTransactionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedPaymobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymobIntentionId_key" ON "Order"("paymobIntentionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymobTransactionId_key" ON "Order"("paymobTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedPaymobEvent_paymobTransactionId_key" ON "ProcessedPaymobEvent"("paymobTransactionId");

-- CreateIndex
CREATE INDEX "ProcessedPaymobEvent_orderId_idx" ON "ProcessedPaymobEvent"("orderId");

-- CreateIndex
CREATE INDEX "ProcessedPaymobEvent_eventType_processedAt_idx" ON "ProcessedPaymobEvent"("eventType", "processedAt");
