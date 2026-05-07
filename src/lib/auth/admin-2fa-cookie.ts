import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Signed cookie that proves a user has cleared the second-factor
 * challenge. Distinct from NextAuth's session cookie — they carry
 * different lifetimes and different revocation semantics:
 *
 *   - Session cookie: lasts up to 30 days (rolling), survives password
 *     change. Establishes "who".
 *   - 2FA cookie: lasts ADMIN_2FA_TTL_MS (8h by default — one workday),
 *     does NOT roll. Establishes "this device, this session, has shown
 *     possession of the TOTP factor recently."
 *
 * Layout enforcement: every request to `/community/admin/*` and
 * `/mentora/admin/*` reads this cookie via `verifyAdmin2faCookie`. If
 * absent / expired / wrong signature, the layout redirects the user to
 * `/account/2fa/challenge?next=<original_path>`.
 *
 * Format: `<base64url(json{uid,exp})>.<base64url(hmac)>` — same scheme
 * as src/lib/email/unsubscribe-token.ts. Reusing the structure means the
 * surface area to audit is shared.
 */

const COOKIE_NAME = 'dz-admin-2fa';
const ADMIN_2FA_TTL_MS = 8 * 60 * 60 * 1000;

type Payload = {
  uid: string;
  exp: number;
};

function getSecret(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is required to sign admin 2FA cookies');
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

function sign(payload: Payload): string {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(createHmac('sha256', getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

function verify(value: string): { ok: true; uid: string } | { ok: false } {
  const parts = value.split('.');
  if (parts.length !== 2) return { ok: false };
  const [body, sig] = parts;

  let expectedSig: Buffer;
  try {
    expectedSig = createHmac('sha256', getSecret()).update(body).digest();
  } catch {
    return { ok: false };
  }
  let providedSig: Buffer;
  try {
    providedSig = b64urlDecode(sig);
  } catch {
    return { ok: false };
  }
  if (expectedSig.length !== providedSig.length || !timingSafeEqual(expectedSig, providedSig)) {
    return { ok: false };
  }

  let parsed: Payload;
  try {
    parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as Payload;
  } catch {
    return { ok: false };
  }
  if (typeof parsed.uid !== 'string' || typeof parsed.exp !== 'number') {
    return { ok: false };
  }
  if (parsed.exp < Date.now()) {
    return { ok: false };
  }
  return { ok: true, uid: parsed.uid };
}

/**
 * Issue the cookie and write it on the response. Call this immediately
 * after successfully verifying a TOTP code at `/account/2fa/challenge`.
 *
 * The cookie is httpOnly + sameSite=lax + secure-in-prod. We do NOT mark
 * `path=/admin` because admin areas live under multiple roots
 * (community + mentora) and a single cookie should cover both.
 */
export async function setAdmin2faCookie(uid: string, ttlMs = ADMIN_2FA_TTL_MS): Promise<void> {
  const value = sign({ uid, exp: Date.now() + ttlMs });
  const c = await cookies();
  c.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(ttlMs / 1000),
    path: '/',
  });
}

/**
 * Read + validate the cookie for the given user. Returns true only if
 * the cookie is present, signed by us, not expired, and bound to the
 * same `uid` we're checking — preventing cookie substitution from one
 * admin to another.
 */
export async function hasFreshAdmin2faCookie(uid: string): Promise<boolean> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const v = verify(raw);
  return v.ok && v.uid === uid;
}

/**
 * Tear down the cookie. Called on disable-2FA, on sign-out, or any time
 * we want to force re-challenge.
 */
export async function clearAdmin2faCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
