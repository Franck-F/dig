import { test } from 'node:test';
import assert from 'node:assert/strict';

import { canViewerSeeMenteeProfile } from '../mentee-access.ts';

test('ADMIN voit toujours, même sans lien', () => {
  assert.equal(
    canViewerSeeMenteeProfile({ viewerRole: 'ADMIN', hasMentorship: false, hasActiveRequest: false }),
    true,
  );
});

test('MENTOR avec mentorship voit', () => {
  assert.equal(
    canViewerSeeMenteeProfile({ viewerRole: 'MENTOR', hasMentorship: true, hasActiveRequest: false }),
    true,
  );
});

test('MENTOR avec requête active voit', () => {
  assert.equal(
    canViewerSeeMenteeProfile({ viewerRole: 'MENTOR', hasMentorship: false, hasActiveRequest: true }),
    true,
  );
});

test('MENTOR sans lien ne voit pas', () => {
  assert.equal(
    canViewerSeeMenteeProfile({ viewerRole: 'MENTOR', hasMentorship: false, hasActiveRequest: false }),
    false,
  );
});

test('rôle autre (ni ADMIN ni MENTOR) ne voit jamais', () => {
  assert.equal(
    canViewerSeeMenteeProfile({ viewerRole: 'MENTEE', hasMentorship: true, hasActiveRequest: true }),
    false,
  );
});
