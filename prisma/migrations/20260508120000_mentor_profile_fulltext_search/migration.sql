-- P8 #75 — Postgres full-text search on MentorProfile.
--
-- Mirrors the Post FTS migration (20260507220000_post_fulltext_search):
-- a generated tsvector column kept in sync by Postgres itself, plus a
-- GIN index for sub-millisecond lookup.
--
-- Weights:
--   A — headline   (short, focused, highest signal-to-noise)
--   B — bio        (long-form, lower density)
--
-- We deliberately do NOT include skills here — they live in MentorSkill
-- + Skill via a many-to-many, which can't be folded into a generated
-- column without a trigger or a denormalised text field. The existing
-- `skillSlugs` filter on the action layer already covers that path
-- (chip click → exact slug match). Free-form `q` is for headline/bio,
-- chip click is for skills — two complementary axes.
--
-- Language config: 'french' uses the French dictionary shipped with
-- Postgres. Stop-words ("le", "la", "de"…), plurals normalised, accents
-- stripped where appropriate. Same choice as Post — when multilingual
-- content lands we'll either flip both columns to 'simple' or run a
-- dual-column setup.
--
-- IF NOT EXISTS guards keep the migration idempotent in case a
-- `prisma db push` round-trip already created pieces of it.

ALTER TABLE "MentorProfile"
  ADD COLUMN IF NOT EXISTS "searchTsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce("headline", '')), 'A') ||
    setweight(to_tsvector('french', coalesce("bio", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "MentorProfile_searchTsv_idx"
  ON "MentorProfile" USING GIN ("searchTsv");
