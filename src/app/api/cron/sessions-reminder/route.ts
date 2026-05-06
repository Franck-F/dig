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
 * NOTE: spec §8.3 mentions a `reminderSentAt` column on Session OR a
 * `SessionReminderLog` table for idempotency. Neither was added to the
 * shipped schema by Agent 2B-1. We use idempotency by checking whether a
 * SESSION_REMINDER notification already exists for either party referencing
 * `payload.sessionId`. This is correct but slightly slower (extra query per
 * candidate). The spec should be amended to add a reliable idempotency
 * column on Session in a follow-up migration.
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
      scheduledAt: { gte: addHours(now, 23), lt: addHours(now, 25) },
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
  for (const s of due) {
    // Idempotency: skip if a SESSION_REMINDER notification already exists for this session
    const existing = await prisma.notification.findFirst({
      where: {
        type: 'SESSION_REMINDER',
        payload: { path: ['sessionId'], equals: s.id },
      },
      select: { id: true },
    });
    if (existing) continue;

    const mentorUserId = s.mentorship.mentorProfile.userId;
    const menteeUserId = s.mentorship.menteeProfile.userId;
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
    remindersSent += 2;
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
    expiredRequests,
  });
}
