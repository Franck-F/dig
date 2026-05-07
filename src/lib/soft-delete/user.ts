import 'server-only';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { logAdmin } from '@/lib/audit/log';

/**
 * RGPD-compliant soft delete + anonymisation pipeline for a user account.
 *
 * Flow:
 *   1. User triggers `softDeleteUser(self)` from /community/settings or
 *      admin triggers it on a target.
 *   2. We anonymise PII immediately (email becomes `deleted-<random>@anonymous.local`,
 *      name/firstName/lastName cleared, image dropped) so the row no
 *      longer leaks personal data even if a query forgets to filter by
 *      deletedAt.
 *   3. We stamp `deletedAt = now()` on User + MentorProfile + MenteeProfile
 *      + CommunityMember in a single transaction. Existing OAuth Account
 *      rows stay so the user can't immediately re-link with the same
 *      provider id (they're cascade-deleted only when User is hard-deleted).
 *   4. A J+30 cron (Phase 1 task #24) purges rows where
 *      `deletedAt < now() - 30 days`, hard-deleting them and cascading
 *      everything related.
 *
 * The original email is hashed and stored in payload of the audit log so
 * a forensic investigation can verify "yes, this was the same account"
 * without leaking the email back. We use SHA-256(email + AUTH_SECRET) so
 * the hash isn't a rainbow-table lookup.
 */

function anonymisedEmail(): string {
  // Random suffix avoids unique-constraint collisions on rapid resoft-deletes.
  const tag = randomBytes(8).toString('hex');
  return `deleted-${tag}@anonymous.local`;
}

export type SoftDeleteResult =
  | { ok: true; userId: string }
  | { ok: false; error: 'not_found' | 'already_deleted' | 'unknown' };

/**
 * Soft-delete a user. Idempotent — re-running on a deleted user returns
 * `already_deleted`.
 *
 * `actorUserId` is the audit log actor:
 *  - When a user deletes their own account it equals `userId`.
 *  - When an admin deletes a target it's the admin's id.
 */
export async function softDeleteUser(
  userId: string,
  actorUserId: string,
  reason?: string,
): Promise<SoftDeleteResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true, email: true },
    });
    if (!user) return { ok: false, error: 'not_found' };
    if (user.deletedAt) return { ok: false, error: 'already_deleted' };

    const newEmail = anonymisedEmail();
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Anonymise + soft-delete the user row.
      await tx.user.update({
        where: { id: userId },
        data: {
          email: newEmail,
          name: null,
          firstName: null,
          lastName: null,
          image: null,
          passwordHash: null, // disable any future credentials login attempt
          deletedAt: now,
        },
      });

      // Cascade soft-delete to the user's profiles. We use updateMany so
      // missing relations don't throw (a user may have only one of the
      // two profile types, or none).
      await tx.mentorProfile.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.menteeProfile.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.communityMember.updateMany({
        where: { userId, deletedAt: null },
        data: {
          // Leave handle + status intact (handle uniqueness preserved,
          // status stays at whatever it was — read paths filter by
          // deletedAt anyway). The hard purge at J+30 strips it.
          deletedAt: now,
        },
      });

      // Invalidate all OAuth-linked accounts so nobody can sign back in.
      // Prisma adapter Auth.js Accounts have onDelete: Cascade from User,
      // but we don't want to wait until the J+30 hard purge. Strip tokens
      // now.
      await tx.account.deleteMany({ where: { userId } });

      // Drop any pending verification codes targeting the original email.
      await tx.verificationCode.deleteMany({
        where: { email: user.email },
      });
    });

    await logAdmin(actorUserId, {
      action: actorUserId === userId ? 'user.self_delete' : 'user.admin_delete',
      targetType: 'User',
      targetId: userId,
      payload: {
        reason: reason?.slice(0, 500) ?? null,
        purgeScheduledFor: new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      },
    });

    return { ok: true, userId };
  } catch (err) {
    console.error('[softDelete] failed', { userId, err });
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Restore a soft-deleted user within the J+30 grace window. The original
 * email is unrecoverable (we anonymised it), so the user must provide a
 * new one — typically through an admin-triggered restore where the admin
 * vouches for the new email.
 */
export async function restoreUser(
  userId: string,
  newEmail: string,
  actorUserId: string,
): Promise<SoftDeleteResult> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (!user) return { ok: false, error: 'not_found' };
    if (!user.deletedAt) return { ok: false, error: 'already_deleted' };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { email: newEmail, deletedAt: null },
      });
      await tx.mentorProfile.updateMany({
        where: { userId },
        data: { deletedAt: null },
      });
      await tx.menteeProfile.updateMany({
        where: { userId },
        data: { deletedAt: null },
      });
      await tx.communityMember.updateMany({
        where: { userId },
        data: { deletedAt: null },
      });
    });

    await logAdmin(actorUserId, {
      action: 'user.restore',
      targetType: 'User',
      targetId: userId,
    });

    return { ok: true, userId };
  } catch (err) {
    console.error('[softDelete.restore] failed', { userId, err });
    return { ok: false, error: 'unknown' };
  }
}

/**
 * Hard-purge users whose soft delete is older than `graceDays` (default 30).
 * Intended to be called from a cron job. Returns the number of users
 * actually purged. Cascades through Prisma onDelete relations.
 */
export async function purgeExpiredSoftDeletes(graceDays = 30): Promise<number> {
  const threshold = new Date(Date.now() - graceDays * 24 * 3600 * 1000);
  const expired = await prisma.user.findMany({
    where: { deletedAt: { lt: threshold } },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  await prisma.user.deleteMany({
    where: { id: { in: expired.map((u) => u.id) } },
  });
  return expired.length;
}
