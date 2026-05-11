import 'server-only';
import type { UserRole } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Shared action primitives reused across feature areas (Mentorat, Community, …).
 * Extracted from `src/lib/actions/mentora/_helpers.ts` so the Community helpers
 * can re-use the same `ActionResult` shape and the `requireUser()` resolver
 * without depending on the Mentorat-specific error type.
 */

export type ActionResult<T = undefined> =
  | { status: 'success'; data?: T }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string> };

export function successResult<T>(data?: T): ActionResult<T> {
  return { status: 'success', data };
}

/**
 * Generic error-result builder. The caller passes a fully-qualified i18n key
 * (e.g. `community.errors.unauthorized` or `mentora.errors.unauthorized`).
 * Per-domain helpers wrap this and inject their own namespace prefix.
 */
export function makeErrorResult(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { status: 'error', error, fieldErrors };
}

/** Resolve current user from auth. Throws on no session. */
export async function requireUser(): Promise<{ userId: string; role: UserRole; email: string | null }> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new UnauthorizedError();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!user) throw new UnauthorizedError();
  return { userId: user.id, role: user.role, email: user.email };
}

/** Sentinel — domains catch this and translate into their own error type. */
export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}
