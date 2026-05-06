/**
 * Thin Resend wrapper used by all transactional flows (contact form,
 * signup verification, password reset).
 *
 * Mirrors the fetch pattern in `src/lib/actions/contact.ts` (which keeps
 * Resend optional and DB-first). When `RESEND_API_KEY` is empty the call
 * is mocked: the email content is logged to stdout and `{ ok: true,
 * mocked: true }` is returned, so dev environments without a key still
 * exercise the full flow end-to-end (the user can copy the code from the
 * server logs).
 */

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Optional reply-to override; defaults to noreply (none). */
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; mocked?: boolean; id?: string }
  | { ok: false; error: string };

const FROM = 'Digizelle <noreply@digizelle.fr>';

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // Dev-friendly mock when no key is set. Logs subject + a snippet so
  // engineers can grab verification codes from the terminal without a
  // real Resend account.
  if (!apiKey) {
    console.warn('[email:mocked]', { to, subject });
    if (text) console.warn('[email:mocked text]\n' + text);
    return { ok: true, mocked: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html,
        ...(text ? { text } : {}),
        ...(replyTo ? { replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[email] Resend non-OK response', res.status, detail);
      return { ok: false, error: `Resend ${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('[email] Resend request failed', err);
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
