import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isUniqueViolation, runRequestExpiry, type DueRequest } from '../request-expiry.ts';

const due = (id: string): DueRequest => ({ id, menteeUserId: `mentee-${id}`, mentorUserId: `mentor-${id}` });

test('isUniqueViolation reconnaît P2002', () => {
  assert.equal(isUniqueViolation({ code: 'P2002' }), true);
  assert.equal(isUniqueViolation({ code: 'P2025' }), false);
  assert.equal(isUniqueViolation(new Error('boom')), false);
  assert.equal(isUniqueViolation(null), false);
});

test("une ligne en échec n'annule pas le reste du lot", async () => {
  const notified: string[] = [];
  const res = await runRequestExpiry([due('a'), due('b'), due('c')], {
    markExpired: async (id) => {
      if (id === 'b') throw Object.assign(new Error('unique'), { code: 'P2002' });
      return true;
    },
    notify: async (userId) => {
      notified.push(userId);
    },
  });
  assert.equal(res.expired, 2);
  assert.equal(res.failed, 1);
  assert.deepEqual(notified, ['mentee-a', 'mentor-a', 'mentee-c', 'mentor-c']);
});

test("une demande déjà traitée entre-temps n'est ni comptée ni notifiée", async () => {
  const notified: string[] = [];
  const res = await runRequestExpiry([due('a')], {
    markExpired: async () => false,
    notify: async (userId) => {
      notified.push(userId);
    },
  });
  assert.equal(res.expired, 0);
  assert.deepEqual(notified, []);
});
