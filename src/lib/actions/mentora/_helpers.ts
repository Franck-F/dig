import 'server-only';
import type { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export type MentoraActionError =
  | 'unauthorized'
  | 'notFound'
  | 'forbidden'
  | 'profileIncomplete'
  | 'duplicateRequest'
  | 'capacityReached'
  | 'slotTaken'
  | 'invalidWindow'
  | 'cannotMessageTerminated'
  | 'selfReview'
  | 'alreadyReviewed'
  | 'languageRequired'
  | 'skillRequired'
  | 'invalidInput'
  | 'mentorNotAccepting'
  | 'invalidStatus'
  | 'imageMalformed'
  | 'imageMimeNotAllowed'
  | 'imageTooLarge'
  | 'imageMagicMismatch';

export type ActionResult<T = undefined> =
  | { status: 'success'; data?: T }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string> };

export class MentoraError extends Error {
  code: MentoraActionError;
  constructor(code: MentoraActionError, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'MentoraError';
  }
}

export function errorResult(code: MentoraActionError, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { status: 'error', error: `mentora.errors.${code}`, fieldErrors };
}

export function successResult<T>(data?: T): ActionResult<T> {
  return { status: 'success', data };
}

/** Resolve current user from auth. Throws on no session. */
export async function requireUser(): Promise<{ userId: string; role: UserRole; email: string | null }> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new MentoraError('unauthorized');
  // role is not on JWT yet — fetch from DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!user) throw new MentoraError('unauthorized');
  return { userId: user.id, role: user.role, email: user.email };
}

/** Require an active mentor (MentorProfile present + ACTIVE). */
export async function requireMentor() {
  const ctx = await requireUser();
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: ctx.userId },
  });
  if (!profile) throw new MentoraError('forbidden');
  return { ...ctx, mentorProfile: profile };
}

/** Require any MentorProfile owner (any status). */
export async function requireMentorOwner() {
  const ctx = await requireUser();
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: ctx.userId },
  });
  if (!profile) throw new MentoraError('forbidden');
  return { ...ctx, mentorProfile: profile };
}

export async function requireMentee() {
  const ctx = await requireUser();
  const profile = await prisma.menteeProfile.findUnique({
    where: { userId: ctx.userId },
  });
  if (!profile) throw new MentoraError('profileIncomplete');
  return { ...ctx, menteeProfile: profile };
}

export async function requireMentorshipMember(mentorshipId: string) {
  const ctx = await requireUser();
  const m = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      mentorProfile: { select: { userId: true } },
      menteeProfile: { select: { userId: true } },
    },
  });
  if (!m) throw new MentoraError('notFound');
  const isMentor = m.mentorProfile.userId === ctx.userId;
  const isMentee = m.menteeProfile.userId === ctx.userId;
  if (!isMentor && !isMentee) throw new MentoraError('forbidden');
  return { ...ctx, mentorship: m, isMentor, isMentee };
}

export async function requireMentorshipMentor(mentorshipId: string) {
  const member = await requireMentorshipMember(mentorshipId);
  if (!member.isMentor) throw new MentoraError('forbidden');
  return member;
}

export function handleError(err: unknown): ActionResult<never> {
  if (err instanceof MentoraError) return errorResult(err.code);
  console.error('[mentora action] unexpected error', err);
  return { status: 'error', error: 'mentora.errors.unauthorized' };
}
