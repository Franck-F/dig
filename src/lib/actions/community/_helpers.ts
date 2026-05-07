import 'server-only';
import type { CommunityMember, MemberStatus, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  makeErrorResult,
  requireUser,
  successResult,
  UnauthorizedError,
} from '@/lib/actions/_shared';

/**
 * Community-specific action helpers. Mirrors `mentora/_helpers.ts` shape but
 * with its own error code union and member-aware guards.
 */

export type CommunityActionError =
  | 'unauthorized'
  | 'notFound'
  | 'forbidden'
  | 'invalidInput'
  | 'rateLimited'
  | 'memberSuspended'
  | 'memberBanned'
  | 'memberMuted'
  | 'channelLocked'
  | 'channelInviteOnly'
  | 'channelJoinPending'
  | 'editWindowExpired'
  | 'editReasonRequired'
  | 'duplicateReaction'
  | 'duplicateBookmark'
  | 'duplicateMention'
  | 'duplicateReport'
  | 'cannotReportSelf'
  | 'handleTaken'
  | 'handleInvalid'
  | 'alreadyOnboarded'
  | 'challengeClosed'
  | 'challengeNotInVoting'
  | 'duplicateSubmission'
  | 'duplicateVote'
  | 'cannotVoteOwn'
  | 'badgeNotManual'
  | 'sanitizationFailed'
  | 'imageMalformed'
  | 'imageMimeNotAllowed'
  | 'imageTooLarge'
  | 'imageMagicMismatch'
  | 'banProposalRequired'
  | 'banProposalSelfApprove';

export class CommunityError extends Error {
  code: CommunityActionError;
  constructor(code: CommunityActionError, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'CommunityError';
  }
}

export function ok<T>(data?: T): ActionResult<T> {
  return successResult(data);
}

export function err(
  code: CommunityActionError,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return makeErrorResult(`community.errors.${code}`, fieldErrors);
}

export type { ActionResult } from '@/lib/actions/_shared';

export type CommunityMemberContext = {
  userId: string;
  user: { id: string; email: string | null; role: User['role'] };
  member: CommunityMember;
  isAdmin: boolean;
  isModerator: boolean;
};

/**
 * Resolve the current viewer **if** they have a CommunityMember row.
 * Throws `CommunityError('forbidden')` if they do not (caller may catch and
 * redirect to /community/onboarding for read-page contexts).
 */
export async function requireCommunityMember(): Promise<CommunityMemberContext> {
  const ctx = await requireUser();
  const member = await prisma.communityMember.findUnique({
    where: { userId: ctx.userId },
  });
  if (!member) throw new CommunityError('forbidden');
  const isAdmin = ctx.role === 'ADMIN';
  return {
    userId: ctx.userId,
    user: { id: ctx.userId, email: ctx.email, role: ctx.role },
    member,
    isAdmin,
    isModerator: isAdmin || member.isModerator,
  };
}

/**
 * Require a member who can write — ACTIVE only. MUTED/SUSPENDED/BANNED throw.
 */
export async function requireCommunityWriter(opts: {
  /** When true, also allow MUTED status (rare — e.g. read-only-but-receive-events flows). */
  allowMuted?: boolean;
} = {}): Promise<CommunityMemberContext> {
  const ctx = await requireCommunityMember();
  const status: MemberStatus = ctx.member.status;
  if (status === 'BANNED') throw new CommunityError('memberBanned');
  if (status === 'SUSPENDED') throw new CommunityError('memberSuspended');
  if (status === 'MUTED' && !opts.allowMuted) throw new CommunityError('memberMuted');
  // Auto-restore SUSPENDED/MUTED past `statusUntil` is handled by cron — not in hot path.
  return ctx;
}

/**
 * Admin or community moderator only. Used for the `/community/admin/**` actions.
 */
export async function requireCommunityAdmin(): Promise<CommunityMemberContext> {
  const ctx = await requireCommunityMember();
  if (!ctx.isModerator) throw new CommunityError('forbidden');
  return ctx;
}

/**
 * Translate any thrown error from a server-action body into an `ActionResult`.
 * Prefer this over `try/catch` re-implementations.
 */
export function handleError(e: unknown): ActionResult<never> {
  if (e instanceof CommunityError) return err(e.code);
  if (e instanceof UnauthorizedError) return err('unauthorized');
  console.error('[community action] unexpected error', e);
  return err('unauthorized');
}
