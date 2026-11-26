import 'server-only';
import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_EMAIL_LOCALE,
  DEFAULT_TIME_ZONE,
  buildEmailVars,
  displayName,
  isEmailEnabled,
  renderNotificationEmail,
  type EmailLocale,
  type EmailNotificationType,
  type EmailPayloads,
} from './notification-emails';

const APP_URL =
  process.env.AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://digizelle.fr';

export type NotifyOptions = {
  /** `false` suppresses the email of an emailed type. Only the types in
   *  `EMAIL_ENABLED` (notification-emails.ts) ever send one. */
  email?: boolean | 'auto';
  payload?: Prisma.InputJsonValue;
};

export type NotifyPayload = Record<string, unknown>;

/** Emailed types must carry the fields their template needs. */
export type NotifyPayloadFor<T extends NotificationType> = T extends EmailNotificationType
  ? EmailPayloads[T] & NotifyPayload
  : NotifyPayload;

async function loadEmailMessages(locale: EmailLocale): Promise<Record<string, unknown>> {
  const mod = locale === 'en'
    ? await import('../../../messages/en.json')
    : await import('../../../messages/fr.json');
  return mod.default as Record<string, unknown>;
}

async function sendNotificationEmail<T extends EmailNotificationType>(
  userId: string,
  type: T,
  payload: EmailPayloads[T],
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      mentorProfile: { select: { timezone: true } },
      menteeProfile: { select: { timezone: true } },
    },
  });
  if (!user?.email) return;

  const counterpartUserId = (payload as { counterpartUserId?: unknown }).counterpartUserId;
  const counterpart = typeof counterpartUserId === 'string'
    ? await prisma.user.findUnique({
        where: { id: counterpartUserId },
        select: { firstName: true, lastName: true, name: true },
      })
    : null;

  // `User.locale` does not exist yet (phase 2e): every email goes out in
  // the default locale, never in the acting user's request locale.
  const locale = DEFAULT_EMAIL_LOCALE;
  const messages = await loadEmailMessages(locale);
  const vars = buildEmailVars(type, payload, {
    recipientName: user.firstName?.trim() || displayName(user),
    counterpartName: counterpart ? displayName(counterpart) : '',
    locale,
    timeZone: user.mentorProfile?.timezone || user.menteeProfile?.timezone || DEFAULT_TIME_ZONE,
    appUrl: APP_URL,
  });
  const { subject, body } = renderNotificationEmail(type, messages, vars);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Mentorat <noreply@digizelle.fr>',
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
}

/**
 * Create an in-app Notification row and, for the types listed in
 * `EMAIL_ENABLED`, send an email via Resend rendered in the recipient's
 * locale and time zone. Email failures never throw — they're logged.
 * Returns the created row id.
 */
export async function notify<T extends NotificationType>(
  userId: string,
  type: T,
  payload: NotifyPayloadFor<T>,
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

  if (opts.email === false || !isEmailEnabled(type)) return row;
  if (!process.env.RESEND_API_KEY) return row;

  try {
    await sendNotificationEmail(userId, type, payload as EmailPayloads[typeof type]);
  } catch (err) {
    console.error('[mentora notify] email error', err);
  }

  return row;
}
