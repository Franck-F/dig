-- Hot-path indexes audit (Phase 2 task #34).
--
-- 1. User.deletedAt: purge cron filters by `deletedAt < threshold`.
--    Without an index Postgres scans every row.
-- 2. Account.userId: cascade-delete from User.deleteMany would
--    otherwise scan Account sequentially per deleted user.
--
-- Both are non-unique indexes. CONCURRENTLY would skip the table lock
-- but Prisma migrate doesn't support concurrent index creation; on
-- a small table at this stage that's fine. Re-evaluate on prod size.

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
