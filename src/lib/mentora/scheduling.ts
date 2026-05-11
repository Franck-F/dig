/**
 * Mentorat scheduling algorithm — pure, DST-safe, no DB.
 *
 * Implements spec §4.
 * Uses `Intl.DateTimeFormat` (no extra deps) for IANA tz math; spec §4.3 explicitly
 * picks this over date-fns-tz to keep dependency surface minimal.
 */

import type { AvailabilityRule, AvailabilityException } from '@prisma/client';

export type Slot = { startUtc: Date; endUtc: Date };

type Booked = { scheduledAt: Date; durationMinutes: number };

type Interval = { startMs: number; endMs: number };

// ─────────────── Timezone math ────────────────────────────────────────────

/**
 * Compute the UTC offset (minutes) of a given IANA `tz` at the absolute instant `at`.
 * Positive means tz is east of UTC (e.g. Europe/Paris winter = +60).
 */
export function tzOffsetMinutes(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(at);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  const tzMs = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    Number(m.hour) === 24 ? 0 : Number(m.hour),
    Number(m.minute),
    Number(m.second),
  );
  return Math.round((tzMs - at.getTime()) / 60000);
}

/**
 * Construct a UTC Date that, when displayed in `tz`, reads as the given local
 * year/month/day/hour/minute. Uses two-step iteration to handle DST boundaries.
 *
 * Edge cases (per spec §4.3):
 *   • Spring-forward gap (e.g. 02:30 doesn't exist): we still produce *some*
 *     UTC instant; caller must verify the round-trip if it cares.
 *   • Fall-back overlap (e.g. 02:30 occurs twice): Intl resolves to the
 *     post-DST occurrence, matching spec.
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number, // 1..12
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  // First pass: pretend the local time is UTC and compute offset there.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  let offset = tzOffsetMinutes(guess, tz);
  let utcMs = guess.getTime() - offset * 60000;
  // Second pass: re-evaluate offset at the corrected instant (handles DST).
  for (let i = 0; i < 3; i++) {
    const next = new Date(utcMs);
    const off2 = tzOffsetMinutes(next, tz);
    if (off2 === offset) break;
    offset = off2;
    utcMs = guess.getTime() - offset * 60000;
  }
  return new Date(utcMs);
}

/** 0..6 weekday in `tz` for absolute instant `d`. 0 = Sunday. */
export function utcWeekdayInTz(d: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const wd = dtf.format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

/** Year/month/day in `tz` for absolute instant `d`. */
export function ymdInTz(d: Date, tz: string): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(d);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
  return { year: Number(m.year), month: Number(m.month), day: Number(m.day) };
}

// ─────────────── Interval set algebra ─────────────────────────────────────

function unionIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const out: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, cur.endMs);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function subtractInterval(set: Interval[], block: Interval): Interval[] {
  const out: Interval[] = [];
  for (const i of set) {
    if (block.endMs <= i.startMs || block.startMs >= i.endMs) {
      out.push(i);
      continue;
    }
    if (block.startMs > i.startMs) out.push({ startMs: i.startMs, endMs: block.startMs });
    if (block.endMs < i.endMs) out.push({ startMs: block.endMs, endMs: i.endMs });
  }
  return out;
}

function subtractMany(set: Interval[], blocks: Interval[]): Interval[] {
  let cur = set;
  for (const b of blocks) cur = subtractInterval(cur, b);
  return cur;
}

// ─────────────── Public API ───────────────────────────────────────────────

export type GetAvailableSlotsArgs = {
  mentorTimezone: string;
  rules: Pick<AvailabilityRule, 'dayOfWeek' | 'startMinute' | 'endMinute'>[];
  exceptions: Pick<AvailabilityException, 'date' | 'startMinute' | 'endMinute' | 'kind'>[];
  bookedSessions: Booked[];
  fromUtc: Date;
  toUtc: Date;
  durationMinutes: number;
  slotStepMinutes?: number;
  minNoticeHours?: number;
  nowUtc?: Date;
};

