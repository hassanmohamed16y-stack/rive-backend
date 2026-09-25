-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'PUBLISHED';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "seoDescription" TEXT,
ADD COLUMN "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "StaticPage" ADD COLUMN "seoDescription" TEXT,
ADD COLUMN "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN "publishAt" TIMESTAMP(3),
ADD COLUMN "unpublishAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "storeName" TEXT NOT NULL DEFAULT 'RIVÉ',
    "logoUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "whatsappNumber" TEXT,
    "tiktokUrl" TEXT,
    "isMaintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "minimumOrderAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "businessHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_displayOrder_idx" ON "Product"("displayOrder");

-- CreateIndex
CREATE INDEX "InternalNote_entityType_entityId_idx" ON "InternalNote"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "InternalNote_createdById_idx" ON "InternalNote"("createdById");

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
