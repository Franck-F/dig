import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { adminAccessDecision } from '../admin-access.ts';
import { acceptRefusal, hasCapacity, sendRefusal } from '../request-rules.ts';
import { isHttpUrl } from '../safe-url.ts';
import { MENTORA_ERROR_CODES } from '../errors.ts';

// ── M6: admin actions need the role AND a fresh 2FA step-up ─────────────

test('admin avec cookie 2FA frais : accès', () => {
  assert.equal(adminAccessDecision({ role: 'ADMIN', hasFresh2fa: true }), 'ok');
});

test('admin sans cookie 2FA frais : refus twoFactorRequired', () => {
  assert.equal(adminAccessDecision({ role: 'ADMIN', hasFresh2fa: false }), 'twoFactorRequired');
});

for (const role of ['STUDENT', 'MENTOR', 'PARTNER'] as const) {
  test(`${role} : refus forbidden, même avec un cookie 2FA`, () => {
    assert.equal(adminAccessDecision({ role, hasFresh2fa: true }), 'forbidden');
  });
}

test("aucune action Mentora ne teste le rôle ADMIN elle-même (tout passe par requireAdmin)", () => {
  const dir = new URL('../../actions/mentora/', import.meta.url);
  const offenders = readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && f !== '_helpers.ts')
    .filter((f) => /role\s*!==?\s*'ADMIN'|role\s*===?\s*'ADMIN'/.test(readFileSync(new URL(f, dir), 'utf8')));
  assert.deepEqual(offenders, []);
});

// ── M3: send guards ─────────────────────────────────────────────────────

test('auto-demande refusée', () => {
  assert.equal(sendRefusal({ mentorUserId: 'u1', menteeUserId: 'u1', openMentorshipStatus: null }), 'selfRequest');
});

for (const status of ['ACTIVE', 'PAUSED'] as const) {
  test(`demande refusée si un mentorat ${status} existe déjà`, () => {
    assert.equal(
      sendRefusal({ mentorUserId: 'u1', menteeUserId: 'u2', openMentorshipStatus: status }),
      'alreadyMentored',
    );
  });
}

for (const status of [null, 'COMPLETED', 'TERMINATED'] as const) {
  test(`demande acceptée quand le mentorat précédent est ${status ?? 'absent'}`, () => {
    assert.equal(sendRefusal({ mentorUserId: 'u1', menteeUserId: 'u2', openMentorshipStatus: status }), null);
  });
}

// ── M2 / M1: accept guards ──────────────────────────────────────────────

const now = new Date('2026-07-01T12:00:00Z');

test('demande expirée (expiresAt passé) : non acceptable même avant le cron', () => {
  assert.equal(
    acceptRefusal({ expiresAt: new Date('2026-07-01T11:59:59Z'), now, mentorStatus: 'ACTIVE', openMentorshipStatus: null }),
    'requestExpired',
  );
});

test('mentor suspendu : refus', () => {
  assert.equal(
    acceptRefusal({ expiresAt: new Date('2026-07-10T00:00:00Z'), now, mentorStatus: 'SUSPENDED', openMentorshipStatus: null }),
    'mentorSuspended',
  );
});

test('mentor en pause ou non validé : refus', () => {
  for (const s of ['PAUSED', 'DRAFT', 'PENDING_REVIEW'] as const) {
    assert.equal(
      acceptRefusal({ expiresAt: new Date('2026-07-10T00:00:00Z'), now, mentorStatus: s, openMentorshipStatus: null }),
      'mentorNotAccepting',
    );
  }
});

test('mentorat déjà ouvert pour ce couple : refus à l’acceptation', () => {
  assert.equal(
    acceptRefusal({ expiresAt: new Date('2026-07-10T00:00:00Z'), now, mentorStatus: 'ACTIVE', openMentorshipStatus: 'PAUSED' }),
    'alreadyMentored',
  );
});

test('demande valide : acceptable', () => {
  assert.equal(
    acceptRefusal({ expiresAt: new Date('2026-07-10T00:00:00Z'), now, mentorStatus: 'ACTIVE', openMentorshipStatus: 'COMPLETED' }),
    null,
  );
});

test('capacité : places restantes', () => {
  assert.equal(hasCapacity(2, 3), true);
  assert.equal(hasCapacity(3, 3), false);
});

// ── M14: URLs ───────────────────────────────────────────────────────────

test('seules les URLs http(s) passent', () => {
  assert.equal(isHttpUrl('https://www.linkedin.com/in/alice'), true);
  assert.equal(isHttpUrl('http://example.org/x'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('JavaScript:alert(1)'), false);
  assert.equal(isHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isHttpUrl('ftp://example.org'), false);
  assert.equal(isHttpUrl('not a url'), false);
});

test('les nouveaux codes de refus existent dans le catalogue', () => {
  for (const code of ['selfRequest', 'alreadyMentored', 'requestExpired', 'twoFactorRequired']) {
    assert.ok((MENTORA_ERROR_CODES as readonly string[]).includes(code), code);
  }
});
