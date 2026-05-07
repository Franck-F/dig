-- Soft-delete columns on the entities that need RGPD-compliant
-- "deletion that can be reversed for 30 days, then purged".
-- All nullable: existing rows stay live (deletedAt IS NULL).

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "MentorProfile" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "MenteeProfile" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "CommunityMember" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Partial indexes — most queries filter `WHERE deletedAt IS NULL`, so
-- we get fast scans on the live subset without paying the cost of
-- indexing the entire history. The cron that purges old rows uses
-- the second branch via a separate query path.
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt") WHERE "deletedAt" IS NOT NULL;
CREATE INDEX "CommunityMember_deletedAt_idx" ON "CommunityMember"("deletedAt") WHERE "deletedAt" IS NOT NULL;
