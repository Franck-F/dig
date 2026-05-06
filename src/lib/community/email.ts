import 'server-only';
import { getTranslations } from 'next-intl/server';

/**
 * Direct Resend email helper for community-scoped operational emails.
 * Used by:
 *   - Per-event moderation emails (warn / mute / suspend / ban / unban). Spec §7.2.
 *   - Daily digest cron. Spec §7.3.
 *
 * Failures are logged and swallowed; never throw out of this module.
 */

const FROM = 'Digizelle Community <noreply@digizelle.fr>';

export async function sendCommunityEmail(args: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; status?: number }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: args.to,
        replyTo: process.env.CONTACT_TO_EMAIL || 'contact@digizelle.fr',
        subject: args.subject,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[community email] Resend non-OK', res.status, detail);
    }
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error('[community email] fetch error', e);
    return { ok: false };
  }
}

/**
 * Translate an i18n key under `community.emails.*` and send. Falls back to a
 * minimal English subject/body if the key is missing — better to deliver
 * something than nothing.
 */
export async function sendCommunityTemplatedEmail(args: {
  to: string;
  /** key root, e.g. `community.emails.warned`. Sub-keys `subject` and `body`. */
  keyRoot: string;
  params?: Record<string, unknown>;
  fallbackSubject?: string;
  fallbackBody?: string;
}): Promise<{ ok: boolean }> {
  const { to, keyRoot, params = {}, fallbackSubject = 'Digizelle Community', fallbackBody = '' } = args;
  let subject = fallbackSubject;
  let text = fallbackBody;
  try {
    const t = await getTranslations();
    try {
      subject = t(`${keyRoot}.subject`, params as never);
    } catch {
      // keep fallback
    }
    try {
      text = t(`${keyRoot}.body`, params as never);
    } catch {
      // keep fallback
    }
  } catch (e) {
    console.error('[community email] translation lookup failed', e);
  }
  return sendCommunityEmail({ to, subject, text });
}
