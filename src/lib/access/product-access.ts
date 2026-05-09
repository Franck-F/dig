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

  // Defensive fetch: when `prisma migrate deploy` hasn't yet applied
  // 20260509130000_user_product_access on the live DB the columns
  // `mentoraEnabled` / `communityEnabled` don't exist and Prisma
  // throws P2022 (column does not exist). We fall back to a query
  // that doesn't select them and assume both products are enabled
  // so the app stays usable until the migration lands. The
  // `roleConfirmed` gate still drives the welcome chooser for new
  // OAuth users in the meantime.
  try {
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
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[getProductAccess] primary read failed — falling back.',
        err,
      );
    }
    // Fallback path. Read only the legacy fields so this query can't
    // hit the same column-missing error. Wrapped in its own try/catch
    // so the helper NEVER throws — pages that consume it must always
    // get a usable shape, even if Prisma is borked entirely.
    try {
      const fallback = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, roleConfirmed: true },
      });
      if (!fallback) {
        return { userId, mentora: false, community: false, isAdmin: false, roleConfirmed: false };
      }
      const isAdmin = fallback.role === 'ADMIN';
      return {
        userId,
        // Pre-migration / DB outage: assume both products visible so the
        // app stays usable rather than locking everyone out.
        mentora: true,
        community: true,
        isAdmin,
        roleConfirmed: fallback.roleConfirmed,
      };
    } catch (innerErr) {
      console.error('[getProductAccess] fallback also failed', innerErr);
      // Last-resort shape: pretend the user has both products and is
      // already confirmed. Unlocks the app — the worst that can happen
      // is the welcome chooser is skipped, which is fine for an emergency
      // mode where the DB itself is misbehaving.
      return { userId, mentora: true, community: true, isAdmin: false, roleConfirmed: true };
    }
  }
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
