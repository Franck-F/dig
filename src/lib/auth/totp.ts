import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 6238 TOTP implementation. Compatible with Google Authenticator,
 * 1Password, Authy, Microsoft Authenticator, etc. Six-digit codes,
 * 30-second period, HMAC-SHA1 (the de-facto standard, despite SHA1's
 * brittleness — TOTP truncates to 31 bits so a SHA1 collision in the
 * underlying hash would not weaken the OTP material).
 *
 * Why home-grown rather than a package?
 *   The full spec is ~50 lines and the surface we need is tiny (generate
 *   secret, render `otpauth://` URI, verify a code). A focused
 *   implementation is easier to audit than pulling in an opinionated
 *   library that brings options we'd never enable.
 *
 * Standard parameter choices (matched to authenticator-app defaults):
 *   - 20-byte secret (160 bits) — RFC 4226 §4 R3
 *   - 6 digits
 *   - 30s period
 *   - HMAC-SHA1
 *   - ±1 step verification window (90s total) so wall-clock skew on the
 *     phone or server doesn't lock the user out.
 */

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const ALG = 'sha1';
const SECRET_BYTES = 20;
const ALLOWED_DRIFT_STEPS = 1;

/* ──────────────────────────────────────────────────────────────────────
   Base32 (RFC 4648) — used for the secret representation. We hand-roll it
   so we don't depend on Node's experimental encoder. No padding chars in
   the output (compatible with Google Authenticator's QR import).
   ────────────────────────────────────────────────────────────────────── */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/* ──────────────────────────────────────────────────────────────────────
   Secret generation
   ────────────────────────────────────────────────────────────────────── */

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

/**
 * Build the `otpauth://totp/...` URI used by every authenticator app's
 * QR-code import. Parameters follow the de-facto Google Authenticator
 * spec.
 *
 * `issuer` and `accountName` are URL-encoded. `accountName` is typically
 * the user's email; `label` is rendered as `<issuer>:<accountName>` so
 * users see `Digizelle (alice@example.com)` in their app.
 */
export function buildOtpAuthUri(opts: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = opts.issuer ?? 'Digizelle';
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(opts.accountName)}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ──────────────────────────────────────────────────────────────────────
   Code generation + verification
   ────────────────────────────────────────────────────────────────────── */

function counterFromTime(unixMs: number, step = 0): Buffer {
  // Clamp at zero — RFC 6238 counters are unsigned, and `step` of -1
  // when the current counter is 0 (only happens in tests with
  // `nowMs = 0`) would otherwise blow up `writeUInt32BE`. Real
  // production calls use `Date.now()` so the counter is always
  // ~58 million and the clamp is a no-op.
  const raw = Math.floor(unixMs / 1000 / PERIOD_SECONDS) + step;
  const counter = Math.max(0, raw);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian — JS bitwise ops are 32-bit, so split.
  buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
  buf.writeUInt32BE(counter & 0xffff_ffff, 4);
  return buf;
}

function generateCodeForCounter(secret: Buffer, counter: Buffer): string {
  const hmac = createHmac(ALG, secret).update(counter).digest();
  // Dynamic truncation, RFC 4226 §5.3
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = (truncated % 10 ** DIGITS).toString().padStart(DIGITS, '0');
  return code;
}

/**
 * Verify a user-supplied code against the secret. Accepts the current
 * 30-second window plus ±1 step (so the user can submit a code that
 * just expired or is about to roll over without flake).
 *
 * Returns `true` on a match. Uses constant-time comparison to avoid
 * leaking the closest-match step via timing.
 */
export function verifyTotp(secretBase32: string, userCode: string, nowMs: number = Date.now()): boolean {
  const cleaned = userCode.replace(/\s+/g, '');
  if (!/^[0-9]{6}$/.test(cleaned)) return false;
  // base32Decode throws on invalid characters. A malformed secret
  // never matches a real authenticator app's output, so we return
  // false rather than propagate the exception — callers (server
  // actions) treat that as `invalid_code`.
  let secret: Buffer;
  try {
    secret = base32Decode(secretBase32);
  } catch {
    return false;
  }

  const userBuf = Buffer.from(cleaned, 'utf8');
  for (let drift = -ALLOWED_DRIFT_STEPS; drift <= ALLOWED_DRIFT_STEPS; drift += 1) {
    const counter = counterFromTime(nowMs, drift);
    const expected = generateCodeForCounter(secret, counter);
    const expBuf = Buffer.from(expected, 'utf8');
    if (expBuf.length === userBuf.length && timingSafeEqual(expBuf, userBuf)) {
      return true;
    }
  }
  return false;
}

/* ──────────────────────────────────────────────────────────────────────
   Backup codes — 10 single-use codes, hashed with bcrypt before storage.
   We render them in 8-character groups for readability (`xxxx-xxxx`).
   ────────────────────────────────────────────────────────────────────── */

export function generateBackupCodes(count = 10): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    // 5 random bytes = 10 hex chars; we split as 5+5 with a hyphen.
    const hex = randomBytes(5).toString('hex');
    out.push(`${hex.slice(0, 5)}-${hex.slice(5, 10)}`);
  }
  return out;
}
