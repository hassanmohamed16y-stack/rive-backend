-- Persist verified Stripe event identifiers so retries and concurrent deliveries
-- cannot apply an order transition more than once.
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedStripeEvent_stripeEventId_key" ON "ProcessedStripeEvent"("stripeEventId");
CREATE INDEX "ProcessedStripeEvent_orderId_idx" ON "ProcessedStripeEvent"("orderId");
CREATE INDEX "ProcessedStripeEvent_eventType_processedAt_idx" ON "ProcessedStripeEvent"("eventType", "processedAt");