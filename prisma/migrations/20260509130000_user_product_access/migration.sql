-- Per-product access flags. Mentora and Community are now independent
-- products — a user can sign up for one, the other, or both. New
-- accounts default to false (the signup chooser sets them explicitly);
-- pre-existing accounts are backfilled to true so they keep the
-- behaviour they already had (every existing user could see both
-- universes from the hub).
--
-- Idempotent: ADD COLUMN guards on duplicate_column; the backfill UPDATE
-- only matches rows created BEFORE the migration timestamp so re-runs
-- are no-ops.

DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "mentoraEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "communityEnabled" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- One-shot backfill, idempotent via the createdAt cutoff.
UPDATE "User"
SET "mentoraEnabled" = true,
    "communityEnabled" = true
WHERE "createdAt" < TIMESTAMP '2026-05-09 13:00:00'
  AND ("mentoraEnabled" = false OR "communityEnabled" = false);
