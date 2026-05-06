import 'server-only';
import { cache } from 'react';
import type { CommunityMember, User } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Local read-side viewer resolver for the public-facing community surface.
 *
 * We deliberately do NOT import from `@/lib/community/getCommunityMember`
 * (owned by Agent 3B-2) because that module also threads in badge eager-
 * loads and write-action context. For read-only RSC pages we just need the
 * three states the soft paywall and gated reads care about:
 *   - `guest`             — not signed in
 *   - `logged-in-no-member` — signed in but no CommunityMember row yet
 *   - `member`            — full member context
 *
 * Cached per-request via React's `cache()` so multiple components on the
 * same render share the result.
 */

export type CommunityViewer =
  | { kind: 'guest' }
  | {
      kind: 'logged-in-no-member';
      user: Pick<User, 'id' | 'role' | 'email' | 'name'>;
    }
  | {
      kind: 'member';
      user: Pick<User, 'id' | 'role' | 'email' | 'name'>;
      member: CommunityMember;
      isAdmin: boolean;
      isModerator: boolean;
    };

/**
 * Resolve the current community viewer. Read-only; never writes.
 */
export const getCommunityViewer = cache(async (): Promise<CommunityViewer> => {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { kind: 'guest' };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, name: true },
  });
  if (!user) return { kind: 'guest' };

  const member = await prisma.communityMember.findUnique({
    where: { userId: user.id },
  });
  if (!member) return { kind: 'logged-in-no-member', user };

  const isAdmin = user.role === 'ADMIN';
  return {
    kind: 'member',
    user,
    member,
    isAdmin,
    isModerator: isAdmin || member.isModerator,
  };
});

/** True if the viewer can post / comment / react (= ACTIVE community member). */
export function canWrite(v: CommunityViewer): v is Extract<CommunityViewer, { kind: 'member' }> {
  return v.kind === 'member' && v.member.status === 'ACTIVE';
}
