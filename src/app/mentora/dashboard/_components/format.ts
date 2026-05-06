/**
 * Light-weight date formatters used by dashboard surfaces.
 *
 * We deliberately avoid pulling another i18n date library — `Intl.DateTimeFormat`
 * with the `fr-FR` locale matches the only locale shipped today.
 */

const DT_FULL = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DT_SHORT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DT_TIME = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const v = typeof d === 'string' ? new Date(d) : d;
  return DT_FULL.format(v);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const v = typeof d === 'string' ? new Date(d) : d;
  return DT_SHORT.format(v);
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const v = typeof d === 'string' ? new Date(d) : d;
  return DT_TIME.format(v);
}

/** Returns 'today' | 'yesterday' | 'earlier' for grouping notifications. */
export function dayBucket(d: Date | string): 'today' | 'yesterday' | 'earlier' {
  const v = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startYday = startToday - 24 * 3600 * 1000;
  const t = v.getTime();
  if (t >= startToday) return 'today';
  if (t >= startYday) return 'yesterday';
  return 'earlier';
}
