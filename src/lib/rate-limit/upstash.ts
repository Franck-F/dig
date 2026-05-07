import 'server-only';

/**
 * Tiny Upstash Redis REST client — only the surface we need for
 * rate-limiting (INCR + EXPIRE + GET + DEL). Implemented from scratch
 * via fetch so we don't pull `@upstash/redis` for a handful of calls
 * the limiter makes per request.
 *
 * Activated when both env vars are set:
 *   UPSTASH_REDIS_REST_URL  — e.g. `https://eu1-xxx.upstash.io`
 *   UPSTASH_REDIS_REST_TOKEN — bearer token
 *
 * When either is missing, `isUpstashConfigured()` returns false and the
 * limiter falls back to its in-memory token bucket (multi-instance
 * deployments will see N× the configured capacity in that case — fine
 * for dev, not for production behind a Vercel autoscaler).
 *
 * Failure mode: every Upstash call has a 1.5 s timeout and a single
 * retry. On a definitive failure we **fail open** — return `null` and
 * let the caller decide. The limiter chooses to allow the request
 * rather than lock everyone out when Redis is unreachable; the
 * downside (a brief window of un-limited traffic) is far better than
 * total outage.
 */

const TIMEOUT_MS = 1500;
const RETRIES = 1;

export function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

/**
 * Execute a Redis command via the Upstash REST API. Body shape:
 *   ["COMMAND", "arg1", "arg2", ...]
 *
 * Returns the parsed `result` field on success or null on any error.
 */
async function exec(command: string[]): Promise<unknown | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: ctrl.signal,
        // No CDN caching; rate-limit reads must hit upstream.
        cache: 'no-store',
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: unknown; error?: string };
      if (json.error) return null;
      return json.result ?? null;
    } catch {
      // Timeout / network — retry once then give up.
    }
  }
  return null;
}

/**
 * Atomic-ish increment with TTL. The `INCR` Redis command sets the key
 * to 1 if missing, so the EXPIRE only takes effect on the first call
 * within the window. We pipeline both commands as a single REST call
 * (`MULTI/EXEC`) so the EXPIRE never gets lost between the INCR and
 * the failure to set it.
 *
 * Returns the post-increment counter, or null when Upstash is
 * unreachable (caller treats null as "fail open").
 */
export async function incrementWithExpiry(
  key: string,
  windowSec: number,
): Promise<number | null> {
  // Single round-trip via the pipeline endpoint. Each entry is one
  // command; the response is an array of {result|error} in order.
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const pipelineUrl = `${url.replace(/\/$/, '')}/pipeline`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(pipelineUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'], // only set TTL if not already set
      ]),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const incrResult = json[0]?.result;
    if (typeof incrResult === 'number') return incrResult;
    if (typeof incrResult === 'string') return Number(incrResult);
    return null;
  } catch {
    return null;
  }
}

/**
 * Read remaining TTL on a key in seconds. Used to compute the
 * Retry-After header without a second round-trip.
 */
export async function ttlSeconds(key: string): Promise<number | null> {
  const r = await exec(['TTL', key]);
  if (typeof r === 'number') return r;
  if (typeof r === 'string') return Number(r);
  return null;
}
