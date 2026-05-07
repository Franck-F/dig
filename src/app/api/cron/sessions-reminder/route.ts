import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/mentora/notifications';
import { expirePendingRequests } from '@/lib/actions/mentora/requests';

// Force Node runtime — Prisma + Resend fetch require it.
export const runtime = 'nodejs';
// Always-fresh; never statically optimised.
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron entry point — `/api/cron/sessions-reminder`.
 *
 * Authenticated via `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Idempotency: `Session.reminderSentAt` is stamped after both parties
 * receive their SESSION_REMINDER notif. The cron's selection filters on
 * `reminderSentAt: null`, so a session is reminded exactly once across
 * any number of cron runs (Hobby = daily, but the same code is safe at
 * any cadence).
 *
 * Window: Vercel Hobby caps crons to once per day. We pick up every
 * SCHEDULED session in the next 48h that hasn't been reminded — gives
 * users a 1-2 day heads-up depending on when in the cron window the
 * session lands.
 */

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600 * 1000);
}

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.session.findMany({
    where: {
      status: 'SCHEDULED',
      reminderSentAt: null,
      scheduledAt: { gte: now, lt: addHours(now, 48) },
    },
    include: {
      mentorship: {
        include: {
          mentorProfile: { select: { userId: true } },
          menteeProfile: { select: { userId: true } },
        },
      },
    },
  });

  let remindersSent = 0;
  let stampFailures = 0;
  for (const s of due) {
    const mentorUserId = s.mentorship.mentorProfile.userId;
    const menteeUserId = s.mentorship.menteeProfile.userId;
    try {
      await notify(mentorUserId, 'SESSION_REMINDER', {
        sessionId: s.id,
        mentorshipId: s.mentorshipId,
        scheduledAt: s.scheduledAt.toISOString(),
      });
      await notify(menteeUserId, 'SESSION_REMINDER', {
        sessionId: s.id,
        mentorshipId: s.mentorshipId,
        scheduledAt: s.scheduledAt.toISOString(),
      });
      // Stamp only on full success — if either notify() throws we'll
      // retry on the next run rather than leave a half-notified session
      // marked as done.
      await prisma.session.update({
        where: { id: s.id },
        data: { reminderSentAt: new Date() },
      });
      remindersSent += 2;
    } catch (err) {
      console.error('[cron.sessions-reminder] failed for session', s.id, err);
      stampFailures += 1;
    }
  }

  // Also expire stale PENDING requests (per spec §8.4)
  let expiredRequests = 0;
  try {
    const r = await expirePendingRequests();
    expiredRequests = r.expired;
  } catch (err) {
    console.error('[cron] expirePendingRequests failed', err);
  }

  return NextResponse.json({
    ok: true,
    candidates: due.length,
    remindersSent,
    stampFailures,
    expiredRequests,
  });
}
