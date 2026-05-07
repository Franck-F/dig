// Run: `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeekTag, isoWeekLabel } from '../iso-week.ts';

test('weeklyDigest.isoWeekTag: 2026-01-01 is W01', () => {
  // 2026-01-01 is a Thursday; ISO 8601 says the week containing the
  // first Thursday is week 1 of the year.
  const d = new Date(Date.UTC(2026, 0, 1, 12));
  assert.equal(isoWeekTag(d), '2026-W01');
});

test('weeklyDigest.isoWeekTag: 2025-12-31 belongs to 2026-W01', () => {
  // 2025-12-31 is a Wednesday → falls in the week of 2026-01-01.
  const d = new Date(Date.UTC(2025, 11, 31, 12));
  assert.equal(isoWeekTag(d), '2026-W01');
});

test('weeklyDigest.isoWeekTag: 2026-05-04 (Monday) is W19', () => {
  const d = new Date(Date.UTC(2026, 4, 4, 8));
  assert.equal(isoWeekTag(d), '2026-W19');
});

test('weeklyDigest.isoWeekTag: zero-pads weeks 1-9', () => {
  // Pick a date in week 5.
  const d = new Date(Date.UTC(2026, 0, 26, 12));
  const tag = isoWeekTag(d);
  assert.match(tag, /^2026-W0[1-9]$/);
});

test('weeklyDigest.isoWeekLabel: returns French range', () => {
  const monday = new Date(Date.UTC(2026, 4, 4, 8));
  const label = isoWeekLabel(monday);
  // Expected: "du 4 mai au 10 mai" (or with month name in French).
  assert.match(label, /^du \d+ \w+ au \d+ \w+$/);
});

test('weeklyDigest.isoWeekLabel: any day of the week returns the same range', () => {
  // Three different days in the same ISO week should produce the same
  // label (Monday → Sunday range).
  const monday = new Date(Date.UTC(2026, 4, 4, 0));
  const wednesday = new Date(Date.UTC(2026, 4, 6, 0));
  const sunday = new Date(Date.UTC(2026, 4, 10, 23));
  assert.equal(isoWeekLabel(monday), isoWeekLabel(wednesday));
  assert.equal(isoWeekLabel(monday), isoWeekLabel(sunday));
});
