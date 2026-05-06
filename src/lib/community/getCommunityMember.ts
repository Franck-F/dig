import 'server-only';
import { cache } from 'react';
import type { Badge, CommunityMember, MemberBadge, User } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Read-time RSC helper. Returns a discriminated union describing the viewer's
 * relationship with the Community surface:
 *
 *   - `guest`               — not logged in
 *   - `logged-in-no-member` — logged in but no CommunityMember row (must onboard)
 *   - `member`              — full member context with badges
 *
 * Cached per-request via React `cache()` so multiple components in the same
 * render share the result (no duplicate queries). Read-only — never writes.
 */

export type CommunityViewerContext =
  | {
      kind: 'guest';
      user: null;
      member: null;
      isAdmin: false;
      isModerator: false;
    }
  | {
      kind: 'logged-in-no-member';
      user: User;
      member: null;
      isAdmin: boolean;
      isModerator: false;
    }
  | {
      kind: 'member';
      user: User;
      member: CommunityMember & { badges: (MemberBadge & { badge: Badge })[] };
      isAdmin: boolean;
      isModerator: boolean;
    };

async function loadViewer(): Promise<CommunityViewerContext> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { kind: 'guest', user: null, member: null, isAdmin: false, isModerator: false };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { kind: 'guest', user: null, member: null, isAdmin: false, isModerator: false };
  }

  const isAdmin = user.role === 'ADMIN';
  const member = await prisma.communityMember.findUnique({
    where: { userId },
    include: { badges: { include: { badge: true } } },
  });

  if (!member) {
    return { kind: 'logged-in-no-member', user, member: null, isAdmin, isModerator: false };
  }

  return {
    kind: 'member',
    user,
    member,
    isAdmin,
    isModerator: isAdmin || member.isModerator,
  };
}

/**
 * Public, request-cached entry point. Use everywhere instead of calling
 * `loadViewer` directly to keep a single DB hit per render.
 */
export const getCommunityMember = cache(loadViewer);

/**
 * Throws if there is no session OR no CommunityMember. Suitable for gated RSC
 * pages that need `member`. Caller can catch and redirect to onboarding.
 */
export async function requireCommunityMemberRSC(): Promise<
  Extract<CommunityViewerContext, { kind: 'member' }>
> {
  const ctx = await getCommunityMember();
  if (ctx.kind !== 'member') {
    throw new Error(ctx.kind === 'guest' ? 'unauthorized' : 'forbidden');
  }
  return ctx;
}
