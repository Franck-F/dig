-- Tâche 8 — replace JSON-path idempotency with a dedicated column.
-- Existing already-reminded sessions stay un-stamped (NULL), so the next
-- cron run might re-notify them. That's a one-time, bounded cost; the
-- alternative (back-fill from Notification.payload) would itself need a
-- table scan. We accept the duplicate-notify on the migration boundary.

ALTER TABLE "Session" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Composite index for the cron's hot path:
--   WHERE status = 'SCHEDULED'
--     AND reminderSentAt IS NULL
--     AND scheduledAt < now() + 48h
-- Order in the index matches selectivity: status filters most rows out,
-- reminderSentAt narrows further, scheduledAt is the range scan.
CREATE INDEX "Session_status_reminderSentAt_scheduledAt_idx"
  ON "Session"("status", "reminderSentAt", "scheduledAt");
