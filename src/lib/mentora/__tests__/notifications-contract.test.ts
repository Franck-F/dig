import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EMAIL_ENABLED,
  buildEmailVars,
  renderNotificationEmail,
  type EmailNotificationType,
  type EmailPayloads,
} from '../notification-emails.ts';

type Messages = Record<string, unknown>;

function loadMessages(locale: 'fr' | 'en'): Messages {
  return JSON.parse(readFileSync(new URL(`../../../../messages/${locale}.json`, import.meta.url), 'utf8'));
}

const MESSAGES = { fr: loadMessages('fr'), en: loadMessages('en') };

// One representative payload per emailed type, shaped like what the
// server actions and the cron actually pass to notify().
const SAMPLE_PAYLOADS: { [K in EmailNotificationType]: EmailPayloads[K] } = {
  REQUEST_RECEIVED: { requestId: 'r1', counterpartUserId: 'u2', message: 'Bonjour, je voudrais progresser en data.' },
  REQUEST_ACCEPTED: { requestId: 'r1', mentorshipId: 'm1', counterpartUserId: 'u2' },
  REQUEST_DECLINED: { requestId: 'r1', counterpartUserId: 'u2', reason: 'Plus de place ce trimestre' },
  SESSION_SCHEDULED: {
    sessionId: 's1',
    mentorshipId: 'm1',
    counterpartUserId: 'u2',
    scheduledAt: '2026-07-01T12:00:00.000Z',
    durationMinutes: 45,
  },
  SESSION_REMINDER: {
    sessionId: 's1',
    mentorshipId: 'm1',
    counterpartUserId: 'u2',
    scheduledAt: '2026-07-01T12:00:00.000Z',
    meetingUrl: 'https://meet.jit.si/digizelle-s1',
  },
  SESSION_CANCELLED: {
    sessionId: 's1',
    mentorshipId: 'm1',
    counterpartUserId: 'u2',
    scheduledAt: '2026-07-01T12:00:00.000Z',
    reason: 'Empêchement de dernière minute',
  },
  MENTOR_APPROVED: { mentorProfileId: 'mp1' },
};

const CTX = {
  recipientName: 'Alice',
  counterpartName: 'Bob Martin',
  timeZone: 'Europe/Paris',
  appUrl: 'https://digizelle.fr',
};

for (const type of EMAIL_ENABLED) {
  for (const locale of ['fr', 'en'] as const) {
    test(`${type} (${locale}) : sujet et corps rendus sans clé de repli ni JSON`, () => {
      const vars = buildEmailVars(type, SAMPLE_PAYLOADS[type] as never, { ...CTX, locale });
      const { subject, body } = renderNotificationEmail(type, MESSAGES[locale], vars);

      assert.ok(subject.length > 0);
      assert.ok(body.length > 0);
      assert.doesNotMatch(subject + body, /[{}]/, 'placeholder ou JSON non résolu');
      assert.ok(!subject.includes(type), 'sujet de repli avec le type brut');
      assert.ok(!body.includes('mentora.'), 'clé i18n brute dans le corps');
      assert.match(body, /Alice/, 'nom du destinataire absent');
      assert.match(body, /https:\/\/digizelle\.fr\/mentora\//, 'lien absent');
    });
  }
}

test('une clé de template absente fait échouer le rendu', () => {
  const vars = buildEmailVars('MENTOR_APPROVED', SAMPLE_PAYLOADS.MENTOR_APPROVED, { ...CTX, locale: 'fr' });
  assert.throws(() =>
    renderNotificationEmail('MENTOR_APPROVED', { mentora: { notifications: { emails: {} } } }, vars),
  );
});

test('une variable absente fait échouer le rendu', () => {
  assert.throws(() => renderNotificationEmail('REQUEST_DECLINED', MESSAGES.fr, { recipientName: 'Alice' }));
});

test("l'heure de séance est formatée dans le fuseau du destinataire", () => {
  const paris = buildEmailVars('SESSION_SCHEDULED', SAMPLE_PAYLOADS.SESSION_SCHEDULED, {
    ...CTX,
    locale: 'fr',
    timeZone: 'Europe/Paris',
  });
  const london = buildEmailVars('SESSION_SCHEDULED', SAMPLE_PAYLOADS.SESSION_SCHEDULED, {
    ...CTX,
    locale: 'fr',
    timeZone: 'Europe/London',
  });
  assert.match(paris.date, /14:00/);
  assert.match(london.date, /13:00/);
});

test('sans lien de visio, le rappel renvoie vers la page de séance', () => {
  const vars = buildEmailVars(
    'SESSION_REMINDER',
    { ...SAMPLE_PAYLOADS.SESSION_REMINDER, meetingUrl: null },
    { ...CTX, locale: 'fr' },
  );
  assert.equal(vars.meetingUrl, 'https://digizelle.fr/mentora/dashboard/sessions/s1');
});
