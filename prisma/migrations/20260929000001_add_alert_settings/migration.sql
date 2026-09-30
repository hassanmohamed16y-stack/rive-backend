-- CreateTable
CREATE TABLE "AlertSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "alertEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "newOrderAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowStockAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "failedPaymentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSettings_pkey" PRIMARY KEY ("id")
);
