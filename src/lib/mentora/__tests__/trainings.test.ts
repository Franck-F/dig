import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAININGS,
  computeTrainingProgress,
  isKnownTrainingSlug,
  trainingsFor,
} from '../trainings.ts';

test('training slugs are unique', () => {
  const slugs = TRAININGS.map((m) => m.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test('mentees and mentors each get their three modules in catalogue order', () => {
  assert.deepEqual(
    trainingsFor('mentee').map((m) => m.slug),
    ['bien-demarrer', 'role-du-mentor', 'bien-communiquer'],
  );
  assert.deepEqual(
    trainingsFor('mentor').map((m) => m.slug),
    ['bien-demarrer', 'posture-mentor', 'premiere-session'],
  );
});

test('only catalogue slugs are accepted', () => {
  assert.equal(isKnownTrainingSlug('../x'), false);
  assert.equal(isKnownTrainingSlug(42), false);
  assert.equal(isKnownTrainingSlug(''), false);
  assert.equal(isKnownTrainingSlug('bien-demarrer'), true);
});

test('progress rounds to a whole percent', () => {
  const p = computeTrainingProgress(trainingsFor('mentee'), ['bien-demarrer']);
  assert.deepEqual(p, { done: 1, total: 3, percent: 33 });
});

test('completions outside the module list are ignored', () => {
  const p = computeTrainingProgress(trainingsFor('mentee'), ['posture-mentor', 'nope', 'bien-demarrer']);
  assert.equal(p.done, 1);
});

test('an empty module list reports zero progress', () => {
  assert.deepEqual(computeTrainingProgress([], ['bien-demarrer']), { done: 0, total: 0, percent: 0 });
});

test('every module has content and a positive duration', () => {
  for (const m of TRAININGS) {
    assert.ok(m.steps.length >= 1, m.slug);
    assert.ok(m.durationMin > 0, m.slug);
    for (const s of m.steps) assert.ok(s.heading.trim() && s.body.trim(), m.slug);
  }
});
