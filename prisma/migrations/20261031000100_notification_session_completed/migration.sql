-- B7 (docs/mentora-rebuild/01-audit.md): completing a session notified the
-- mentee with REVIEW_RECEIVED ("you received a review"). Dedicated type that
-- invites the mentee to leave a review instead. Additive, no data change.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SESSION_COMPLETED';
