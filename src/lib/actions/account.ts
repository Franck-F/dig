'use server';

import { signOut } from '@/auth';
import { requireUser } from './_shared';
import { softDeleteUser } from '@/lib/soft-delete/user';

/**
 * User-initiated account deletion. RGPD article 17 — right to erasure.
 *
 * Soft-deletes the account so the user has 30 days to change their mind
 * (admin-side restore via /community/admin/users). After 30 days a cron
 * hard-purges (Phase 1 task #24).
 *
 * Why not require password re-entry?
 *   The user is already authenticated, the action is cookie + CSRF gated,
 *   and we follow up with a confirmation email (Phase 1) so an attacker
 *   sitting on a stolen session has a 30-day undo window. Adding a
 *   password prompt is good UX defence-in-depth — Phase 1 task #19 wires
 *   that in.
 *
 * Returns void on success — the caller signs the user out and redirects.
 */
export type DeleteAccountResult =
  | { status: 'success' }
  | { status: 'error'; error: 'unauthenticated' | 'already_deleted' | 'unknown' };

export async function requestSelfDelete(reason?: string): Promise<DeleteAccountResult> {
  let userId: string | null = null;
  try {
    const me = await requireUser();
    userId = me.userId;
  } catch {
    return { status: 'error', error: 'unauthenticated' };
  }

  const result = await softDeleteUser(userId, userId, reason);
  if (!result.ok) {
    if (result.error === 'already_deleted') {
      return { status: 'error', error: 'already_deleted' };
    }
    return { status: 'error', error: 'unknown' };
  }

  // Sign the user out and bounce to the home page. NextAuth's signOut
  // clears the session cookie before the redirect.
  await signOut({ redirectTo: '/?account_deleted=1' });
  // signOut throws a redirect; this line is never reached but TS needs it.
  return { status: 'success' };
}
