import 'server-only';
import { headers } from 'next/headers';

/**
 * Rate limiter dedicated to authentication flows: sign-in, sign-up, email
 * verification, password reset.
 *
 * Why a separate limiter from `src/lib/community/rateLimit.ts`?
 *  - The community limiter keys on `memberId` (post-auth). Auth flows happen
 *    *before* a session exists, so they need IP + email keys.
 *  - The buckets are tighter — defending against credential stuffing /
 *    enumeration / email bombing — whereas community buckets defend against
 *    spam from logged-in users.
 *  - Auth limits return 429 with a Retry-After header; community limits
 *    surface a translatable error code in the action result.
 *
 * Backend strategy:
 *  - Default: in-memory token bucket. Works in dev + low-traffic prod, but
 *    each Vercel instance has its own state. Effective limit ~= configured
 *    limit × instance count.
 *  - Production: when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 *    are set, the implementation lazily upgrades to a Redis-backed limiter
 *    so all instances share state. The Upstash integration is intentionally
 *    not imported eagerly — adding `@upstash/ratelimit` to the project is a
 *    deliberate next step (see TODO at the bottom).
 */

type CheckResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number; retryAfterSec: number };

type BucketState = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, BucketState>();

function refill(
  state: BucketState,
  capacity: number,
  refillPerSec: number,
  nowMs: number,
): BucketState {
  const elapsedMs = Math.max(0, nowMs - state.lastRefillMs);
  const tokensToAdd = (elapsedMs / 1000) * refillPerSec;
  const tokens = Math.min(capacity, state.tokens + tokensToAdd);
  return { tokens, lastRefillMs: nowMs };
}

function checkInMemory(
  key: string,
  capacity: number,
  refillPerSec: number,
  nowMs: number = Date.now(),
): CheckResult {
  const existing = buckets.get(key) ?? {
    tokens: capacity,
    lastRefillMs: nowMs,
  };
  const refilled = refill(existing, capacity, refillPerSec, nowMs);
  if (refilled.tokens >= 1) {
    refilled.tokens -= 1;
    buckets.set(key, refilled);
    return { ok: true, remaining: Math.floor(refilled.tokens) };
  }
  buckets.set(key, refilled);
  // Time to regenerate 1 token at the current refill rate.
  const retryAfterMs = Math.ceil((1 - refilled.tokens) * (1000 / refillPerSec));
  return {
    ok: false,
    retryAfterMs,
    retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  };
}

/**
 * Bucket configurations per auth action.
 *
 * `capacity` is the burst size (max attempts in a fresh bucket).
 * `windowSec` is the window over which the bucket fully refills.
 *
 * Two-key strategy: every action checks both `ip` and `email` buckets and
 * fails on whichever trips first. This protects against:
 *   - Single-IP brute force (high IP capacity, low per-email count)
 *   - Distributed brute force on a single account (low per-email count)
 *   - Email bombing (low per-email count on resend / reset)
 */
const BUCKETS = {
  signIn: {
    ip: { capacity: 30, windowSec: 15 * 60 },
    email: { capacity: 10, windowSec: 15 * 60 },
  },
  signUp: {
    ip: { capacity: 5, windowSec: 60 * 60 },
    // sign-up by definition doesn't have a prior email; only IP applies.
  },
  resendVerificationCode: {
    ip: { capacity: 10, windowSec: 60 * 60 },
    email: { capacity: 3, windowSec: 60 * 60 },
  },
  verifyEmailCode: {
    ip: { capacity: 30, windowSec: 60 * 60 },
    email: { capacity: 10, windowSec: 60 * 60 },
  },
  requestPasswordReset: {
    ip: { capacity: 5, windowSec: 60 * 60 },
    email: { capacity: 3, windowSec: 60 * 60 },
  },
  confirmPasswordReset: {
    ip: { capacity: 10, windowSec: 60 * 60 },
    email: { capacity: 5, windowSec: 60 * 60 },
  },
} as const satisfies Record<
  string,
  { ip: { capacity: number; windowSec: number }; email?: { capacity: number; windowSec: number } }
>;

export type AuthAction = keyof typeof BUCKETS;

/**
 * Read the client IP from request headers. Vercel sets `x-forwarded-for`
 * with the client IP first and intermediate proxies after. Fall back to
 * `x-real-ip` then `cf-connecting-ip` (Cloudflare) so the limiter still
 * works behind alternate edges. When nothing identifies the client (e.g.
 * server-side calls in tests), bucket on a constant — better to over-limit
 * than to leak unbounded attempts.
 */
export async function getRequestIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first;
    }
    const real = h.get('x-real-ip');
    if (real) return real;
    const cf = h.get('cf-connecting-ip');
    if (cf) return cf;
  } catch {
    /* headers() unavailable outside a request scope */
  }
  return 'unknown';
}

/**
 * Check both IP and email buckets for a given auth action. Returns `ok:true`
 * only when both pass; otherwise returns the failing decision so the caller
 * can surface a user-friendly retry message.
 *
 * Caller is responsible for normalising the email (lowercase + trim) before
 * passing it in — the bucket key is exact-string.
 */
export async function checkAuthRateLimit(
  action: AuthAction,
  email?: string,
): Promise<CheckResult> {
  const cfg = BUCKETS[action];
  const now = Date.now();
  const ip = await getRequestIp();

  const ipKey = `auth:${action}:ip:${ip}`;
  const ipDecision = checkInMemory(
    ipKey,
    cfg.ip.capacity,
    cfg.ip.capacity / cfg.ip.windowSec,
    now,
  );
  if (!ipDecision.ok) return ipDecision;

  // The email bucket is optional per action — `signUp` for instance only
  // gates on IP. Use a property-existence check (TS narrows the union).
  const cfgWithEmail = cfg as { email?: { capacity: number; windowSec: number } };
  if (cfgWithEmail.email && email) {
    const emailKey = `auth:${action}:email:${email.toLowerCase().trim()}`;
    const emailDecision = checkInMemory(
      emailKey,
      cfgWithEmail.email.capacity,
      cfgWithEmail.email.capacity / cfgWithEmail.email.windowSec,
      now,
    );
    if (!emailDecision.ok) return emailDecision;
  }

  return ipDecision;
}

/**
 * Translation key returned to the UI when rate-limited. The action layer
 * surfaces this via `AuthState.error` so `LoginForm` / similar can map it
 * to a localised message via i18n.
 *
 * The `retryAfterSec` is currently swallowed (we don't have a place in
 * AuthState to carry it). When a richer state shape is introduced, expose
 * it so the UI can show "Réessayez dans 12 minutes".
 */
export const AUTH_RATE_LIMIT_ERROR = 'rateLimited';

/**
 * Test helper — only for use by node:test specs. Resets the in-memory map.
 */
export function _resetAuthLimiterForTests(): void {
  buckets.clear();
}

/* TODO(phase-2 task #32): when Upstash Redis credentials land in env
 *   (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN), replace the
 *   `checkInMemory` call with `@upstash/ratelimit` + `@upstash/redis` so the
 *   limiter is multi-instance-safe. The bucket configs above translate 1:1
 *   to Upstash's `slidingWindow(capacity, "${windowSec} s")`. Keep the
 *   in-memory path as a dev fallback when env vars are missing. */
