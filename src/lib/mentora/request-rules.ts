import type { MentorStatus, MentorshipStatus } from '@prisma/client';

/**
 * Guards of the MentorshipRequest transitions (pure, M1 to M3). They return
 * the error code to show, or null when the transition is allowed.
 */

const OPEN_MENTORSHIP: readonly MentorshipStatus[] = ['ACTIVE', 'PAUSED'];

function isOpen(status: MentorshipStatus | null): boolean {
  return status !== null && OPEN_MENTORSHIP.includes(status);
}

/** PENDING creation by the mentee. */
export function sendRefusal(input: {
  mentorUserId: string;
  menteeUserId: string;
  /** Status of the existing mentorship for this pair, if any. */
  openMentorshipStatus: MentorshipStatus | null;
}): 'selfRequest' | 'alreadyMentored' | null {
  if (input.mentorUserId === input.menteeUserId) return 'selfRequest';
  if (isOpen(input.openMentorshipStatus)) return 'alreadyMentored';
  return null;
}

/** PENDING → ACCEPTED by the mentor. */
export function acceptRefusal(input: {
  expiresAt: Date;
  now: Date;
  mentorStatus: MentorStatus;
  openMentorshipStatus: MentorshipStatus | null;
}): 'requestExpired' | 'mentorSuspended' | 'mentorNotAccepting' | 'alreadyMentored' | null {
  // The daily cron flips EXPIRED late; the deadline itself is the rule (M2).
  if (input.expiresAt.getTime() <= input.now.getTime()) return 'requestExpired';
  if (input.mentorStatus === 'SUSPENDED') return 'mentorSuspended';
  if (input.mentorStatus !== 'ACTIVE') return 'mentorNotAccepting';
  if (isOpen(input.openMentorshipStatus)) return 'alreadyMentored';
  return null;
}

export function hasCapacity(activeMentorships: number, maxConcurrentMentees: number): boolean {
  return activeMentorships < maxConcurrentMentees;
}