export function getAvailableSlots(args: GetAvailableSlotsArgs): Slot[] {
  const {
    mentorTimezone: tz,
    rules,
    exceptions,
    bookedSessions,
    fromUtc,
    toUtc,
    durationMinutes,
    slotStepMinutes = 15,
    minNoticeHours = 1,
    nowUtc = new Date(),
  } = args;

  if (!(fromUtc < toUtc)) throw new Error('mentora.errors.invalidWindow');
  const windowDays = (toUtc.getTime() - fromUtc.getTime()) / 86400000;
  if (windowDays > 56) throw new Error('mentora.errors.invalidWindow');
  if (durationMinutes < 15 || durationMinutes > 240) throw new Error('mentora.errors.invalidWindow');

  const noticeMs = minNoticeHours * 3600 * 1000;
  const effectiveFromMs = Math.max(fromUtc.getTime(), nowUtc.getTime() + noticeMs);
  if (effectiveFromMs >= toUtc.getTime()) return [];

  // Iterate days in mentor TZ
  const startYmd = ymdInTz(new Date(effectiveFromMs), tz);
  const endYmd = ymdInTz(toUtc, tz);

  // Build day cursor (in mentor TZ midnight)
  const dayCursors: { year: number; month: number; day: number }[] = [];
  let cy = startYmd.year;
  let cm = startYmd.month;
  let cd = startYmd.day;
  // Add a margin: include endYmd day too
  for (let safety = 0; safety < 60; safety++) {
    dayCursors.push({ year: cy, month: cm, day: cd });
    if (cy === endYmd.year && cm === endYmd.month && cd === endYmd.day) break;
    // advance one day in tz: take noon UTC of next day to avoid DST
    const nextNoonUtc = new Date(Date.UTC(cy, cm - 1, cd) + 36 * 3600 * 1000);
    const next = ymdInTz(nextNoonUtc, tz);
    cy = next.year;
    cm = next.month;
    cd = next.day;
  }

  // Group exceptions by yyyy-mm-dd
  const excByDay: Map<string, typeof exceptions> = new Map();
  for (const ex of exceptions) {
    // ex.date is `@db.Date` — Prisma returns it as Date (UTC midnight in many drivers).
    // Use its UTC year/month/day directly (this matches "date in mentor TZ stored as UTC midnight" convention).
    const exDate = ex.date instanceof Date ? ex.date : new Date(ex.date);
    const key = `${exDate.getUTCFullYear()}-${exDate.getUTCMonth() + 1}-${exDate.getUTCDate()}`;
    const arr = excByDay.get(key) ?? [];
    arr.push(ex);
    excByDay.set(key, arr);
  }

  const allFreeIntervals: Interval[] = [];

  for (const dc of dayCursors) {
    const dayMidnightUtc = zonedDateTimeToUtc(dc.year, dc.month, dc.day, 0, 0, tz);
    const weekday = utcWeekdayInTz(dayMidnightUtc, tz);

    // Base: rules matching this weekday
    let dayIntervals: Interval[] = [];
    for (const r of rules) {
      if (r.dayOfWeek !== weekday) continue;
      const s = zonedDateTimeToUtc(dc.year, dc.month, dc.day, Math.floor(r.startMinute / 60), r.startMinute % 60, tz);
      const e = zonedDateTimeToUtc(dc.year, dc.month, dc.day, Math.floor(r.endMinute / 60), r.endMinute % 60, tz);
      dayIntervals.push({ startMs: s.getTime(), endMs: e.getTime() });
    }

    // EXTRA exceptions add, BLOCKED exceptions remove
    const dayKey = `${dc.year}-${dc.month}-${dc.day}`;
    const dayExs = excByDay.get(dayKey) ?? [];
    for (const ex of dayExs) {
      if (ex.kind === 'EXTRA') {
        const s = zonedDateTimeToUtc(dc.year, dc.month, dc.day, Math.floor(ex.startMinute / 60), ex.startMinute % 60, tz);
        const e = zonedDateTimeToUtc(dc.year, dc.month, dc.day, Math.floor(ex.endMinute / 60), ex.endMinute % 60, tz);
        dayIntervals.push({ startMs: s.getTime(), endMs: e.getTime() });
      }
    }
    dayIntervals = unionIntervals(dayIntervals);
    const blocked: Interval[] = [];
    for (const ex of dayExs) {
      if (ex.kind === 'BLOCKED') {
        const s = zonedDateTimeToUtc(dc.year, dc.month, dc.day, Math.floor(ex.startMinute / 60), ex.startMinute % 60, tz);
        const e = zonedDateTimeToUtc(dc.year, dc.month, dc.day, Math.floor(ex.endMinute / 60), ex.endMinute % 60, tz);
        blocked.push({ startMs: s.getTime(), endMs: e.getTime() });
      }
    }
    dayIntervals = subtractMany(dayIntervals, blocked);

    for (const i of dayIntervals) allFreeIntervals.push(i);
  }

  // Subtract booked sessions
  const bookedIntervals: Interval[] = bookedSessions.map((b) => {
    const s = b.scheduledAt instanceof Date ? b.scheduledAt : new Date(b.scheduledAt);
    return { startMs: s.getTime(), endMs: s.getTime() + b.durationMinutes * 60000 };
  });
  let freeIntervals = subtractMany(unionIntervals(allFreeIntervals), bookedIntervals);

  // Clip to window [effectiveFromMs, toUtc]
  freeIntervals = freeIntervals
    .map((i) => ({ startMs: Math.max(i.startMs, effectiveFromMs), endMs: Math.min(i.endMs, toUtc.getTime()) }))
    .filter((i) => i.endMs - i.startMs >= durationMinutes * 60000);

  // Slice into discrete slots aligned on slotStepMinutes (in mentor TZ)
  const slots: Slot[] = [];
  const stepMs = slotStepMinutes * 60000;
  const durMs = durationMinutes * 60000;
  for (const intv of freeIntervals) {
    // Align start to step boundary in mentor TZ
    const startTzParts = (() => {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      const parts = dtf.formatToParts(new Date(intv.startMs));
      const m: Record<string, string> = {};
      for (const p of parts) if (p.type !== 'literal') m[p.type] = p.value;
      return {
        year: Number(m.year),
        month: Number(m.month),
        day: Number(m.day),
        hour: Number(m.hour) === 24 ? 0 : Number(m.hour),
        minute: Number(m.minute),
      };
    })();
    const remainder = startTzParts.minute % slotStepMinutes;
    let cursorMs = intv.startMs;
    if (remainder !== 0) {
      const aligned = zonedDateTimeToUtc(
        startTzParts.year,
        startTzParts.month,
        startTzParts.day,
        startTzParts.hour,
        startTzParts.minute - remainder + slotStepMinutes,
        tz,
      );
      cursorMs = aligned.getTime();
    }
    while (cursorMs + durMs <= intv.endMs) {
      slots.push({ startUtc: new Date(cursorMs), endUtc: new Date(cursorMs + durMs) });
      cursorMs += stepMs;
    }
  }

  // Drop slots earlier than effectiveFrom (already enforced by clip, but be safe)
  return slots.filter((s) => s.startUtc.getTime() >= effectiveFromMs).sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
}
