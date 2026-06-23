-- RGPD inactive-account retention: track the last successful sign-in so the
-- daily cron can soft-delete accounts idle for more than 3 years.
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- The retention cron filters `lastLoginAt < threshold`; index to avoid a seq scan.
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");
