-- CreateTable
CREATE TABLE "ListType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "listTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListType_key_key" ON "ListType"("key");

-- CreateIndex
CREATE INDEX "ListItem_listTypeId_idx" ON "ListItem"("listTypeId");

-- CreateIndex
CREATE INDEX "ListItem_isActive_idx" ON "ListItem"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_listTypeId_key_key" ON "ListItem"("listTypeId", "key");

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listTypeId_fkey" FOREIGN KEY ("listTypeId") REFERENCES "ListType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
