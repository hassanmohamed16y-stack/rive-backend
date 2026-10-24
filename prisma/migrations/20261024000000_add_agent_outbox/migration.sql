-- CreateTable
CREATE TABLE "AgentOutbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextTryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentOutbox_status_nextTryAt_idx" ON "AgentOutbox"("status", "nextTryAt");

-- CreateIndex
CREATE INDEX "AgentOutbox_createdAt_idx" ON "AgentOutbox"("createdAt");

-- CreateTable
CREATE TABLE "AgentRequest" (
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRequest_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AgentRequest_createdAt_idx" ON "AgentRequest"("createdAt");

-- Ad attribution on orders (all optional, no default, no backfill)
ALTER TABLE "Order" ADD COLUMN "utmSource" TEXT,
ADD COLUMN "utmMedium" TEXT,
ADD COLUMN "utmCampaign" TEXT,
ADD COLUMN "utmContent" TEXT;
