import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { actAs, createMentee, createMentor, createMentorship, prisma, resetData, slotInDays } from '@/test-setup/db';
import * as sessions from '@/lib/actions/mentora/sessions';
import { GET as cronGET } from '@/app/api/cron/sessions-reminder/route';

beforeEach(resetData);

const book = (mentorshipId: string, at: Date) =>
  sessions.scheduleSession({ mentorshipId, scheduledAtIso: at.toISOString(), durationMinutes: 60 });

const errorOf = (r: { status: string; error?: string }) => (r.status === 'error' ? r.error : null);

async function pair(opts: { mentorshipStatus?: 'ACTIVE' | 'PAUSED'; mentorStatus?: 'ACTIVE' | 'SUSPENDED' } = {}) {
  const mentor = await createMentor({ status: opts.mentorStatus });
  const mentee = await createMentee();
  const mentorship = await createMentorship(mentor.profile.id, mentee.profile.id, opts.mentorshipStatus ?? 'ACTIVE');
  return { mentor, mentee, mentorship };
}

test('B9 : deux réservations simultanées du même créneau, une seule réussit', async () => {
  const { mentee, mentorship } = await pair();
  actAs(mentee.user.id);
  const at = slotInDays(3);
  const results = await Promise.all([book(mentorship.id, at), book(mentorship.id, at)]);
  assert.deepEqual(results.map((r) => r.status).sort(), ['error', 'success']);
  assert.equal(errorOf(results.find((r) => r.status === 'error')!), 'mentora.errors.slotTaken');
  assert.equal(await prisma.session.count(), 1);
});

test('B9 : un mentorat en pause ne peut pas réserver', async () => {
  const { mentee, mentorship } = await pair({ mentorshipStatus: 'PAUSED' });
  actAs(mentee.user.id);
  assert.equal(errorOf(await book(mentorship.id, slotInDays(3))), 'mentora.errors.invalidStatus');
});

test("B9 : l'agenda du mentee est vérifié d'un mentorat à l'autre", async () => {
  const mentee = await createMentee();
  const a = await createMentor();
  const b = await createMentor();
  const ma = await createMentorship(a.profile.id, mentee.profile.id);
  const mb = await createMentorship(b.profile.id, mentee.profile.id);
  actAs(mentee.user.id);
  const at = slotInDays(4);
  assert.equal((await book(ma.id, at)).status, 'success');
  assert.equal(errorOf(await book(mb.id, at)), 'mentora.errors.sessionConflict');
});

test('B10 : pas de réservation avec un mentor suspendu', async () => {
  const { mentee, mentorship } = await pair({ mentorStatus: 'SUSPENDED' });
  actAs(mentee.user.id);
  assert.equal(errorOf(await book(mentorship.id, slotInDays(3))), 'mentora.errors.mentorSuspended');
});

test('M14 : un lien de visio javascript: est refusé', async () => {
  const { mentor, mentorship } = await pair();
  actAs(mentor.user.id);
  const res = await sessions.scheduleSession({
    mentorshipId: mentorship.id,
    scheduledAtIso: slotInDays(3).toISOString(),
    durationMinutes: 60,
    meetingUrl: 'javascript:alert(1)',
  });
  assert.equal(errorOf(res), 'mentora.errors.invalidInput');
});

test('B7 : la clôture par le mentor invite le mentee à laisser un avis', async () => {
  const { mentor, mentee, mentorship } = await pair();
  const s = await prisma.session.create({
    data: { mentorshipId: mentorship.id, scheduledAt: new Date(Date.now() - 2 * 3600_000), durationMinutes: 60, status: 'SCHEDULED' },
  });
  actAs(mentor.user.id);
  assert.equal((await sessions.completeSession({ sessionId: s.id })).status, 'success');
  const notifs = await prisma.notification.findMany({ where: { userId: mentee.user.id }, select: { type: true } });
  assert.deepEqual(notifs.map((n) => n.type), ['SESSION_COMPLETED']);
});

test('B8 : le cron clôt les séances finies depuis plus de 48 h, pas les autres', async () => {
  const { mentee, mentorship } = await pair();
  const old = await prisma.session.create({
    data: { mentorshipId: mentorship.id, scheduledAt: new Date(Date.now() - 72 * 3600_000), durationMinutes: 60, status: 'SCHEDULED' },
  });
  const recent = await prisma.session.create({
    data: { mentorshipId: mentorship.id, scheduledAt: new Date(Date.now() - 24 * 3600_000), durationMinutes: 60, status: 'SCHEDULED' },
  });
  const res = await cronGET(
    new Request('http://localhost/api/cron/sessions-reminder', { headers: { authorization: 'Bearer integration-cron-secret' } }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).autoCompleted, { completed: 1, failed: 0 });
  const byId = Object.fromEntries(
    (await prisma.session.findMany({ select: { id: true, status: true } })).map((s) => [s.id, s.status]),
  );
  assert.deepEqual(byId, { [old.id]: 'COMPLETED', [recent.id]: 'SCHEDULED' });
  assert.equal(await prisma.notification.count({ where: { userId: mentee.user.id, type: 'SESSION_COMPLETED' } }), 1);
});

test('le cron refuse un appel sans le secret', async () => {
  const res = await cronGET(new Request('http://localhost/api/cron/sessions-reminder'));
  assert.equal(res.status, 401);
});

// ── Known bugs not fixed yet (phase 2d) ────────────────────────────────

test(
  "une séance future ne peut pas être marquée terminée",
  { todo: 'phase 2d : machine à états des séances (COMPLETED après le début)' },
  async () => {
    const { mentor, mentorship } = await pair();
    const s = await prisma.session.create({
      data: { mentorshipId: mentorship.id, scheduledAt: slotInDays(5), durationMinutes: 60, status: 'SCHEDULED' },
    });
    actAs(mentor.user.id);
    assert.equal(errorOf(await sessions.completeSession({ sessionId: s.id })), 'mentora.errors.invalidStatus');
  },
);

test(
  'une séance commencée ne peut plus être annulée',
  { todo: 'phase 2d : annulation avant le début seulement' },
  async () => {
    const { mentee, mentorship } = await pair();
    const s = await prisma.session.create({
      data: { mentorshipId: mentorship.id, scheduledAt: new Date(Date.now() - 10 * 60_000), durationMinutes: 60, status: 'SCHEDULED' },
    });
    actAs(mentee.user.id);
    assert.equal(
      errorOf(await sessions.cancelSession({ sessionId: s.id, reason: 'Trop tard pour annuler' })),
      'mentora.errors.invalidStatus',
    );
  },
);

test(
  "l'absence d'un participant (NO_SHOW) peut être enregistrée",
  { todo: 'phase 2d : NO_SHOW jamais écrit (B8)' },
  () => {
    assert.equal(typeof (sessions as Record<string, unknown>).markSessionNoShow, 'function');
  },
);
