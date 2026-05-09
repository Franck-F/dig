import 'server-only';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export type ProductAccess = {
  userId: string | null;
  mentora: boolean;
  community: boolean;
  /** True for ADMIN — admins always see everything regardless of flags. */
  isAdmin: boolean;
  /** False until the user picks their access via /welcome/role. */
  roleConfirmed: boolean;
};

/**
 * Resolve the current user's product access flags.
 *
 * Single round-trip query intended to be called from layouts and gate
 * helpers. Returns a stable shape even when not signed in (everything
 * false) so callers can use it without a null guard. ADMINs see both
 * universes regardless of their own flags.
 */
export async function getProductAccess(): Promise<ProductAccess> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return { userId: null, mentora: false, community: false, isAdmin: false, roleConfirmed: false };
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      roleConfirmed: true,
      mentoraEnabled: true,
      communityEnabled: true,
    },
  });
  if (!me) {
    return { userId, mentora: false, community: false, isAdmin: false, roleConfirmed: false };
  }
  const isAdmin = me.role === 'ADMIN';
  return {
    userId,
    mentora: isAdmin ? true : me.mentoraEnabled,
    community: isAdmin ? true : me.communityEnabled,
    isAdmin,
    roleConfirmed: me.roleConfirmed,
  };
}

/**
 * Build the AppShell `switchItems` filtered to the products the user
 * has access to. Pass the localised labels from the caller's
 * `getTranslations('app.shell')` instance.
 */
export function buildSwitchItems(
  access: ProductAccess,
  labels: { mentora: string; community: string },
): Array<{ href: string; label: string; icon: string; matchPrefix: string }> {
  const items: Array<{ href: string; label: string; icon: string; matchPrefix: string }> = [];
  if (access.mentora) {
    items.push({
      href: '/mentora/dashboard',
      label: labels.mentora,
      icon: '✦',
      matchPrefix: '/mentora',
    });
  }
  if (access.community) {
    items.push({
      href: '/community',
      label: labels.community,
      icon: '☷',
      matchPrefix: '/community',
    });
  }
  return items;
}
