-- B4 (docs/mentora-rebuild/01-audit.md): the unique (fromMenteeId, toMentorId, status)
-- was meant to block duplicate PENDING requests, but it also forbids a second
-- DECLINED / WITHDRAWN / EXPIRED row for the same pair: the second refusal of a
-- re-sent request failed with P2002, and one such row aborted the whole
-- expiry cron batch.
--
-- Replace it with a partial unique index on PENDING rows only. The new index is
-- created before the old one is dropped, inside the migration transaction.
--
-- Pre-flight (read-only, must return 0 rows): scripts/preflight/request-pending-pairs.sql
-- Prisma cannot express partial indexes: the index is documented in schema.prisma
-- on model MentorshipRequest and must survive future `migrate dev` runs.

CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipRequest_pending_pair_key"
  ON "MentorshipRequest" ("fromMenteeId", "toMentorId")
  WHERE "status" = 'PENDING';

DROP INDEX IF EXISTS "MentorshipRequest_fromMenteeId_toMentorId_status_key";
