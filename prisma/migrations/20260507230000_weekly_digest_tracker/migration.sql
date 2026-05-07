-- P4 task #50 — separate tracker for the weekly content recap.
-- Distinct from the existing `lastDigestSentAt` which gates the daily
-- notification digest. Letting them share would couple two flows
-- whose cadence and content differ.
ALTER TABLE "CommunityMember"
  ADD COLUMN IF NOT EXISTS "lastWeeklyDigestSentAt" TIMESTAMP(3);
