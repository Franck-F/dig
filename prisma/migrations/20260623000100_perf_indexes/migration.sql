-- Perf indexes (audit §4/§5.1) — no behaviour change, scan → index.

-- Admin cycles page: count mentorships whose startedAt falls in a date window.
CREATE INDEX "Mentorship_startedAt_idx" ON "Mentorship"("startedAt");

-- Messages inbox: per-mentorship unread groupBy (mentorshipId + readByOtherAt).
CREATE INDEX "MentorshipMessage_mentorshipId_readByOtherAt_idx" ON "MentorshipMessage"("mentorshipId", "readByOtherAt");

-- Unread-message-digest cron: unread messages within a 24-48h sentAt window.
CREATE INDEX "MentorshipMessage_readByOtherAt_sentAt_idx" ON "MentorshipMessage"("readByOtherAt", "sentAt");
