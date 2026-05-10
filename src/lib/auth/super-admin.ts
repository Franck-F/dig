import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Super-admin helpers.
 *
 * `User.isSuperAdmin` is additive on top of `role = ADMIN`. Plain admins
 * handle day-to-day admin work; super admins are the only ones allowed
 * to manage other admins (promote / demote / delete admin accounts) and
 * trigger platform-wide governance overrides (mass charter publish,
 * banned-words reset, etc.).
 *
 * These helpers are intentionally minimal — they read the current
 * session and check the flag, returning typed results for use in
 * server actions and Server Components alike.
 */

export type SuperAdminCheck =
  | { ok: true; userId: string }
  | { ok: false; error: 'unauthorized' | 'forbidden' };

/**
 * Returns the current user's super-admin status without throwing.
 * Use in server actions where you want to branch on it cleanly.
 */
export async function requireSuperAdmin(): Promise<SuperAdminCheck> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };

  const me = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { role: true, isSuperAdmin: true, deletedAt: true },
    })
    .catch(() => null);

  if (!me || me.deletedAt) return { ok: false, error: 'unauthorized' };
  if (me.role !== 'ADMIN' || !me.isSuperAdmin) {
    return { ok: false, error: 'forbidden' };
  }
  return { ok: true, userId };
}

/**
 * Boolean accessor for UI gating. Defaults to false on any failure
 * (no session, deleted account, query error) — never escalates.
 */
export async function isCurrentUserSuperAdmin(): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;
  const me = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { role: true, isSuperAdmin: true, deletedAt: true },
    })
    .catch(() => null);
  return Boolean(me && !me.deletedAt && me.role === 'ADMIN' && me.isSuperAdmin);
}
