import 'server-only';
import type { BadgeKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';

/**
 * Programmatic badge engine. Spec §3.6.
 *
 * `evaluateBadges(memberId, trigger)` runs after each domain event:
 *   - POST_PUBLISHED        → after `createPost` flips DRAFT → PUBLISHED
 *   - COMMENT_PUBLISHED     → after `createComment`
 *   - REACTION_RECEIVED     → after `toggleReaction` increments target counter
 *   - CHALLENGE_RESULT      → after `closeChallengeManually` / cron computes winners
 *   - MEMBER_CREATED        → after `claimHandle` finalises onboarding
 *
 * Idempotent — uses `upsert` keyed on the unique `(memberId, badgeId)` index.
 * Returns the list of newly-awarded `BadgeKind` values (empty if nothing new).
 *
 * Each fresh grant fires a `BADGE_AWARDED` notification (in-app only).
 */

export type BadgeTrigger =
  | 'POST_PUBLISHED'
  | 'COMMENT_PUBLISHED'
  | 'REACTION_RECEIVED'
  | 'CHALLENGE_WON'
  | 'CHALLENGE_SUBMITTED'
  | 'MEMBER_CREATED'
  | 'ANNIVERSARY_TICK';

/** Map of trigger → candidate kinds to evaluate. */
const TRIGGER_CANDIDATES: Record<BadgeTrigger, BadgeKind[]> = {
  POST_PUBLISHED: ['FIRST_POST', 'TEN_POSTS'],
  COMMENT_PUBLISHED: ['FIRST_COMMENT', 'FIFTY_COMMENTS'],
  REACTION_RECEIVED: ['HUNDRED_REACTIONS'],
  CHALLENGE_SUBMITTED: ['FIRST_CHALLENGE_SUBMISSION'],
  CHALLENGE_WON: ['FIRST_CHALLENGE_WIN'],
  MEMBER_CREATED: ['EARLY_MEMBER', 'MENTOR_BADGE', 'PARTNER_BADGE'],
  ANNIVERSARY_TICK: ['ANNIVERSARY'],
};

async function shouldAward(
  memberId: string,
  kind: BadgeKind,
): Promise<boolean> {
  const member = await prisma.communityMember.findUnique({
    where: { id: memberId },
    select: {
      userId: true,
      postCount: true,
      commentCount: true,
      reactionsReceivedCount: true,
      joinedAt: true,
      user: { select: { role: true } },
    },
  });
  if (!member) return false;

  switch (kind) {
    case 'FIRST_POST':
      return member.postCount >= 1;
    case 'TEN_POSTS':
      return member.postCount >= 10;
    case 'FIRST_COMMENT':
      return member.commentCount >= 1;
    case 'FIFTY_COMMENTS':
      return member.commentCount >= 50;
    case 'HUNDRED_REACTIONS':
      return member.reactionsReceivedCount >= 100;
    case 'FIRST_CHALLENGE_SUBMISSION': {
      const c = await prisma.challengeSubmission.count({ where: { authorId: memberId } });
      return c >= 1;
    }
    case 'FIRST_CHALLENGE_WIN': {
      const c = await prisma.challengeSubmission.count({
        where: { authorId: memberId, isWinner: true },
      });
      return c >= 1;
    }
    case 'EARLY_MEMBER': {
      const total = await prisma.communityMember.count();
      return total <= 50;
    }
    case 'ANNIVERSARY': {
      const oneYearMs = 365 * 24 * 3600 * 1000;
      return Date.now() - member.joinedAt.getTime() >= oneYearMs;
    }
    case 'MENTOR_BADGE':
      return member.user.role === 'MENTOR';
    case 'PARTNER_BADGE':
      return member.user.role === 'PARTNER';
    default:
      // Manual badges (FOUNDER, CORE_TEAM, AMBASSADOR, …) and anything else
      // are never auto-awarded by the engine.
      return false;
  }
}

/**
 * Evaluate and (idempotently) award candidate badges. Returns the list of
 * BadgeKinds newly granted in this call.
 */
export async function evaluateBadges(
  memberId: string,
  trigger: BadgeTrigger,
): Promise<BadgeKind[]> {
  const candidates = TRIGGER_CANDIDATES[trigger];
  if (!candidates || candidates.length === 0) return [];

  const granted: BadgeKind[] = [];
  for (const kind of candidates) {
    try {
      const eligible = await shouldAward(memberId, kind);
      if (!eligible) continue;

      const badge = await prisma.badge.findUnique({ where: { kind } });
      if (!badge) continue; // seed missing — non-fatal

      // Skip if already awarded.
      const existing = await prisma.memberBadge.findUnique({
        where: { memberId_badgeId: { memberId, badgeId: badge.id } },
      });
      if (existing) continue;

      await prisma.memberBadge.create({
        data: { memberId, badgeId: badge.id },
      });
      granted.push(kind);

      // Fire BADGE_AWARDED notification (in-app only — no email).
      const member = await prisma.communityMember.findUnique({
        where: { id: memberId },
        select: { userId: true },
      });
      if (member) {
        await notify(member.userId, 'BADGE_AWARDED', {
          surface: 'community',
          badgeKind: kind,
          badgeSlug: badge.slug,
        });
      }
    } catch (e) {
      console.error('[community badges] evaluate failed', { memberId, kind, e });
    }
  }
  return granted;
}
