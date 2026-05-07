import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resend webhook receiver.
 *
 * Resend signs webhooks via the Svix protocol. Headers:
 *   svix-id        — message id (used in the signature)
 *   svix-timestamp — Unix epoch seconds of the signing time
 *   svix-signature — `v1,<base64-hmac>` (multiple comma/space-separated
 *                    signatures may be present during secret rotation)
 *
 * To verify: HMAC-SHA256(svix-id + '.' + svix-timestamp + '.' + body)
 * keyed by the secret bytes. The secret is stored as `whsec_<base64>`;
 * we strip the prefix and base64-decode to get the raw key.
 *
 * Replay protection: reject messages with timestamps older than 5 min.
 *
 * Handled events:
 *   email.bounced       — hard bounce. Flag user.emailBouncedAt.
 *   email.complained    — marked as spam. Same treatment.
 *   email.delivery_delayed — soft bounce. Log breadcrumb only.
 *
 * Everything else is acknowledged with 200 so Resend doesn't retry.
 *
 * Env: RESEND_WEBHOOK_SECRET. When unset the endpoint refuses every
 * request — there's no dev mock here, the dashboard's "send test event"
 * is sufficient for local testing.
 */

const SVIX_TOLERANCE_SEC = 5 * 60;

function decodeWebhookSecret(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  // Resend exposes the secret as `whsec_<base64>`. Strip prefix.
  const base = raw.startsWith('whsec_') ? raw.slice('whsec_'.length) : raw;
  try {
    return Buffer.from(base, 'base64');
  } catch {
    return null;
  }
}

function verifySvixSignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignatureHeader: string,
  secret: Buffer,
): boolean {
  // Replay protection.
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SVIX_TOLERANCE_SEC) return false;

  // Compute the expected signature.
  const signed = `${svixId}.${svixTimestamp}.${body}`;
  const expected = createHmac('sha256', secret).update(signed).digest();

  // Header is space-separated `v1,<sig>` pairs (allows rotation). Any match wins.
  for (const part of svixSignatureHeader.split(' ')) {
    const [version, providedB64] = part.split(',');
    if (version !== 'v1' || !providedB64) continue;
    let provided: Buffer;
    try {
      provided = Buffer.from(providedB64, 'base64');
    } catch {
      continue;
    }
    if (provided.length !== expected.length) continue;
    if (timingSafeEqual(provided, expected)) return true;
  }
  return false;
}

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    from?: string;
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    reason?: string;
  };
};

function emailsFromEvent(ev: ResendEvent): string[] {
  const to = ev.data?.to;
  if (!to) return [];
  return (Array.isArray(to) ? to : [to]).map((e) => e.toLowerCase().trim());
}

export async function POST(request: Request): Promise<Response> {
  const secret = decodeWebhookSecret(process.env.RESEND_WEBHOOK_SECRET);
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'webhook_not_configured' }, { status: 503 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ ok: false, error: 'missing_signature_headers' }, { status: 401 });
  }

  // Read the raw body once so the signature check sees the exact bytes.
  const rawBody = await request.text();
  const valid = verifySvixSignature(
    rawBody,
    svixId,
    svixTimestamp,
    svixSignature,
    secret,
  );
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: false, error: 'malformed_body' }, { status: 400 });
  }

  const emails = emailsFromEvent(event);
  let flagged = 0;

  try {
    switch (event.type) {
      case 'email.bounced':
      case 'email.complained': {
        const reason =
          event.type === 'email.complained'
            ? 'complaint'
            : event.data?.bounce?.message ??
              event.data?.bounce?.type ??
              'bounced';
        if (emails.length > 0) {
          const r = await prisma.user.updateMany({
            where: {
              email: { in: emails },
              emailBouncedAt: null,
            },
            data: {
              emailBouncedAt: new Date(),
              emailBouncedReason: reason.slice(0, 500),
              // Also flip marketing off so even if the bounce is somehow
              // resolved later, we don't immediately re-blast.
              marketingEmailsEnabled: false,
            },
          });
          flagged = r.count;
        }
        Sentry.addBreadcrumb({
          category: 'email-webhook',
          message: `${event.type} flagged ${flagged} users`,
          data: { emails, reason },
          level: 'warning',
        });
        break;
      }
      case 'email.delivery_delayed': {
        // Soft bounce — informational only. We don't flag yet because
        // the message may still deliver on retry. If we want to act on
        // sustained delays we'd need a counter / time window.
        Sentry.addBreadcrumb({
          category: 'email-webhook',
          message: 'email.delivery_delayed',
          data: { emails, reason: event.data?.reason ?? null },
          level: 'info',
        });
        break;
      }
      default:
        // Other event types (sent, delivered, opened, clicked) — accept
        // and ignore. Returning 200 prevents Resend's retry loop.
        break;
    }
  } catch (err) {
    // DB failure: tell Resend to retry by returning 5xx so we don't
    // permanently lose a bounce signal.
    console.error('[webhook.resend] handler failed', err);
    Sentry.captureException(err, { tags: { area: 'webhook.resend', type: event.type } });
    return NextResponse.json({ ok: false, error: 'handler_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, flagged });
}
