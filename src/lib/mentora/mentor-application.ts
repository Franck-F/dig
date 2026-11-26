import type { MentorStatus } from '@prisma/client';

/**
 * Mentor application rules shared by the wizard submission, the manual
 * "submit for review" button and the dashboard (pure: testable with
 * `node --test`).
 */

export const MIN_MENTOR_SKILLS = 3;

export function isMentorApplicationComplete(input: {
  headline: string | null;
  bio: string;
  skillCount: number;
  slotCount: number;
}): boolean {
  return (
    !!input.headline?.trim() &&
    input.bio.trim().length >= 1 &&
    input.skillCount >= MIN_MENTOR_SKILLS &&
    input.slotCount >= 1
  );
}

export function isValidSlot(slot: { startMinute: number; endMinute: number }): boolean {
  return slot.endMinute > slot.startMinute;
}

export type MentorApplicationState = 'draft' | 'rejected' | 'inReview';

/** What a candidate should see about their application; null once approved. */
export function mentorApplicationState(profile: {
  status: MentorStatus;
  reviewNote: string | null;
}): MentorApplicationState | null {
  if (profile.status === 'PENDING_REVIEW') return 'inReview';
  if (profile.status === 'DRAFT') return profile.reviewNote?.trim() ? 'rejected' : 'draft';
  return null;
}

/**
 * Which dashboard a user gets. Driven by profiles, not by `User.role`: an
 * approved mentor who is ADMIN or PARTNER is still a mentor (B5), and a
 * candidate with no mentee profile lands on their mentor space to follow
 * their application (B6). A mentee who applies keeps the mentee space.
 */
export function resolveProfileKind(input: {
  mentorStatus: MentorStatus | null;
  hasMenteeProfile: boolean;
}): 'mentor' | 'mentee' | 'none' {
  if (input.mentorStatus) {
    const isCandidate = input.mentorStatus === 'DRAFT' || input.mentorStatus === 'PENDING_REVIEW';
    if (!isCandidate || !input.hasMenteeProfile) return 'mentor';
  }
  return input.hasMenteeProfile ? 'mentee' : 'none';
}
