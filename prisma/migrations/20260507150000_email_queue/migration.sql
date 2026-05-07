-- CreateEnum
CREATE TYPE "EmailQueueStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "EmailQueueItem" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "audienceTag" TEXT NOT NULL,
    "status" "EmailQueueStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotency: same campaign × same recipient = no-op on re-enqueue)
CREATE UNIQUE INDEX "EmailQueueItem_audienceTag_to_key" ON "EmailQueueItem"("audienceTag", "to");

-- CreateIndex (drainer's hot path: pick PENDING/SENDING ordered by scheduledFor)
CREATE INDEX "EmailQueueItem_status_scheduledFor_idx" ON "EmailQueueItem"("status", "scheduledFor");

-- CreateIndex (campaign-level reporting: status counts by audienceTag)
CREATE INDEX "EmailQueueItem_audienceTag_idx" ON "EmailQueueItem"("audienceTag");
