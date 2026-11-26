/**
 * Date formatters for Mentora surfaces (pure). Every formatter takes the
 * viewer's time zone and the active locale: server components run in UTC
 * on Vercel, so formatting without a `timeZone` showed server time (M10).
 * Default zone: Europe/Paris, the platform's home zone, used when the
 * viewer has no profile time zone.
 */

export const DEFAULT_TIME_ZONE = 'Europe/Paris';

export type FormatOptions = { timeZone?: string; locale?: string };

type DateInput = Date | string | null | undefined;

const INTL_LOCALE: Record<string, string> = { fr: 'fr-FR', en: 'en-GB' };

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(opts: FormatOptions, parts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = INTL_LOCALE[opts.locale ?? 'fr'] ?? opts.locale ?? 'fr-FR';
  const timeZone = opts.timeZone || DEFAULT_TIME_ZONE;
  const key = `${locale}|${timeZone}|${JSON.stringify(parts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...parts, timeZone });
    cache.set(key, f);
  }
  return f;
}

function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

export function fmtDateTime(d: DateInput, opts: FormatOptions = {}): string {
  if (!d) return '—';
  return formatter(opts, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(toDate(d));
}

export function fmtDate(d: DateInput, opts: FormatOptions = {}): string {
  if (!d) return '—';
  return formatter(opts, { day: '2-digit', month: 'short', year: 'numeric' }).format(toDate(d));
}

export function fmtTime(d: DateInput, opts: FormatOptions = {}): string {
  if (!d) return '—';
  return formatter(opts, { hour: '2-digit', minute: '2-digit' }).format(toDate(d));
}

/** Day number, short month and time parts for agenda-style lists. */
export function fmtParts(d: Date | string, opts: FormatOptions = {}): { day: string; month: string; time: string } {
  const v = toDate(d);
  return {
    day: formatter(opts, { day: '2-digit' }).format(v),
    month: formatter(opts, { month: 'short' }).format(v),
    time: formatter(opts, { hour: '2-digit', minute: '2-digit' }).format(v),
  };
}

/** Calendar day `YYYY-MM-DD` of an instant in a time zone. */
function dayKey(d: Date, timeZone: string): string {
  return formatter({ locale: 'en-CA', timeZone }, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function previousDayKey(key: string): string {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day - 1, 12)).toISOString().slice(0, 10);
}

/** Returns 'today' | 'yesterday' | 'earlier' in the viewer's calendar, for grouping notifications. */
export function dayBucket(
  d: Date | string,
  opts: { timeZone?: string; now?: Date } = {},
): 'today' | 'yesterday' | 'earlier' {
  const timeZone = opts.timeZone || DEFAULT_TIME_ZONE;
  const today = dayKey(opts.now ?? new Date(), timeZone);
  const key = dayKey(toDate(d), timeZone);
  if (key >= today) return 'today';
  if (key === previousDayKey(today)) return 'yesterday';
  return 'earlier';
}

/** Same precedence as notification emails: mentor profile, then mentee profile, then the default. */
export function viewerTimeZone(input: {
  mentorTimeZone: string | null | undefined;
  menteeTimeZone: string | null | undefined;
}): string {
  return input.mentorTimeZone || input.menteeTimeZone || DEFAULT_TIME_ZONE;
}
