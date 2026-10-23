import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENTORA_LEGACY_REDIRECTS } from '../legacy-redirects.ts';
import { MENTORA_REMOVED_ROUTES } from '../nav.ts';

test('every removed route has exactly one redirect', () => {
  for (const route of MENTORA_REMOVED_ROUTES) {
    const matches = MENTORA_LEGACY_REDIRECTS.filter((r) => r.source === route);
    assert.equal(matches.length, 1, `missing or duplicated redirect for ${route}`);
  }
  assert.equal(MENTORA_LEGACY_REDIRECTS.length, MENTORA_REMOVED_ROUTES.length);
});

test('no redirect lands on another removed route', () => {
  for (const r of MENTORA_LEGACY_REDIRECTS) {
    const path = r.destination.split('#')[0];
    assert.ok(!MENTORA_REMOVED_ROUTES.includes(path), `${r.source} → ${r.destination}`);
  }
});

test('redirects are permanent', () => {
  for (const r of MENTORA_LEGACY_REDIRECTS) assert.equal(r.permanent, true);
});

test('sources are exact paths so /profile does not swallow /profile/edit', () => {
  for (const r of MENTORA_LEGACY_REDIRECTS) {
    assert.ok(!/[:*(]/.test(r.source), `wildcard in ${r.source}`);
  }
});

test('retired pages land on their merged destination', () => {
  const map = Object.fromEntries(MENTORA_LEGACY_REDIRECTS.map((r) => [r.source, r.destination]));
  assert.deepEqual(map, {
    '/mentora/dashboard/agenda': '/mentora/dashboard/sessions',
    '/mentora/dashboard/feedbacks': '/mentora/dashboard',
    '/mentora/dashboard/activity': '/mentora/dashboard/notifications',
    '/mentora/dashboard/goals': '/mentora/dashboard/mentorships',
    '/mentora/dashboard/availability': '/mentora/dashboard/profile/edit#disponibilites',
    '/mentora/dashboard/profile': '/mentora/dashboard/profile/edit',
  });
});
