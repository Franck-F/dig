import { test } from 'node:test';
import assert from 'node:assert/strict';

import { retentionCutoffs, daysAgo, yearsAgo, RETENTION } from '../retention-policy.ts';

const NOW = new Date('2026-06-23T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

test('daysAgo / yearsAgo soustraient la bonne durée', () => {
  assert.equal(daysAgo(NOW, 90).getTime(), NOW.getTime() - 90 * DAY);
  assert.equal(yearsAgo(NOW, 3).getTime(), NOW.getTime() - 3 * 365 * DAY);
});

test('retentionCutoffs applique les durées du registre', () => {
  const c = retentionCutoffs(NOW);
  assert.equal(c.readNotifications.getTime(), NOW.getTime() - 90 * DAY);
  assert.equal(c.unreadNotifications.getTime(), NOW.getTime() - 365 * DAY);
  assert.equal(c.contactMessages.getTime(), NOW.getTime() - 365 * DAY);
  assert.equal(c.inactiveAccounts.getTime(), NOW.getTime() - 3 * 365 * DAY);
  assert.equal(c.moderationActions.getTime(), NOW.getTime() - 3 * 365 * DAY);
  assert.equal(c.auditLogs.getTime(), NOW.getTime() - 5 * 365 * DAY);
  assert.equal(c.mentorshipContent.getTime(), NOW.getTime() - 3 * 365 * DAY);
});

test('les durées correspondent au registre des traitements', () => {
  assert.equal(RETENTION.readNotificationDays, 90);
  assert.equal(RETENTION.unreadNotificationDays, 365);
  assert.equal(RETENTION.contactMessageDays, 365);
  assert.equal(RETENTION.inactiveAccountYears, 3);
  assert.equal(RETENTION.moderationYears, 3);
  assert.equal(RETENTION.auditLogYears, 5);
  assert.equal(RETENTION.mentorshipContentYears, 3);
});
