import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMentorBadges, isMentorAvailable } from '../badges.ts';

const fresh = {
  responseTime: 'WITHIN_WEEK' as const,
  completedSessions: 0,
  activeMentorships: 0,
  matchScore: null,
};

test('a brand-new mentor earns no badge', () => {
  assert.deepEqual(computeMentorBadges(fresh), []);
});

test('answering within a day earns the reactive badge', () => {
  assert.deepEqual(computeMentorBadges({ ...fresh, responseTime: 'WITHIN_DAY' }), ['reactive']);
  assert.deepEqual(computeMentorBadges({ ...fresh, responseTime: 'WITHIN_HOUR' }), ['reactive']);
  assert.deepEqual(computeMentorBadges({ ...fresh, responseTime: 'WITHIN_MONTH' }), []);
});

test('five completed sessions or two active mentorships earn the engaged badge', () => {
  assert.ok(computeMentorBadges({ ...fresh, completedSessions: 5 }).includes('engaged'));
  assert.ok(computeMentorBadges({ ...fresh, activeMentorships: 2 }).includes('engaged'));
  assert.ok(!computeMentorBadges({ ...fresh, completedSessions: 4, activeMentorships: 1 }).includes('engaged'));
});

test('complementary needs a match score of at least 70', () => {
  assert.ok(!computeMentorBadges({ ...fresh, matchScore: 69.9 }).includes('complementary'));
  assert.ok(computeMentorBadges({ ...fresh, matchScore: 70 }).includes('complementary'));
  assert.ok(!computeMentorBadges({ ...fresh, matchScore: undefined }).includes('complementary'));
});

test('badges come out in a stable order: engaged, reactive, complementary', () => {
  assert.deepEqual(
    computeMentorBadges({
      responseTime: 'WITHIN_HOUR',
      completedSessions: 12,
      activeMentorships: 3,
      matchScore: 88,
    }),
    ['engaged', 'reactive', 'complementary'],
  );
});

test('a mentor at capacity is not available', () => {
  assert.equal(
    isMentorAvailable({ isAcceptingMentees: true, activeMentorships: 5, maxConcurrentMentees: 5 }),
    false,
  );
  assert.equal(
    isMentorAvailable({ isAcceptingMentees: true, activeMentorships: 4, maxConcurrentMentees: 5 }),
    true,
  );
});

test('a mentor who paused new requests is not available', () => {
  assert.equal(
    isMentorAvailable({ isAcceptingMentees: false, activeMentorships: 0, maxConcurrentMentees: 5 }),
    false,
  );
});
