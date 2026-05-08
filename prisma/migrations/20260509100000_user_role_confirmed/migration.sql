-- Track whether a user has explicitly chosen their role. The schema
-- default `STUDENT` on User.role is a placeholder so OAuth signups land
-- somewhere — but we now ask new OAuth users to pick before letting them
-- continue. Default `true` so existing rows are pre-confirmed and don't
-- get bounced through the role wizard.
--
-- Idempotent: skip if column already exists.

DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "roleConfirmed" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
