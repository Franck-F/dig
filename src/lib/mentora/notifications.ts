import 'server-only';
import type { NotificationType, Prisma } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';

/**
 * Map of NotificationType -> whether to also send an email.
 * Per spec §8.2.
 */
const EMAIL_ENABLED: Partial<Record<NotificationType, true>> = {
  REQUEST_RECEIVED: true,
  REQUEST_ACCEPTED: true,
  REQUEST_DECLINED: true,
  SESSION_SCHEDULED: true,
  SESSION_REMINDER: true,
  SESSION_CANCELLED: true,
  MENTOR_APPROVED: true,
};

/**
 * Per spec §8.2: each NotificationType maps to an i18n key under
 * `mentora.notifications.emails.<TYPE>` with `subject` and `body` children.
 * Translation values are owned by Agent 2B-5 (mentee/shared sub-tree); this
 * module only references the keys.
 */
function emailKeyForType(type: NotificationType): string {
  return `notifications.emails.${type}`;
}

export type NotifyOptions = {
  email?: boolean | 'auto'; // default 'auto' — uses EMAIL_ENABLED map
  payload?: Prisma.InputJsonValue;
};

export type NotifyPayload = Record<string, unknown>;

/**
 * Create an in-app Notification row and (optionally) send an email via Resend.
 * Email failures never throw — they're logged. Always returns the created row id.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  payload: NotifyPayload,
  opts: NotifyOptions = {},
): Promise<{ id: string } | null> {
  let row: { id: string } | null = null;
  try {
    row = await prisma.notification.create({
      data: {
        userId,
        type,
        payload: (payload as Prisma.InputJsonValue) ?? {},
      },
      select: { id: true },
    });
  } catch (err) {
    console.error('[mentora notify] failed to create Notification', err);
    return null;
  }

  const wantsEmail = opts.email === true || (opts.email !== false && EMAIL_ENABLED[type] === true);
  if (!wantsEmail) return row;
  if (!process.env.RESEND_API_KEY) return row;

  // Look up recipient email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true, name: true },
  }).catch(() => null);
  if (!user?.email) return row;

  try {
    const t = await getTranslations('mentora');
    const baseKey = emailKeyForType(type);
    const params = { ...payload, name: user.firstName ?? user.name ?? '' } as Record<string, unknown>;
    let subject = '';
    let body = '';
    try {
      subject = t(`${baseKey}.subject`, params as never);
    } catch {
      subject = `[Mentora] ${type}`;
    }
    try {
      body = t(`${baseKey}.body`, params as never);
    } catch {
      body = `Type: ${type}\n${JSON.stringify(payload)}`;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mentora <noreply@digizelle.fr>',
        to: user.email,
        replyTo: process.env.CONTACT_TO_EMAIL || 'contact@digizelle.fr',
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[mentora notify] Resend non-OK', res.status, detail);
    }
  } catch (err) {
    console.error('[mentora notify] email error', err);
  }

  return row;
}
