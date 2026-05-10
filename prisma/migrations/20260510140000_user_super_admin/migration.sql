-- Adds `User.isSuperAdmin` boolean — additive on top of `role = ADMIN`.
-- Plain admins handle day-to-day admin work; super admins are the only
-- ones allowed to manage other admins and override platform-wide
-- governance. Existing role checks (`role === 'ADMIN'`) keep working
-- unchanged. Default `false` so the schema change is non-breaking;
-- the bootstrap super admin is set explicitly via the seed script
-- (`prisma/seed-test-accounts.ts`).
--
-- Idempotent: skip if the column already exists, so re-running the
-- migration on a partially-applied environment is a no-op.

DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
