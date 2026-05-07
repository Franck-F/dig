-- Email-bounce tracking. Populated by /api/webhooks/resend on
-- bounce/complaint events. All sends skip rows where this is non-null.

ALTER TABLE "User" ADD COLUMN "emailBouncedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailBouncedReason" TEXT;

-- Partial index — most queries filter `WHERE emailBouncedAt IS NULL`
-- (the live audience). Indexing only the bounced rows keeps the index
-- tiny while still serving fast lookups when the webhook fires.
CREATE INDEX "User_emailBouncedAt_idx" ON "User"("emailBouncedAt") WHERE "emailBouncedAt" IS NOT NULL;
