/**
 * Pure ISO 8601 week helpers, extracted from `weekly-digest.ts` so they
 * can be unit-tested without dragging the Prisma client into the test
 * runtime. No imports — safe under any module resolver.
 */

/** ISO 8601 week number ("YYYY-W##"). Used for the campaign tag. */
export function isoWeekTag(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Human-readable ISO week range ("du 5 mai au 11 mai").
 *
 * Computes the range using UTC arithmetic *and* renders with
 * `timeZone: 'UTC'` so a date at any time-of-day on the same UTC
 * calendar day yields the same label. Without the explicit TZ on the
 * formatter, a 23:00 UTC input would render as the next local day in
 * positive-offset zones (e.g. Europe/Paris), which broke the
 * "any-day-of-the-week → same range" invariant. */
export function isoWeekLabel(d: Date): string {
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const start = new Date(d);
  // Monday of current week (UTC).
  const dayNum = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - dayNum);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `du ${fmt.format(start)} au ${fmt.format(end)}`;
}
