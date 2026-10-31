import type { NotificationType } from '@prisma/client';

/**
 * Transactional email contract for Mentora notifications (pure: no Prisma,
 * no next-intl, testable with `node --test`).
 *
 * Each emailed NotificationType maps to `mentora.notifications.emails.<key>`
 * with `subject` and `body` strings using `{var}` placeholders. Rendering
 * throws on a missing key or variable so a broken template fails the
 * contract test instead of reaching an inbox as raw JSON.
 */

export const EMAIL_ENABLED = [
  'REQUEST_RECEIVED',
  'REQUEST_ACCEPTED',
  'REQUEST_DECLINED',
  'SESSION_SCHEDULED',
  'SESSION_REMINDER',
  'SESSION_CANCELLED',
  'MENTOR_APPROVED',
] as const satisfies readonly NotificationType[];

export type EmailNotificationType = (typeof EMAIL_ENABLED)[number];

const TEMPLATE_KEYS: Record<EmailNotificationType, string> = {
  REQUEST_RECEIVED: 'requestReceived',
  REQUEST_ACCEPTED: 'requestAccepted',
  REQUEST_DECLINED: 'requestDeclined',
  SESSION_SCHEDULED: 'sessionScheduled',
  SESSION_REMINDER: 'sessionReminder',
  SESSION_CANCELLED: 'sessionCancelled',
  MENTOR_APPROVED: 'mentorApproved',
};

/** The other person the notification is about (sender, other party). */
type Counterpart = { counterpartUserId: string };

export type EmailPayloads = {
  REQUEST_RECEIVED: Counterpart & { requestId: string; message: string };
  REQUEST_ACCEPTED: Counterpart & { requestId: string; mentorshipId: string };
  REQUEST_DECLINED: Counterpart & { requestId: string; reason: string };
  SESSION_SCHEDULED: Counterpart & {
    sessionId: string;
    mentorshipId: string;
    scheduledAt: string;
    durationMinutes: number;
  };
  SESSION_REMINDER: Counterpart & {
    sessionId: string;
    mentorshipId: string;
    scheduledAt: string;
    meetingUrl: string | null;
  };
  SESSION_CANCELLED: Counterpart & {
    sessionId: string;
    mentorshipId: string;
    scheduledAt: string;
    reason: string;
  };
  MENTOR_APPROVED: { mentorProfileId: string };
};

export type EmailLocale = 'fr' | 'en';

export type EmailRenderContext = {
  recipientName: string;
  counterpartName: string;
  locale: EmailLocale;
  timeZone: string;
  appUrl: string;
};

export const DEFAULT_EMAIL_LOCALE: EmailLocale = 'fr';
export const DEFAULT_TIME_ZONE = 'Europe/Paris';

export function isEmailEnabled(type: NotificationType): type is EmailNotificationType {
  return (EMAIL_ENABLED as readonly NotificationType[]).includes(type);
}

export function formatEmailDateTime(iso: string, locale: EmailLocale, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
  return `${formatted} (${timeZone})`;
}

function targetPath(type: EmailNotificationType, payload: Record<string, unknown>): string {
  switch (type) {
    case 'REQUEST_RECEIVED':
      return '/mentora/dashboard/requests?tab=received';
    case 'REQUEST_ACCEPTED':
      return `/mentora/dashboard/mentorships/${payload.mentorshipId}`;
    case 'REQUEST_DECLINED':
      return '/mentora/discover';
    case 'SESSION_SCHEDULED':
    case 'SESSION_REMINDER':
    case 'SESSION_CANCELLED':
      return `/mentora/dashboard/sessions/${payload.sessionId}`;
    case 'MENTOR_APPROVED':
      return '/mentora/dashboard';
  }
}

export function buildEmailVars<T extends EmailNotificationType>(
  type: T,
  payload: EmailPayloads[T],
  ctx: EmailRenderContext,
): Record<string, string> {
  const p = payload as Record<string, unknown>;
  const url = `${ctx.appUrl}${targetPath(type, p)}`;
  const vars: Record<string, string> = {
    recipientName: ctx.recipientName,
    senderName: ctx.counterpartName,
    otherName: ctx.counterpartName,
    url,
  };
  if (typeof p.message === 'string') vars.message = p.message;
  if (typeof p.reason === 'string') vars.reason = p.reason;
  if (typeof p.durationMinutes === 'number') vars.duration = String(p.durationMinutes);
  if (typeof p.scheduledAt === 'string') {
    vars.date = formatEmailDateTime(p.scheduledAt, ctx.locale, ctx.timeZone);
  }
  if (type === 'SESSION_REMINDER') {
    vars.meetingUrl = typeof p.meetingUrl === 'string' && p.meetingUrl ? p.meetingUrl : url;
  }
  return vars;
}

function interpolate(template: string, vars: Record<string, string>, where: string): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`[mentora email] missing variable {${name}} in ${where}`);
    return value;
  });
}

export function renderNotificationEmail(
  type: EmailNotificationType,
  messages: Record<string, unknown>,
  vars: Record<string, string>,
): { subject: string; body: string } {
  const key = TEMPLATE_KEYS[type];
  const emails = (messages as { mentora?: { notifications?: { emails?: Record<string, unknown> } } })
    .mentora?.notifications?.emails;
  const template = emails?.[key] as { subject?: unknown; body?: unknown } | undefined;
  if (typeof template?.subject !== 'string' || typeof template?.body !== 'string') {
    throw new Error(`[mentora email] missing template mentora.notifications.emails.${key}`);
  }
  return {
    subject: interpolate(template.subject, vars, `${key}.subject`),
    body: interpolate(template.body, vars, `${key}.body`),
  };
}

export function displayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}): string {
  const full = [user.firstName, user.lastName].filter((s) => s && s.trim()).join(' ').trim();
  return full || user.name?.trim() || '';
}
