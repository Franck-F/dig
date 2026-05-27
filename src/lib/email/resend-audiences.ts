/**
 * Resend Audiences sync — keep the canonical newsletter list in sync
 * with a Resend Audience so we get:
 *
 *  • the Resend dashboard as a live view of "who's subscribed";
 *  • Resend's hosted unsubscribe page (one-click, RFC 8058 compliant)
 *    handling unsubscribes via the dashboard or email-client buttons;
 *  • bounce / complaint feedback loops flowing back to Resend without
 *    us tracking them by hand.
 *
 * Design:
 *  - Best-effort. Every call returns `{ ok }` and never throws so a
 *    Resend outage can't break user-facing flows (newsletter signup,
 *    unsubscribe page).
 *  - No-ops if `RESEND_API_KEY` or `RESEND_AUDIENCE_ID` is unset —
 *    keeps dev and self-hosted envs working without a Resend account.
 *  - All requests are issued via `fetch` (no `resend` SDK dependency)
 *    to stay consistent with `src/lib/email/resend.ts`.
 *
 * Backfill / repair: see `prisma/sync-resend-audiences.ts`.
 */

const RESEND_BASE = 'https://api.resend.com';

type AudienceConfig = {
  apiKey: string;
  audienceId: string;
};

function getConfig(): AudienceConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return null;
  return { apiKey, audienceId };
}

type ContactPayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  /** When true, the contact will not receive emails from the audience. */
  unsubscribed?: boolean;
};

/**
 * Add (or update) a contact in the configured Resend Audience.
 *
 * Resend's `POST /audiences/:id/contacts` is idempotent: if the email
 * already exists in the audience it returns 200 with the existing
 * contact. We use the returned `id` for downstream reference, though
 * most callers don't need it.
 */
export async function addContactToAudience(
  payload: ContactPayload,
): Promise<{ ok: boolean; id?: string }> {
  const cfg = getConfig();
  if (!cfg) return { ok: true }; // no-op when not configured

  try {
    const res = await fetch(`${RESEND_BASE}/audiences/${cfg.audienceId}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payload.email.toLowerCase(),
        first_name: payload.firstName,
        last_name: payload.lastName,
        unsubscribed: payload.unsubscribed ?? false,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn('[resend-audiences] add failed', res.status, detail);
      return { ok: false };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    console.warn('[resend-audiences] add threw', err);
    return { ok: false };
  }
}

/**
 * Mark a contact unsubscribed in the configured Resend Audience.
 *
 * We prefer `unsubscribed: true` over `DELETE` so the contact stays in
 * the audience as a permanent suppression marker — re-adding the same
 * email later will not silently re-subscribe them, and the dashboard
 * reflects the historical opt-out.
 *
 * Resend exposes the unsubscribe flag via `PATCH /audiences/:id/contacts/:email_or_id`.
 */
export async function unsubscribeContactFromAudience(
  email: string,
): Promise<{ ok: boolean }> {
  const cfg = getConfig();
  if (!cfg) return { ok: true }; // no-op when not configured

  try {
    const res = await fetch(
      `${RESEND_BASE}/audiences/${cfg.audienceId}/contacts/${encodeURIComponent(email.toLowerCase())}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unsubscribed: true }),
      },
    );

    if (!res.ok && res.status !== 404) {
      // 404 = contact never existed; treat as success (idempotent).
      const detail = await res.text().catch(() => '');
      console.warn('[resend-audiences] unsubscribe failed', res.status, detail);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[resend-audiences] unsubscribe threw', err);
    return { ok: false };
  }
}

/**
 * Whether the audience sync is configured. Useful for the admin UI to
 * surface a "sync enabled" indicator without leaking the API key.
 */
export function isAudienceSyncConfigured(): boolean {
  return getConfig() !== null;
}
