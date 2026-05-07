-- P4 task #48 — Postgres full-text search on Post.
--
-- A generated tsvector column lets the database keep the index in sync
-- with title/body without an application-side trigger. Stored (not
-- VIRTUAL) so the GIN index is usable by SELECTs.
--
-- Weights:
--   A — title (highest priority for ranking)
--   B — body
--
-- Language config: 'french' uses the French dictionary shipped with
-- Postgres. Strips stop words ("le", "la", "de"), normalises plurals,
-- accents stripped where appropriate. We chose 'french' because the
-- platform's primary language is French; if multilingual ever lands,
-- swap for 'simple' or run two columns.
--
-- IF NOT EXISTS guards keep the migration idempotent for the same
-- reason as 20260507200000 (some envs may already carry pieces from
-- a `prisma db push` round-trip).

ALTER TABLE "Post"
  ADD COLUMN IF NOT EXISTS "searchTsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('french', coalesce("body", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Post_searchTsv_idx" ON "Post" USING GIN ("searchTsv");
