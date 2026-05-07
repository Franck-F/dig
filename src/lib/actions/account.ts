'use server';

import * as Sentry from '@sentry/nextjs';

import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { enqueueEmails } from '@/lib/email/queue';
import { accountDeletedEmail } from '@/lib/email/templates/account-deleted';
import { softDeleteUser } from '@/lib/soft-delete/user';
import { requireUser } from './_shared';

const SOFT_DELETE_GRACE_DAYS = 30;
const DPO_EMAIL = 'dpo@calebasse.com';

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

  // Capture the email + first name BEFORE we soft-delete — `softDeleteUser`
  // anonymises both immediately so we can't read them after the fact. If
  // the user record disappears between the read and the delete (race),
  // we still proceed with the deletion and skip the confirmation email.
  let snapshot: { email: string | null; firstName: string | null } | null = null;
  try {
    snapshot = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'account.self_delete_snapshot' } });
  }

  const result = await softDeleteUser(userId, userId, reason);
  if (!result.ok) {
    if (result.error === 'already_deleted') {
      return { status: 'error', error: 'already_deleted' };
    }
    return { status: 'error', error: 'unknown' };
  }

  // Best-effort confirmation email via the outbox queue. Audit log,
  // restore-by-DPO instructions, and the security tripwire copy live
  // in the template. The email queue is idempotent on (audienceTag,
  // to) so retrying this action wouldn't double-send.
  if (snapshot?.email) {
    try {
      const tpl = accountDeletedEmail({
        firstName: snapshot.firstName,
        graceDays: SOFT_DELETE_GRACE_DAYS,
        dpoEmail: DPO_EMAIL,
      });
      await enqueueEmails(`account.deleted.${userId}`, [
        {
          to: snapshot.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        },
      ]);
    } catch (err) {
      // Don't fail the deletion just because the email couldn't queue.
      Sentry.captureException(err, {
        tags: { area: 'account.self_delete_email' },
        extra: { userId },
      });
    }
  }

  // Sign the user out and bounce to the home page. NextAuth's signOut
  // clears the session cookie before the redirect.
  await signOut({ redirectTo: '/?account_deleted=1' });
  // signOut throws a redirect; this line is never reached but TS needs it.
  return { status: 'success' };
}
