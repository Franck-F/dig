import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMentoraNav,
  MENTORA_REMOVED_ROUTES,
  mentoraNavLabels,
  type MentoraNavKind,
  type MentoraNavLabels,
} from '../nav.ts';

const labels: MentoraNavLabels = {
  home: 'Accueil',
  discover: 'Trouver un mentor',
  mentors: 'Mes mentors',
  mentees: 'Mes mentorées',
  sessions: 'Sessions',
  messages: 'Messages',
  resources: 'Ressources',
  settings: 'Paramètres',
  becomeMentee: 'Devenir mentorée',
  becomeMentor: 'Devenir mentor',
};

const ALL_CASES: { kind: MentoraNavKind; isAdmin: boolean }[] = [
  { kind: 'mentor', isAdmin: false },
  { kind: 'mentor', isAdmin: true },
  { kind: 'mentee', isAdmin: false },
  { kind: 'mentee', isAdmin: true },
  { kind: 'none', isAdmin: false },
  { kind: 'none', isAdmin: true },
];

test('mentee nav lists the 7 Entourage-style entries in order', () => {
  const items = buildMentoraNav('mentee', { isAdmin: false, labels });
  assert.deepEqual(
    items.map((i) => i.href),
    [
      '/mentora/dashboard',
      '/mentora/discover',
      '/mentora/dashboard/mentorships',
      '/mentora/dashboard/sessions',
      '/mentora/dashboard/messages',
      '/mentora/dashboard/resources',
      '/account/settings',
    ],
  );
});

test('mentor nav lists 6 entries and no discover link', () => {
  const items = buildMentoraNav('mentor', { isAdmin: false, labels });
  assert.deepEqual(
    items.map((i) => i.href),
    [
      '/mentora/dashboard',
      '/mentora/dashboard/mentorships',
      '/mentora/dashboard/sessions',
      '/mentora/dashboard/messages',
      '/mentora/dashboard/resources',
      '/account/settings',
    ],
  );
  assert.equal(items.find((i) => i.href === '/mentora/dashboard/mentorships')?.label, 'Mes mentorées');
});

test('no nav ever links to a removed route', () => {
  for (const c of ALL_CASES) {
    const items = buildMentoraNav(c.kind, { isAdmin: c.isAdmin, labels });
    for (const item of items) {
      assert.ok(
        !MENTORA_REMOVED_ROUTES.includes(item.href),
        `${c.kind}/${c.isAdmin} links to removed ${item.href}`,
      );
    }
  }
});

test('no nav carries notifications or availability entries', () => {
  for (const c of ALL_CASES) {
    const hrefs = buildMentoraNav(c.kind, { isAdmin: c.isAdmin, labels }).map((i) => i.href);
    assert.ok(!hrefs.includes('/mentora/dashboard/notifications'));
    assert.ok(!hrefs.includes('/mentora/dashboard/availability'));
  }
});

test('non-admin user without a role profile sees no mentorship-only routes', () => {
  const hrefs = buildMentoraNav('none', { isAdmin: false, labels }).map((i) => i.href);
  assert.deepEqual(hrefs, [
    '/mentora/dashboard',
    '/mentora/discover',
    '/mentora/onboarding',
    '/mentora/become-a-mentor',
    '/account/settings',
  ]);
});

test('admin without a role profile gets the pilotage shortcuts', () => {
  const hrefs = buildMentoraNav('none', { isAdmin: true, labels }).map((i) => i.href);
  assert.equal(hrefs[0], '/mentora/admin');
  assert.equal(hrefs.at(-1), '/account/settings');
});

test('every nav stays at 8 entries or fewer', () => {
  for (const c of ALL_CASES) {
    assert.ok(buildMentoraNav(c.kind, { isAdmin: c.isAdmin, labels }).length <= 8);
  }
});

test('mentoraNavLabels reads the app.shell nav keys', () => {
  const seen: string[] = [];
  const result = mentoraNavLabels((key) => {
    seen.push(key);
    return `T(${key})`;
  });
  assert.equal(result.home, 'T(nav.mentora.home)');
  assert.equal(result.settings, 'T(nav.community.settings)');
  assert.equal(result.becomeMentor, 'T(nav.mentora.becomeMentor)');
  assert.equal(seen.length, 10);
});

test('removed routes list covers the six retired dashboard pages', () => {
  assert.deepEqual([...MENTORA_REMOVED_ROUTES].sort(), [
    '/mentora/dashboard/activity',
    '/mentora/dashboard/agenda',
    '/mentora/dashboard/availability',
    '/mentora/dashboard/feedbacks',
    '/mentora/dashboard/goals',
    '/mentora/dashboard/profile',
  ]);
});
