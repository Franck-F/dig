import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_TIME_ZONE, dayBucket, fmtDate, fmtDateTime, fmtTime, viewerTimeZone } from '../format.ts';

const SUMMER_NOON_UTC = '2026-07-01T12:00:00.000Z';
const WINTER_NOON_UTC = '2026-01-15T12:00:00.000Z';

test("un instant UTC d'été s'affiche à l'heure de Paris et de Londres", () => {
  assert.match(fmtTime(SUMMER_NOON_UTC, { timeZone: 'Europe/Paris' }), /14:00/);
  assert.match(fmtTime(SUMMER_NOON_UTC, { timeZone: 'Europe/London' }), /13:00/);
});

test("un instant UTC d'hiver s'affiche à l'heure de Paris et de Londres", () => {
  assert.match(fmtTime(WINTER_NOON_UTC, { timeZone: 'Europe/Paris' }), /13:00/);
  assert.match(fmtTime(WINTER_NOON_UTC, { timeZone: 'Europe/London' }), /12:00/);
});

test('sans fuseau explicite, le défaut est Europe/Paris (jamais le fuseau du serveur)', () => {
  assert.equal(DEFAULT_TIME_ZONE, 'Europe/Paris');
  assert.match(fmtDateTime(SUMMER_NOON_UTC), /14:00/);
});

test('la date suit le fuseau : 22:30 UTC en été est déjà le lendemain à Paris', () => {
  const late = '2026-07-01T22:30:00.000Z'; // 00:30 on 2 July in Paris, 23:30 on 1 July in London
  assert.match(fmtDate(late, { timeZone: 'Europe/Paris' }), /02/);
  assert.match(fmtDate(late, { timeZone: 'Europe/London' }), /01/);
});

test('la locale active est respectée', () => {
  assert.match(fmtDate(SUMMER_NOON_UTC, { locale: 'en' }), /Jul/);
  assert.match(fmtDate(SUMMER_NOON_UTC, { locale: 'fr' }), /juil/);
});

test('dayBucket regroupe selon le jour du viewer', () => {
  const sent = '2026-07-01T22:30:00.000Z'; // 00:30 on 2 July in Paris, 23:30 on 1 July in London
  const now = new Date('2026-07-02T08:00:00.000Z');
  assert.equal(dayBucket(sent, { timeZone: 'Europe/Paris', now }), 'today');
  assert.equal(dayBucket(sent, { timeZone: 'Europe/London', now }), 'yesterday');
  assert.equal(dayBucket('2026-06-29T10:00:00.000Z', { timeZone: 'Europe/Paris', now }), 'earlier');
});

test('fuseau du viewer : profil mentor, sinon mentee, sinon Paris', () => {
  assert.equal(viewerTimeZone({ mentorTimeZone: 'America/Montreal', menteeTimeZone: 'Europe/London' }), 'America/Montreal');
  assert.equal(viewerTimeZone({ mentorTimeZone: null, menteeTimeZone: 'Europe/London' }), 'Europe/London');
  assert.equal(viewerTimeZone({ mentorTimeZone: null, menteeTimeZone: null }), 'Europe/Paris');
});

test('valeur absente : tiret', () => {
  assert.equal(fmtDateTime(null), '—');
});
