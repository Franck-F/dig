import 'server-only';

import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { buildRequestReminder } from '@/lib/email/templates/request-reminder';

const APP_URL =
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://digizelle.fr';

const HOUR_MS = 3600 * 1000;

export type RequestReminderRunResult = {
  candidates: number;
  sent: number;
  failed: number;
};

/**
 * Email mentors a last-chance reminder for `MentorshipRequest` rows
 * still PENDING with `expiresAt` in the next 24-48 h window.
 *
 * Idempotency: the [now+24 h, now+48 h] window IS the dedupe — each
 * request crosses that window exactly once between creation (J+0,
 * `expiresAt = J+14`) and auto-expiry (J+14, picked up by
 * `expirePendingRequests`). So each request gets reminded at most
 * once, around J+12, without needing a `reminderSentAt` column.
 *
 * Called from the daily mentora cron (`/api/cron/sessions-reminder`),
 * just before `expirePendingRequests` so the reminder always lands
 * before the EXPIRED notif.
 */
export async function sendRequestExpiryReminders(): Promise<RequestReminderRunResult> {
  const now = new Date();
  const lower = new Date(now.getTime() + 24 * HOUR_MS);
  const upper = new Date(now.getTime() + 48 * HOUR_MS);

  const candidates = await prisma.mentorshipRequest.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { gte: lower, lt: upper },
    },
    select: {
      id: true,
      message: true,
      expiresAt: true,
      toMentor: {
        select: {
          user: {
            select: { email: true, firstName: true, name: true },
          },
        },
      },
      fromMentee: {
        select: {
          user: {
            select: { firstName: true, name: true },
          },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const r of candidates) {
    const mentor = r.toMentor.user;
    const mentee = r.fromMentee.user;
    if (!mentor?.email) continue;

    const menteeName =
      mentee.firstName?.trim() ||
      mentee.name?.trim() ||
      'une mentee';

    const mentorFirstName =
      mentor.firstName?.trim() ||
      mentor.name?.split(/\s+/)[0] ||
      '';

    // Days remaining, rounded UP so "expires in 25 h" reads as "2 jours"
    // (more accommodating to the mentor's reading time).
    const daysRemaining = Math.max(
      1,
      Math.ceil((r.expiresAt.getTime() - now.getTime()) / (24 * HOUR_MS)),
    );

    const preview =
      r.message.length > 220 ? r.message.slice(0, 217) + '…' : r.message;

    const built = buildRequestReminder({
      mentorFirstName,
      menteeName,
      preview,
      daysRemaining,
      appUrl: `${APP_URL}/mentora/dashboard/requests`,
    });

    try {
      const res = await sendEmail({
        to: mentor.email,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });
      if (res.ok) sent += 1;
      else failed += 1;
    } catch (err) {
      console.error('[request-expiry-reminder] sendEmail threw', err);
      failed += 1;
    }
  }

  return {
    candidates: candidates.length,
    sent,
    failed,
  };
}
