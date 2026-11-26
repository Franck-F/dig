import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getAvailableSlots,
  tzOffsetMinutes,
  utcWeekdayInTz,
  zonedDateTimeToUtc,
  type GetAvailableSlotsArgs,
} from '../scheduling.ts';

const PARIS = 'Europe/Paris';
const iso = (s: { startUtc: Date }) => s.startUtc.toISOString();
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

// Mondays used below: 2026-06-01 (summer), 2026-01-05 (winter).
function slots(over: Partial<GetAvailableSlotsArgs>) {
  return getAvailableSlots({
    mentorTimezone: PARIS,
    rules: [],
    exceptions: [],
    bookedSessions: [],
    fromUtc: new Date('2026-06-01T00:00:00Z'),
    toUtc: new Date('2026-06-02T00:00:00Z'),
    durationMinutes: 60,
    slotStepMinutes: 30,
    minNoticeHours: 1,
    nowUtc: new Date('2026-05-01T00:00:00Z'),
    ...over,
  });
}

// ── Time zone math ──────────────────────────────────────────────────────

test('décalage de Paris : +60 en hiver, +120 en été', () => {
  assert.equal(tzOffsetMinutes(new Date('2026-01-15T12:00:00Z'), PARIS), 60);
  assert.equal(tzOffsetMinutes(new Date('2026-07-15T12:00:00Z'), PARIS), 120);
});

test('heure murale de Paris convertie en UTC (été)', () => {
  assert.equal(zonedDateTimeToUtc(2026, 7, 1, 14, 0, PARIS).toISOString(), '2026-07-01T12:00:00.000Z');
});

test('jour de semaine calculé dans le fuseau, pas en UTC', () => {
  // Monday 08:00 in Auckland is still Sunday in UTC.
  const d = zonedDateTimeToUtc(2026, 6, 1, 8, 0, 'Pacific/Auckland');
  assert.equal(d.getUTCDay(), 0);
  assert.equal(utcWeekdayInTz(d, 'Pacific/Auckland'), 1);
});

// ── Weekly rules ────────────────────────────────────────────────────────

test('règle hebdomadaire : créneaux alignés sur le pas', () => {
  const out = slots({ rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 11 * 60 }] });
  assert.deepEqual(out.map(iso), [
    '2026-06-01T07:00:00.000Z',
    '2026-06-01T07:30:00.000Z',
    '2026-06-01T08:00:00.000Z',
  ]);
});

test("une règle d'un autre jour ne produit rien", () => {
  assert.deepEqual(slots({ rules: [{ dayOfWeek: 2, startMinute: 540, endMinute: 660 }] }), []);
});

test('règle dans le fuseau du mentor (Auckland) : le créneau tombe un dimanche UTC', () => {
  const out = getAvailableSlots({
    mentorTimezone: 'Pacific/Auckland',
    rules: [{ dayOfWeek: 1, startMinute: 8 * 60, endMinute: 9 * 60 }],
    exceptions: [],
    bookedSessions: [],
    fromUtc: new Date('2026-05-30T00:00:00Z'),
    toUtc: new Date('2026-06-02T00:00:00Z'),
    durationMinutes: 60,
    slotStepMinutes: 60,
    nowUtc: new Date('2026-05-01T00:00:00Z'),
  });
  // Monday 1 June 08:00 NZST (+12) = Sunday 31 May 20:00 UTC.
  assert.deepEqual(out.map(iso), ['2026-05-31T20:00:00.000Z']);
});

// ── DST ─────────────────────────────────────────────────────────────────

test('passage à l’heure d’été (29 mars 2026) : 01:00-04:00 ne dure que 2 h', () => {
  const out = slots({
    rules: [{ dayOfWeek: 0, startMinute: 60, endMinute: 4 * 60 }],
    fromUtc: new Date('2026-03-28T12:00:00Z'),
    toUtc: new Date('2026-03-30T00:00:00Z'),
    slotStepMinutes: 60,
    nowUtc: new Date('2026-03-01T00:00:00Z'),
  });
  // 01:00 CET = 00:00Z ; 03:00 CEST = 01:00Z ; 02:00 local does not exist.
  assert.deepEqual(out.map(iso), ['2026-03-29T00:00:00.000Z', '2026-03-29T01:00:00.000Z']);
});

test('passage à l’heure d’hiver (25 octobre 2026) : 01:00-04:00 dure 4 h', () => {
  const out = slots({
    rules: [{ dayOfWeek: 0, startMinute: 60, endMinute: 4 * 60 }],
    fromUtc: new Date('2026-10-24T12:00:00Z'),
    toUtc: new Date('2026-10-26T00:00:00Z'),
    slotStepMinutes: 60,
    nowUtc: new Date('2026-10-01T00:00:00Z'),
  });
  // 01:00 CEST = 23:00Z (24 Oct) ; 04:00 CET = 03:00Z.
  assert.deepEqual(out.map(iso), [
    '2026-10-24T23:00:00.000Z',
    '2026-10-25T00:00:00.000Z',
    '2026-10-25T01:00:00.000Z',
    '2026-10-25T02:00:00.000Z',
  ]);
});

test('la même règle garde son heure murale de part et d’autre du changement d’heure', () => {
  const rule = [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 10 * 60 }];
  const winter = slots({
    rules: rule,
    fromUtc: new Date('2026-01-05T00:00:00Z'),
    toUtc: new Date('2026-01-06T00:00:00Z'),
    nowUtc: new Date('2026-01-01T00:00:00Z'),
  });
  const summer = slots({ rules: rule });
  assert.deepEqual(winter.map(iso), ['2026-01-05T08:00:00.000Z']); // 09:00 CET
  assert.deepEqual(summer.map(iso), ['2026-06-01T07:00:00.000Z']); // 09:00 CEST
});

