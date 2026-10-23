import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menteeCompletion, mentorCompletion, pickLatestThreads, truncatePreview } from '../home.ts';

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
