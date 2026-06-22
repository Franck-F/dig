import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canSanction, privilegeLevel } from '../sanction-policy.ts';

const member = { role: 'STUDENT', isSuperAdmin: false, isModerator: false };
const mod = { role: 'STUDENT', isSuperAdmin: false, isModerator: true };
const admin = { role: 'ADMIN', isSuperAdmin: false, isModerator: true };
const superAdmin = { role: 'ADMIN', isSuperAdmin: true, isModerator: true };

test('privilegeLevel: member < mod < admin < super-admin', () => {
  assert.equal(privilegeLevel(member), 0);
  assert.equal(privilegeLevel(mod), 1);
  assert.equal(privilegeLevel(admin), 2);
  assert.equal(privilegeLevel(superAdmin), 3);
});

test('un modérateur ne peut sanctionner que des membres simples', () => {
  assert.equal(canSanction(mod, member), true);
  assert.equal(canSanction(mod, mod), false);
  assert.equal(canSanction(mod, admin), false);
  assert.equal(canSanction(mod, superAdmin), false);
});

test('un admin peut sanctionner membres + modérateurs, pas les (super)admins', () => {
  assert.equal(canSanction(admin, member), true);
  assert.equal(canSanction(admin, mod), true);
  assert.equal(canSanction(admin, admin), false);
  assert.equal(canSanction(admin, superAdmin), false);
});

test('un super-admin peut sanctionner tout le monde sauf un autre super-admin', () => {
  assert.equal(canSanction(superAdmin, member), true);
  assert.equal(canSanction(superAdmin, mod), true);
  assert.equal(canSanction(superAdmin, admin), true);
  assert.equal(canSanction(superAdmin, superAdmin), false);
});
