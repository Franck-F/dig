import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed unsubscribe tokens for the 1-click unsubscribe flow.
 *
 * RGPD article 5 + CAN-SPAM both require unsubscribe to work without
 * authentication ("the recipient should not have to log in"), so the
 * token IS the credential — it must be unguessable.
 *
 * Format: `<base64url(json{uid,list,exp})>.<base64url(hmac)>`
 *  - uid : User.id of the recipient
 *  - list: which list to opt out of ('marketing' is the only one today;
 *          we keep the field for future granularity, e.g. 'digest')
 *  - exp : Unix epoch ms after which the token is rejected
 *  - hmac: HMAC-SHA256 of the payload bytes, keyed by AUTH_SECRET
 *
 * Why HMAC vs JWT? No new dependency, no algorithm-confusion footgun
 * (jwt's `alg: none` history). HMAC-SHA256 is the same primitive the
 * JOSE folks would have us use anyway, just without the JSON wrapper.
 *
 * Why not JWE/encrypt? The token only contains a userId + list — no
 * PII. Signing is enough.
 */

const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year — link in old emails should still work

export type UnsubscribeList = 'marketing';

type Payload = {
  uid: string;
  list: UnsubscribeList;
  exp: number;
};

function getSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Server actions / cron won't boot without AUTH_SECRET; keeping a
    // hard error here rather than silent fallback so misconfiguration
    // is loud at first send attempt.
    throw new Error('AUTH_SECRET is required to sign unsubscribe tokens');
  }
  return Buffer.from(secret, 'utf8');
}

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(input.length / 4) * 4,
    '=',
  );
  return Buffer.from(padded, 'base64');
}

export function signUnsubscribeToken(
  uid: string,
  list: UnsubscribeList = 'marketing',
  ttlMs = TOKEN_TTL_MS,
): string {
  const payload: Payload = { uid, list, exp: Date.now() + ttlMs };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(
    createHmac('sha256', getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export type VerifyResult =
  | { ok: true; uid: string; list: UnsubscribeList }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyUnsubscribeToken(token: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [body, sig] = parts;

  // Re-sign and constant-time compare. timingSafeEqual throws if the
  // buffers differ in length — gate that first.
  let expectedSig: Buffer;
  try {
    expectedSig = createHmac('sha256', getSecret()).update(body).digest();
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  let providedSig: Buffer;
  try {
    providedSig = b64urlDecode(sig);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    expectedSig.length !== providedSig.length ||
    !timingSafeEqual(expectedSig, providedSig)
  ) {
    return { ok: false, reason: 'bad_signature' };
  }

  let parsed: Payload;
  try {
    parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as Payload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    typeof parsed.uid !== 'string' ||
    typeof parsed.list !== 'string' ||
    typeof parsed.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (parsed.exp < Date.now()) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, uid: parsed.uid, list: parsed.list as UnsubscribeList };
}

/**
 * Build the absolute URL to the unsubscribe page for a given user. Used
 * inside email templates and inside the `List-Unsubscribe` header.
 *
 * `siteUrl` is read at call time so a change in `NEXT_PUBLIC_SITE_URL`
 * (or its computed fallback) takes effect on the next email send
 * without a rebuild.
 */
export function buildUnsubscribeUrl(uid: string, list: UnsubscribeList = 'marketing'): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    'https://digizelle.fr';
  const token = signUnsubscribeToken(uid, list);
  return `${base.replace(/\/$/, '')}/email/unsubscribe?t=${encodeURIComponent(token)}`;
}
