-- Hot-path indexes audit (Phase 2 task #34).
--
-- 1. User.deletedAt: purge cron filters by `deletedAt < threshold`.
--    Without an index Postgres scans every row.
-- 2. Account.userId: cascade-delete from User.deleteMany would
--    otherwise scan Account sequentially per deleted user.
--
-- IF NOT EXISTS makes the migration idempotent — important because
-- some environments may already carry these indexes from an earlier
-- `prisma db push` round-trip. Without the guard, `migrate deploy`
-- crashes on Postgres error 42P07 ("relation already exists").
--
-- We do NOT use CREATE INDEX CONCURRENTLY here — Prisma `migrate
-- deploy` wraps each migration in a transaction and CONCURRENTLY is
-- not allowed inside one. Re-evaluate on prod table size; if either
-- table grows past ~10 M rows, run a manual `CREATE INDEX
-- CONCURRENTLY` outside the migration and rely on
-- `prisma migrate resolve --applied` to bring the migration history
-- in line.

CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
