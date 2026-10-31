import type { MentorStatus } from '@prisma/client';

/**
 * Moderation rules on MentorProfile.status (pure, B10).
 */

/** Reactivation undoes a suspension only; it must never bypass the review of a DRAFT or PENDING_REVIEW profile. */
export function canReactivateMentor(status: MentorStatus): boolean {
  return status === 'SUSPENDED';
}

/** A suspended mentor cannot accept requests, send messages or have sessions booked. */
export function mentorCanAct(status: MentorStatus): boolean {
  return status !== 'SUSPENDED';
}
