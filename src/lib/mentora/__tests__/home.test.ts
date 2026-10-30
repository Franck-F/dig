import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  goFurtherTiles,
  menteeCompletion,
  mentorCompletion,
  pickLatestThreads,
  sentRequestsSummary,
  truncatePreview,
} from '../home.ts';

test('without community access no tile links into /community (it bounces to /app)', () => {
  for (const role of ['mentee', 'mentor'] as const) {
    for (const tile of goFurtherTiles(role, false)) {
      assert.ok(!tile.href?.startsWith('/community'), `${role} tile ${tile.key} → ${tile.href}`);
    }
  }
});

test('without community access each role is offered a join-community action', () => {
  for (const role of ['mentee', 'mentor'] as const) {
    const tiles = goFurtherTiles(role, false);
    assert.equal(tiles.length, 3);
    assert.ok(tiles.some((t) => t.action === 'joinCommunity' && t.href === undefined));
  }
});

test('members of the community keep the community shortcuts', () => {
  assert.deepEqual(
    goFurtherTiles('mentee', true).map((t) => t.href),
    ['/community/events', '/mentora/discover', '/community/charte'],
  );
  assert.deepEqual(
    goFurtherTiles('mentor', true).map((t) => t.href),
    ['/community/events', '/community', '/community/charte'],
  );
});

test('sent requests summary only appears when the mentee has pending requests', () => {
  assert.equal(sentRequestsSummary(0), null);
  assert.equal(sentRequestsSummary(-1), null);
  assert.deepEqual(sentRequestsSummary(2), { count: 2, href: '/mentora/dashboard/requests?tab=sent' });
});

test('pickLatestThreads keeps the newest message per mentorship, newest first', () => {
  const rows = [
    { id: 'm5', mentorshipId: 'a' },
    { id: 'm4', mentorshipId: 'a' },
    { id: 'm3', mentorshipId: 'b' },
    { id: 'm2', mentorshipId: 'c' },
    { id: 'm1', mentorshipId: 'd' },
  ];
  assert.deepEqual(pickLatestThreads(rows, 3).map((r) => r.id), ['m5', 'm3', 'm2']);
});

test('pickLatestThreads with no messages returns an empty list', () => {
  assert.deepEqual(pickLatestThreads([], 3), []);
});

test('truncatePreview collapses whitespace and caps at 90 characters with an ellipsis', () => {
  assert.equal(truncatePreview('  Bonjour\n\nça   va ?  '), 'Bonjour ça va ?');
  const long = truncatePreview('x'.repeat(200));
  assert.equal(long.length, 90);
  assert.ok(long.endsWith('…'));
});

test('mentee completion counts the five profile signals', () => {
  assert.equal(
    menteeCompletion({ goals: '', languages: [], timezone: '', goalSkillsCount: 0, location: null, currentChallenges: null }),
    0,
  );
  assert.equal(
    menteeCompletion({
      goals: 'Devenir développeuse front-end en un an',
      languages: ['fr'],
      timezone: 'Europe/Paris',
      goalSkillsCount: 2,
      location: 'Lyon',
      currentChallenges: null,
    }),
    100,
  );
});

test('mentor completion counts six profile signals and rounds', () => {
  assert.equal(
    mentorCompletion({ headline: '', bio: '', photoUrl: null, linkedinUrl: null, languages: [], skillsCount: 0 }),
    0,
  );
  assert.equal(
    mentorCompletion({
      headline: 'Lead dev',
      bio: 'x'.repeat(120),
      photoUrl: null,
      linkedinUrl: null,
      languages: ['fr'],
      skillsCount: 3,
    }),
    67,
  );
});
