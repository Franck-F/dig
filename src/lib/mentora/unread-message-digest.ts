import 'server-only';

import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { buildUnreadDigest } from '@/lib/email/templates/unread-message-digest';

const APP_URL =
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://digizelle.fr';

const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;

export type UnreadDigestRunResult = {
  candidates: number; // total unread messages in the window
  recipients: number; // distinct users we tried to email
  sent: number;
  failed: number;
};

/**
 * Email every user who has unread MentorshipMessages received between
 * 24 h and 48 h ago, summarising the count + the most recent sender +
 * a preview.
 *
 * Idempotency: the 24 h / 48 h window IS the dedupe — each message
 * contributes to exactly one digest (the day after it was sent),
 * assuming the daily cron runs. No DB write needed to track "sent".
 *
 * Called from the daily mentora cron (`/api/cron/sessions-reminder`).
 */
export async function sendUnreadMessageDigests(): Promise<UnreadDigestRunResult> {
  const now = new Date();
  const lower = new Date(now.getTime() - 2 * TWENTY_FOUR_HOURS_MS);
  const upper = new Date(now.getTime() - 1 * TWENTY_FOUR_HOURS_MS);

  const messages = await prisma.mentorshipMessage.findMany({
    where: {
      readByOtherAt: null,
      sentAt: { gte: lower, lt: upper },
    },
    select: {
      id: true,
      body: true,
      sentAt: true,
      senderUserId: true,
      sender: { select: { firstName: true, name: true } },
      mentorship: {
        select: {
          mentorProfile: {
            select: {
              userId: true,
              user: {
                select: { email: true, firstName: true, name: true },
              },
            },
          },
          menteeProfile: {
            select: {
              userId: true,
              user: {
                select: { email: true, firstName: true, name: true },
              },
            },
          },
        },
      },
    },
    orderBy: { sentAt: 'asc' },
  });

  // Group by recipient userId — recipient = the user in the mentorship
  // who is NOT the sender.
  type Digest = {
    email: string;
    firstName: string | null;
    name: string | null;
    count: number;
    lastSender: string;
    lastBody: string;
    lastAt: Date;
  };
  const byRecipient = new Map<string, Digest>();

  for (const m of messages) {
    const mentorUserId = m.mentorship.mentorProfile.userId;
    const menteeUserId = m.mentorship.menteeProfile.userId;
    const senderIsMentor = m.senderUserId === mentorUserId;
    const recipientUserId = senderIsMentor ? menteeUserId : mentorUserId;
    const recipientUser = senderIsMentor
      ? m.mentorship.menteeProfile.user
      : m.mentorship.mentorProfile.user;

    if (!recipientUser?.email) continue;

    const senderName =
      m.sender.firstName?.trim() ||
      m.sender.name?.trim() ||
      "Quelqu'un";

    let entry = byRecipient.get(recipientUserId);
    if (!entry) {
      entry = {
        email: recipientUser.email,
        firstName: recipientUser.firstName,
        name: recipientUser.name,
        count: 0,
        lastSender: senderName,
        lastBody: m.body,
        lastAt: m.sentAt,
      };
      byRecipient.set(recipientUserId, entry);
    }
    entry.count += 1;
    if (m.sentAt > entry.lastAt) {
      entry.lastAt = m.sentAt;
      entry.lastSender = senderName;
      entry.lastBody = m.body;
    }
  }

  let sent = 0;
  let failed = 0;
  for (const d of byRecipient.values()) {
    const preview = d.lastBody.length > 220
      ? d.lastBody.slice(0, 217) + '…'
      : d.lastBody;
    const built = buildUnreadDigest({
      firstName:
        d.firstName?.trim() ||
        d.name?.split(/\s+/)[0] ||
        '',
      count: d.count,
      lastSender: d.lastSender,
      preview,
      appUrl: `${APP_URL}/mentora/dashboard/messages`,
    });
    try {
      const res = await sendEmail({
        to: d.email,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });
      if (res.ok) sent += 1;
      else failed += 1;
    } catch (err) {
      console.error('[unread-message-digest] sendEmail threw', err);
      failed += 1;
    }
  }

  return {
    candidates: messages.length,
    recipients: byRecipient.size,
    sent,
    failed,
  };
}
