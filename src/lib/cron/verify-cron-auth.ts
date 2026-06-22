import 'server-only';
import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time check of the `Authorization: Bearer <CRON_SECRET>` header on a
 * cron route. Returns false when CRON_SECRET is unset (fail-closed) or the
 * header is missing / malformed / mismatched. The length check both satisfies
 * timingSafeEqual's equal-length requirement and avoids leaking the secret
 * length via early return on a length mismatch.
 */
export function isAuthorizedCronRequest(authHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const prefix = 'Bearer ';
  if (!authHeader || !authHeader.startsWith(prefix)) return false;
  const provided = Buffer.from(authHeader.slice(prefix.length));
  const secret = Buffer.from(expected);
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(provided, secret);
}
