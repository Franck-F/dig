import 'server-only';
import * as Sentry from '@sentry/nextjs';
import type { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { MentoraErrorCode } from '@/lib/mentora/errors';
import { adminAccessDecision } from '@/lib/mentora/admin-access';
import { hasFreshAdmin2faCookie } from '@/lib/auth/admin-2fa-cookie';

/** Codes live in `@/lib/mentora/errors`, each with a fr and en label. */
export type MentoratActionError = MentoraErrorCode;

export type ActionResult<T = undefined> =
  | { status: 'success'; data?: T }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string> };

export class MentoratError extends Error {
  code: MentoratActionError;
  constructor(code: MentoratActionError, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'MentoratError';
  }
}

export function errorResult(code: MentoratActionError, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { status: 'error', error: `mentora.errors.${code}`, fieldErrors };
}

export function successResult<T>(data?: T): ActionResult<T> {
  return { status: 'success', data };
}

/** Resolve current user from auth. Throws on no session. */
export async function requireUser(): Promise<{ userId: string; role: UserRole; email: string | null }> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new MentoratError('unauthorized');
  // role is not on JWT yet — fetch from DB
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!user) throw new MentoratError('unauthorized');
  return { userId: user.id, role: user.role, email: user.email };
}

/**
 * Every admin action: ADMIN role AND a fresh 2FA step-up cookie (M6). The
 * admin layout's TOTP gate does not cover a server action invoked directly.
 * Throws MentoratError('forbidden' | 'twoFactorRequired').
 */
export async function requireAdmin(): Promise<{ userId: string; role: UserRole; email: string | null }> {
  const ctx = await requireUser();
  const decision = adminAccessDecision({
    role: ctx.role,
    hasFresh2fa: ctx.role === 'ADMIN' && (await hasFreshAdmin2faCookie(ctx.userId)),
  });
  if (decision !== 'ok') throw new MentoratError(decision);
  return ctx;
}

/** Require an active mentor (MentorProfile present + ACTIVE). */
export async function requireMentor() {
  const ctx = await requireUser();
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: ctx.userId },
  });
  if (!profile) throw new MentoratError('forbidden');
  return { ...ctx, mentorProfile: profile };
}

/** Require any MentorProfile owner (any status). */
export async function requireMentorOwner() {
  const ctx = await requireUser();
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId: ctx.userId },
  });
  if (!profile) throw new MentoratError('forbidden');
  return { ...ctx, mentorProfile: profile };
}

export async function requireMentee() {
  const ctx = await requireUser();
  const profile = await prisma.menteeProfile.findUnique({
    where: { userId: ctx.userId },
  });
  if (!profile) throw new MentoratError('profileIncomplete');
  return { ...ctx, menteeProfile: profile };
}

export async function requireMentorshipMember(mentorshipId: string) {
  const ctx = await requireUser();
  const m = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    include: {
      mentorProfile: { select: { userId: true, status: true } },
      menteeProfile: { select: { userId: true } },
    },
  });
  if (!m) throw new MentoratError('notFound');
  const isMentor = m.mentorProfile.userId === ctx.userId;
  const isMentee = m.menteeProfile.userId === ctx.userId;
  if (!isMentor && !isMentee) throw new MentoratError('forbidden');
  return { ...ctx, mentorship: m, isMentor, isMentee };
}

export async function requireMentorshipMentor(mentorshipId: string) {
  const member = await requireMentorshipMember(mentorshipId);
  if (!member.isMentor) throw new MentoratError('forbidden');
  return member;
}

export function handleError(err: unknown): ActionResult<never> {
  if (err instanceof MentoratError) return errorResult(err.code);
  // Genuine unexpected error — surface it to Sentry (console.error is invisible
  // in prod) and show a neutral message, never a fake rights problem.
  console.error('[mentora action] unexpected error', err);
  Sentry.captureException(err, { tags: { area: 'mentora-action' } });
  return errorResult('unexpected');
}
