import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canReactivateMentor, mentorCanAct } from '../mentor-moderation.ts';
import { MENTORA_ERROR_CODES } from '../errors.ts';

test('seul un mentor SUSPENDED peut être réactivé', () => {
  assert.equal(canReactivateMentor('SUSPENDED'), true);
});

for (const status of ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED'] as const) {
  test(`un mentor ${status} ne peut pas être "réactivé" (contournement de la validation)`, () => {
    assert.equal(canReactivateMentor(status), false);
  });
}

test('un mentor SUSPENDED ne peut ni accepter, ni écrire, ni réserver', () => {
  assert.equal(mentorCanAct('SUSPENDED'), false);
});

for (const status of ['ACTIVE', 'PAUSED'] as const) {
  test(`un mentor ${status} garde ses mentorats en cours`, () => {
    assert.equal(mentorCanAct(status), true);
  });
}

test('le code mentorSuspended existe dans le catalogue', () => {
  assert.ok((MENTORA_ERROR_CODES as readonly string[]).includes('mentorSuspended'));
});
