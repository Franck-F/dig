import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROLES_PROMOTED_ON_MENTOR_APPROVAL, roleAfterMentorApproval } from '../roles.ts';

test("l'approbation d'un mentor promeut un STUDENT en MENTOR", () => {
  assert.equal(roleAfterMentorApproval('STUDENT'), 'MENTOR');
});

for (const role of ['ADMIN', 'PARTNER', 'MENTOR'] as const) {
  test(`l'approbation d'un mentor laisse le rôle ${role} intact`, () => {
    assert.equal(roleAfterMentorApproval(role), role);
  });
}

test('seul STUDENT figure dans les rôles promus', () => {
  assert.deepEqual([...ROLES_PROMOTED_ON_MENTOR_APPROVAL], ['STUDENT']);
});
