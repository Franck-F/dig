import 'server-only';

import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';

/**
 * Expire PENDING mentorship requests past their deadline and notify both sides.
 *
 * **Server-only — NOT a `'use server'` action.** It bulk-mutates request state
 * and fans out notifications, so it must never be a publicly-invocable endpoint
 * (a client could otherwise trigger notification spam / light DoS). Called only
 * from the authenticated cron route (`/api/cron/sessions-reminder`).
 */
export async function expirePendingRequests(): Promise<{ expired: number }> {
  const due = await prisma.mentorshipRequest.findMany({
    where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    select: {
      id: true,
      fromMentee: { select: { userId: true } },
      toMentor: { select: { userId: true } },
    },
  });
  if (due.length === 0) return { expired: 0 };

  await prisma.mentorshipRequest.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { status: 'EXPIRED', respondedAt: new Date() },
  });
  for (const r of due) {
    await notify(r.fromMentee.userId, 'REQUEST_EXPIRED', { requestId: r.id });
    await notify(r.toMentor.userId, 'REQUEST_EXPIRED', { requestId: r.id });
  }
  return { expired: due.length };
}
