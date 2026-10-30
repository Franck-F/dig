/**
 * Mentor engagement badges shown on mentor cards (directory + home
 * recommendations), modelled on Entourage Pro's "Super engagé /
 * Très réactif / Profil complémentaire" chips.
 *
 * Pure + no Prisma import so it runs under `node --test`; the string
 * union mirrors the `ResponseTime` enum in prisma/schema.prisma.
 */

export type MentorBadge = 'reactive' | 'engaged' | 'complementary';

type ResponseTimeValue = 'WITHIN_HOUR' | 'WITHIN_DAY' | 'WITHIN_WEEK' | 'WITHIN_MONTH';

const ENGAGED_MIN_COMPLETED_SESSIONS = 5;
const ENGAGED_MIN_ACTIVE_MENTORSHIPS = 2;
/** `MatchResult.total` is on a 0–100 scale (see matching.ts). */
const COMPLEMENTARY_MIN_SCORE = 70;

export function computeMentorBadges(i: {
  responseTime: ResponseTimeValue;
  completedSessions: number;
  activeMentorships: number;
  matchScore?: number | null;
}): MentorBadge[] {
  const badges: MentorBadge[] = [];
  if (
    i.completedSessions >= ENGAGED_MIN_COMPLETED_SESSIONS ||
    i.activeMentorships >= ENGAGED_MIN_ACTIVE_MENTORSHIPS
  ) {
    badges.push('engaged');
  }
  if (i.responseTime === 'WITHIN_HOUR' || i.responseTime === 'WITHIN_DAY') {
    badges.push('reactive');
  }
  if (typeof i.matchScore === 'number' && i.matchScore >= COMPLEMENTARY_MIN_SCORE) {
    badges.push('complementary');
  }
  return badges;
}

export function isMentorAvailable(i: {
  isAcceptingMentees: boolean;
  activeMentorships: number;
  maxConcurrentMentees: number;
}): boolean {
  return i.isAcceptingMentees && i.activeMentorships < i.maxConcurrentMentees;
}