// ── Exceptions ──────────────────────────────────────────────────────────

test('exception EXTRA : ouvre un créneau un jour sans règle', () => {
  const out = slots({
    exceptions: [{ date: day('2026-06-01'), startMinute: 14 * 60, endMinute: 15 * 60, kind: 'EXTRA' }],
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T12:00:00.000Z']);
});

test('exception BLOCKED : retire une partie de la règle', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    exceptions: [{ date: day('2026-06-01'), startMinute: 10 * 60, endMinute: 11 * 60, kind: 'BLOCKED' }],
    slotStepMinutes: 60,
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T07:00:00.000Z', '2026-06-01T09:00:00.000Z']);
});

test('exception BLOCKED sur toute la journée : aucun créneau', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    exceptions: [{ date: day('2026-06-01'), startMinute: 0, endMinute: 1440, kind: 'BLOCKED' }],
  });
  assert.deepEqual(out, []);
});

test("une exception d'un autre jour n'a pas d'effet", () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 10 * 60 }],
    exceptions: [{ date: day('2026-06-02'), startMinute: 0, endMinute: 1440, kind: 'BLOCKED' }],
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T07:00:00.000Z']);
});

// ── Booked sessions, adjacency, midnight ────────────────────────────────

test('une séance réservée retire les créneaux qui la chevauchent, pas les adjacents', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    bookedSessions: [{ scheduledAt: new Date('2026-06-01T08:00:00Z'), durationMinutes: 60 }], // 10:00-11:00 local
    slotStepMinutes: 60,
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T07:00:00.000Z', '2026-06-01T09:00:00.000Z']);
});

test('après une séance qui finit hors pas, le créneau suivant est réaligné sur le pas', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 11 * 60 }],
    bookedSessions: [{ scheduledAt: new Date('2026-06-01T07:00:00Z'), durationMinutes: 25 }], // until 09:25 local
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T07:30:00.000Z', '2026-06-01T08:00:00.000Z']);
});

test('deux règles adjacentes forment une seule plage', () => {
  const out = slots({
    rules: [
      { dayOfWeek: 1, startMinute: 9 * 60, endMinute: 10 * 60 },
      { dayOfWeek: 1, startMinute: 10 * 60, endMinute: 11 * 60 },
    ],
    durationMinutes: 90,
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T07:00:00.000Z', '2026-06-01T07:30:00.000Z']);
});

test('une règle qui finit à minuit (1440) produit un créneau qui finit à minuit', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 23 * 60, endMinute: 1440 }],
    toUtc: new Date('2026-06-02T12:00:00Z'),
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T21:00:00.000Z']);
  assert.equal(out[0].endUtc.toISOString(), '2026-06-01T22:00:00.000Z');
});

test('deux plages qui se touchent à minuit permettent un créneau à cheval', () => {
  const out = slots({
    rules: [
      { dayOfWeek: 1, startMinute: 23 * 60, endMinute: 1440 },
      { dayOfWeek: 2, startMinute: 0, endMinute: 60 },
    ],
    toUtc: new Date('2026-06-02T12:00:00Z'),
  });
  assert.deepEqual(out.map(iso), [
    '2026-06-01T21:00:00.000Z',
    '2026-06-01T21:30:00.000Z', // 23:30-00:30 local, across midnight
    '2026-06-01T22:00:00.000Z',
  ]);
});

// ── Window, notice and argument guards ──────────────────────────────────

test('le préavis minimal exclut les créneaux trop proches', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    slotStepMinutes: 60,
    nowUtc: new Date('2026-06-01T06:30:00Z'), // 08:30 local, notice 1 h → from 09:30
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T08:00:00.000Z', '2026-06-01T09:00:00.000Z']);
});

test('la fin de fenêtre coupe les créneaux', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 12 * 60 }],
    slotStepMinutes: 60,
    toUtc: new Date('2026-06-01T09:00:00Z'),
  });
  assert.deepEqual(out.map(iso), ['2026-06-01T07:00:00.000Z', '2026-06-01T08:00:00.000Z']);
});

test('fenêtre de 56 jours acceptée, 57 jours refusée', () => {
  const from = new Date('2026-06-01T00:00:00Z');
  assert.doesNotThrow(() => slots({ fromUtc: from, toUtc: new Date(from.getTime() + 56 * 86400000) }));
  assert.throws(() => slots({ fromUtc: from, toUtc: new Date(from.getTime() + 57 * 86400000) }), /invalidWindow/);
});

test('fenêtre vide ou inversée refusée', () => {
  const at = new Date('2026-06-01T00:00:00Z');
  assert.throws(() => slots({ fromUtc: at, toUtc: at }), /invalidWindow/);
});

test('durée hors bornes (15 à 240 min) refusée', () => {
  assert.throws(() => slots({ durationMinutes: 10 }), /invalidWindow/);
  assert.throws(() => slots({ durationMinutes: 241 }), /invalidWindow/);
});

test('fenêtre entièrement dans le préavis : aucun créneau', () => {
  const out = slots({
    rules: [{ dayOfWeek: 1, startMinute: 0, endMinute: 1440 }],
    nowUtc: new Date('2026-06-02T00:00:00Z'),
  });
  assert.deepEqual(out, []);
});
