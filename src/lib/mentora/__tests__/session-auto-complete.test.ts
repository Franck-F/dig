import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTO_COMPLETE_AFTER_HOURS,
  autoCompleteCandidatesBefore,
  isDueForAutoCompletion,
  runSessionAutoCompletion,
  type DueSession,
} from '../session-auto-complete.ts';

const now = new Date('2026-07-10T12:00:00Z');

test('le délai de clôture automatique est de 48 h après la fin', () => {
  assert.equal(AUTO_COMPLETE_AFTER_HOURS, 48);
});

test('une séance finie depuis plus de 48 h est à clôturer', () => {
  // 08/07 10:00 + 60 min = 11:00, 49 h avant now
  assert.equal(isDueForAutoCompletion({ scheduledAt: new Date('2026-07-08T10:00:00Z'), durationMinutes: 60 }, now), true);
});

test('une séance finie depuis moins de 48 h ne l’est pas encore', () => {
  // 08/07 11:30 + 60 min = 12:30, 47 h 30 avant now
  assert.equal(isDueForAutoCompletion({ scheduledAt: new Date('2026-07-08T11:30:00Z'), durationMinutes: 60 }, now), false);
});

test('la durée compte : une longue séance commencée il y a 49 h n’est pas encore finie depuis 48 h', () => {
  assert.equal(isDueForAutoCompletion({ scheduledAt: new Date('2026-07-08T11:00:00Z'), durationMinutes: 120 }, now), false);
});

test('la requête ne rate aucune séance due, même de durée maximale', () => {
  const before = autoCompleteCandidatesBefore(now);
  assert.equal(before.getTime(), now.getTime() - 48 * 3600_000);
});

const due = (id: string): DueSession => ({ id, menteeUserId: `mentee-${id}`, mentorUserId: `mentor-${id}` });

test('chaque séance clôturée invite le mentee à laisser un avis ; une erreur n’arrête pas le lot', async () => {
  const invited: Array<[string, string, string]> = [];
  const res = await runSessionAutoCompletion([due('a'), due('b'), due('c')], {
    markCompleted: async (id) => {
      if (id === 'b') throw new Error('db down');
      return true;
    },
    inviteReview: async (s) => {
      invited.push([s.id, s.menteeUserId, s.mentorUserId]);
    },
  });
  assert.deepEqual(res, { completed: 2, failed: 1 });
  assert.deepEqual(invited, [
    ['a', 'mentee-a', 'mentor-a'],
    ['c', 'mentee-c', 'mentor-c'],
  ]);
});

test('une séance déjà traitée entre-temps n’est ni comptée ni notifiée', async () => {
  let invited = 0;
  const res = await runSessionAutoCompletion([due('a')], {
    markCompleted: async () => false,
    inviteReview: async () => {
      invited++;
    },
  });
  assert.deepEqual(res, { completed: 0, failed: 0 });
  assert.equal(invited, 0);
});
