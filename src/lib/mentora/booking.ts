import type { MentorshipStatus } from '@prisma/client';

/**
 * Booking rules for `scheduleSession` (pure). The authoritative guard
 * against concurrent double booking is the row lock taken in the action's
 * transaction (phase 2 adds an exclusion constraint); these checks run
 * inside that transaction.
 */

/** A PAUSED mentorship keeps its planned sessions but takes no new booking (B9). */
export function canBookInMentorship(status: MentorshipStatus): boolean {
  return status === 'ACTIVE';
}

type Interval = { start: Date; durationMinutes: number };

/** True when `candidate` overlaps any existing session; touching edges do not overlap. */
export function hasSessionConflict(
  candidate: Interval,
  existing: { scheduledAt: Date; durationMinutes: number }[],
): boolean {
  const start = candidate.start.getTime();
  const end = start + candidate.durationMinutes * 60_000;
  return existing.some((s) => {
    const sStart = s.scheduledAt.getTime();
    const sEnd = sStart + s.durationMinutes * 60_000;
    return start < sEnd && sStart < end;
  });
}
