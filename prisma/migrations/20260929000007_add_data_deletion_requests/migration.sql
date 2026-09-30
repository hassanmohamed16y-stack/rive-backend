-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataDeletionRequest_userId_idx" ON "DataDeletionRequest"("userId");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_status_idx" ON "DataDeletionRequest"("status");

-- AddForeignKey
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
