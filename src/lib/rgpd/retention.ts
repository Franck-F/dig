import 'server-only';
import { prisma } from '@/lib/prisma';
import { softDeleteUser } from '@/lib/soft-delete/user';
import { retentionCutoffs } from './retention-policy';

export type RetentionPurgeResult = {
  inactiveAccounts: number;
  notifications: number;
  contactMessages: number;
  moderationActions: number;
  auditLogs: number;
};

/**
 * Apply the documented retention durations (docs/rgpd/registre-traitements.md).
 * Destructive — runs from the daily cron. Each step is independent and
 * best-effort: a failure in one is logged and never aborts the others.
 *
 * Out of scope for now (needs the "fin du mentorat" semantics, tracked
 * separately): sessions / mentorship messages 3y after the mentorat ends.
 */
export async function runRetentionPurge(now: Date = new Date()): Promise<RetentionPurgeResult> {
  const cut = retentionCutoffs(now);
  const result: RetentionPurgeResult = {
    inactiveAccounts: 0,
    notifications: 0,
    contactMessages: 0,
    moderationActions: 0,
    auditLogs: 0,
  };

  // 1. Accounts inactive > 3 years → soft-delete (anonymise now, hard-purge at
  //    J+30). Only rows with a KNOWN lastLoginAt older than the cutoff are
  //    touched; null lastLoginAt (never signed in since the column was added)
  //    is left alone so we never mass-delete pre-existing accounts.
  try {
    const stale = await prisma.user.findMany({
      where: { deletedAt: null, lastLoginAt: { lt: cut.inactiveAccounts } },
      select: { id: true },
    });
    for (const u of stale) {
      const r = await softDeleteUser(u.id, u.id, 'auto:inactive>3y');
      if (r.ok) result.inactiveAccounts += 1;
    }
  } catch (e) {
    console.error('[retention] inactive-account purge failed', e);
  }

  // 2. Notifications: 90 days after read, 1 year if never read.
  try {
    const r = await prisma.notification.deleteMany({
      where: {
        OR: [
          { readAt: { not: null, lt: cut.readNotifications } },
          { readAt: null, createdAt: { lt: cut.unreadNotifications } },
        ],
      },
    });
    result.notifications = r.count;
  } catch (e) {
    console.error('[retention] notification purge failed', e);
  }

  // 3. Contact-form messages: 1 year after receipt.
  try {
    const r = await prisma.contactMessage.deleteMany({
      where: { createdAt: { lt: cut.contactMessages } },
    });
    result.contactMessages = r.count;
  } catch (e) {
    console.error('[retention] contact-message purge failed', e);
  }

  // 4. Moderation actions: 3 years.
  try {
    const r = await prisma.moderationAction.deleteMany({
      where: { createdAt: { lt: cut.moderationActions } },
    });
    result.moderationActions = r.count;
  } catch (e) {
    console.error('[retention] moderation-action purge failed', e);
  }

  // 5. Audit log: 5 years.
  try {
    const r = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cut.auditLogs } },
    });
    result.auditLogs = r.count;
  } catch (e) {
    console.error('[retention] audit-log purge failed', e);
  }

  return result;
}
