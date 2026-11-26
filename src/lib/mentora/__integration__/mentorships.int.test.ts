import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { actAs, createMentee, createMentor, createMentorship, prisma, resetData, slotInDays } from '@/test-setup/db';
import * as mentorships from '@/lib/actions/mentora/mentorships';
import { sendMessage } from '@/lib/actions/mentora/messages';

beforeEach(resetData);

async function pair() {
  const mentor = await createMentor();
  const mentee = await createMentee();
  const mentorship = await createMentorship(mentor.profile.id, mentee.profile.id);
  return { mentor, mentee, mentorship };
}

const errorOf = (r: { status: string; error?: string }) => (r.status === 'error' ? r.error : null);

test('le mentor clôt le mentorat', async () => {
  const { mentor, mentorship } = await pair();
  actAs(mentor.user.id);
  const res = await mentorships.completeMentorship({ mentorshipId: mentorship.id, closingNote: 'Objectifs atteints' });
  assert.equal(res.status, 'success');
  const m = await prisma.mentorship.findUniqueOrThrow({ where: { id: mentorship.id } });
  assert.equal(m.status, 'COMPLETED');
  assert.ok(m.endedAt);
});

test('le mentee ne peut pas clore à la place du mentor', async () => {
  const { mentee, mentorship } = await pair();
  actAs(mentee.user.id);
  assert.equal(errorOf(await mentorships.completeMentorship({ mentorshipId: mentorship.id })), 'mentora.errors.forbidden');
});

test('un tiers ne peut ni mettre en pause ni écrire', async () => {
  const { mentorship } = await pair();
  const outsider = await createMentee();
  actAs(outsider.user.id);
  assert.equal(errorOf(await mentorships.pauseMentorship({ mentorshipId: mentorship.id })), 'mentora.errors.forbidden');
  assert.equal(errorOf(await sendMessage({ mentorshipId: mentorship.id, body: 'Bonjour' })), 'mentora.errors.forbidden');
});

test('pause puis reprise par le mentee', async () => {
  const { mentee, mentorship } = await pair();
  actAs(mentee.user.id);
  assert.equal((await mentorships.pauseMentorship({ mentorshipId: mentorship.id })).status, 'success');
  assert.equal((await prisma.mentorship.findUniqueOrThrow({ where: { id: mentorship.id } })).status, 'PAUSED');
  assert.equal((await mentorships.resumeMentorship({ mentorshipId: mentorship.id })).status, 'success');
  assert.equal((await prisma.mentorship.findUniqueOrThrow({ where: { id: mentorship.id } })).status, 'ACTIVE');
});

test('B10 : la messagerie est en lecture seule quand le mentor est suspendu', async () => {
  const { mentor, mentee, mentorship } = await pair();
  await prisma.mentorProfile.update({ where: { id: mentor.profile.id }, data: { status: 'SUSPENDED' } });
  actAs(mentee.user.id);
  assert.equal(errorOf(await sendMessage({ mentorshipId: mentorship.id, body: 'Bonjour' })), 'mentora.errors.mentorSuspended');
});

// ── Known bugs not fixed yet (phase 2c, 2e, 2g) ────────────────────────

test(
  'la messagerie est en lecture seule après la clôture (COMPLETED)',
  { todo: 'phase 2g : lecture seule hors mentorat actif (seul TERMINATED bloque aujourd’hui)' },
  async () => {
    const { mentor, mentee, mentorship } = await pair();
    actAs(mentor.user.id);
    await mentorships.completeMentorship({ mentorshipId: mentorship.id });
    actAs(mentee.user.id);
    assert.equal(errorOf(await sendMessage({ mentorshipId: mentorship.id, body: 'Merci !' })), 'mentora.errors.cannotMessageTerminated');
  },
);

test(
  "la mise en pause prévient l'autre participant",
  { todo: 'phase 2e : notifications de cycle de vie (M8)' },
  async () => {
    const { mentor, mentee, mentorship } = await pair();
    actAs(mentee.user.id);
    await mentorships.pauseMentorship({ mentorshipId: mentorship.id });
    assert.equal(await prisma.notification.count({ where: { userId: mentor.user.id } }), 1);
  },
);

test(
  'la clôture annule les séances à venir',
  { todo: 'phase 2c : effets de la clôture' },
  async () => {
    const { mentor, mentorship } = await pair();
    await prisma.session.create({
      data: { mentorshipId: mentorship.id, scheduledAt: slotInDays(5), durationMinutes: 60, status: 'SCHEDULED' },
    });
    actAs(mentor.user.id);
    await mentorships.completeMentorship({ mentorshipId: mentorship.id });
    assert.equal(await prisma.session.count({ where: { status: 'SCHEDULED' } }), 0);
  },
);

test(
  'le mentee peut mettre fin au mentorat (TERMINATED)',
  { todo: 'phase 2c : TERMINATED jamais écrit (B8)' },
  () => {
    assert.equal(typeof (mentorships as Record<string, unknown>).terminateMentorship, 'function');
  },
);
