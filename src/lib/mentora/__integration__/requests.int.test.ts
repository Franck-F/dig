import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { actAs, createMentee, createMentor, createMentorship, createSkill, createUser, prisma, resetData } from '@/test-setup/db';
import {
  acceptMentorshipRequest,
  declineMentorshipRequest,
  sendMentorshipRequest,
} from '@/lib/actions/mentora/requests';
import { completeMentorship } from '@/lib/actions/mentora/mentorships';
import { suspendMentor } from '@/lib/actions/mentora/moderation';
import { expirePendingRequests } from '@/lib/mentora/expire-requests';

beforeEach(resetData);

async function send(menteeUserId: string, mentorProfileId: string, skillId: string) {
  actAs(menteeUserId);
  return sendMentorshipRequest({
    toMentorId: mentorProfileId,
    message: 'Bonjour, je voudrais progresser en data.',
    topicSkillIds: [skillId],
  });
}

test('B4 : demande, refus, nouvelle demande, second refus au même mentor', async () => {
  const mentor = await createMentor();
  const mentee = await createMentee();
  const skill = await createSkill();

  for (let round = 1; round <= 2; round++) {
    const sent = await send(mentee.user.id, mentor.profile.id, skill.id);
    assert.equal(sent.status, 'success', `envoi ${round}`);
    actAs(mentor.user.id);
    const declined = await declineMentorshipRequest({
      requestId: (sent as { data: { id: string } }).data.id,
      reason: 'Pas de place ce trimestre',
    });
    assert.equal(declined.status, 'success', `refus ${round}`);
  }
  assert.equal(await prisma.mentorshipRequest.count({ where: { status: 'DECLINED' } }), 2);
});

test('deux demandes PENDING au même mentor : la seconde est refusée', async () => {
  const mentor = await createMentor();
  const mentee = await createMentee();
  const skill = await createSkill();
  assert.equal((await send(mentee.user.id, mentor.profile.id, skill.id)).status, 'success');
  const second = await send(mentee.user.id, mentor.profile.id, skill.id);
  assert.deepEqual(second, { status: 'error', error: 'mentora.errors.duplicateRequest', fieldErrors: undefined });
});

test('M1 : deux acceptations simultanées pour une seule place restante, une seule réussit', async () => {
  const mentor = await createMentor({ maxConcurrentMentees: 1 });
  const skill = await createSkill();
  const a = await createMentee();
  const b = await createMentee();
  const ra = await send(a.user.id, mentor.profile.id, skill.id);
  const rb = await send(b.user.id, mentor.profile.id, skill.id);
  actAs(mentor.user.id);
  const results = await Promise.all([
    acceptMentorshipRequest({ requestId: (ra as { data: { id: string } }).data.id }),
    acceptMentorshipRequest({ requestId: (rb as { data: { id: string } }).data.id }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ['error', 'success']);
  assert.equal(await prisma.mentorship.count({ where: { status: 'ACTIVE' } }), 1);
});

test('M2 : une demande dont la date limite est passée ne peut plus être acceptée', async () => {
  const mentor = await createMentor();
  const mentee = await createMentee();
  const skill = await createSkill();
  const sent = await send(mentee.user.id, mentor.profile.id, skill.id);
  const id = (sent as { data: { id: string } }).data.id;
  await prisma.mentorshipRequest.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  actAs(mentor.user.id);
  const res = await acceptMentorshipRequest({ requestId: id });
  assert.equal(res.status === 'error' && res.error, 'mentora.errors.requestExpired');
});

test('M3 : un utilisateur ne peut pas se demander lui-même', async () => {
  const user = await createUser();
  const mentor = await createMentor({ userId: user.id });
  await createMentee({ userId: user.id });
  const skill = await createSkill();
  const res = await send(user.id, mentor.profile.id, skill.id);
  assert.equal(res.status === 'error' && res.error, 'mentora.errors.selfRequest');
});

test('M3 : pas de nouvelle demande pendant un mentorat ACTIVE', async () => {
  const mentor = await createMentor();
  const mentee = await createMentee();
  await createMentorship(mentor.profile.id, mentee.profile.id, 'ACTIVE');
  const skill = await createSkill();
  const res = await send(mentee.user.id, mentor.profile.id, skill.id);
  assert.equal(res.status === 'error' && res.error, 'mentora.errors.alreadyMentored');
});

test("B4 : le cron d'expiration traite tout le lot, même avec un ancien refus pour le même couple", async () => {
  const mentor = await createMentor();
  const mentee = await createMentee();
  const other = await createMentee();
  const past = new Date(Date.now() - 60_000);
  await prisma.mentorshipRequest.createMany({
    data: [
      { fromMenteeId: mentee.profile.id, toMentorId: mentor.profile.id, message: 'x'.repeat(20), status: 'EXPIRED', expiresAt: past },
      { fromMenteeId: mentee.profile.id, toMentorId: mentor.profile.id, message: 'x'.repeat(20), status: 'PENDING', expiresAt: past },
      { fromMenteeId: other.profile.id, toMentorId: mentor.profile.id, message: 'x'.repeat(20), status: 'PENDING', expiresAt: past },
    ],
  });
  const res = await expirePendingRequests();
  assert.deepEqual(res, { expired: 2, failed: 0 });
  assert.equal(await prisma.mentorshipRequest.count({ where: { status: 'PENDING' } }), 0);
});

// ── Known bugs not fixed yet (phase 2) ─────────────────────────────────

test(
  'M4 : une nouvelle acceptation après un mentorat terminé ne duplique pas les objectifs',
  { todo: 'phase 2c : nouveau mentorat au lieu de la réactivation, objectifs sans doublon' },
  async () => {
    const mentor = await createMentor();
    const mentee = await createMentee();
    const skill = await createSkill();
    for (let round = 1; round <= 2; round++) {
      const sent = await send(mentee.user.id, mentor.profile.id, skill.id);
      actAs(mentor.user.id);
      const accepted = await acceptMentorshipRequest({ requestId: (sent as { data: { id: string } }).data.id });
      const mentorshipId = (accepted as { data: { mentorshipId: string } }).data.mentorshipId;
      if (round === 1) await completeMentorship({ mentorshipId });
    }
    const goals = await prisma.mentorshipGoal.findMany({ select: { mentorshipId: true, skillId: true } });
    const perMentorship = new Map<string, number>();
    for (const g of goals) perMentorship.set(g.mentorshipId, (perMentorship.get(g.mentorshipId) ?? 0) + 1);
    assert.ok([...perMentorship.values()].every((n) => n === 1), `objectifs par mentorat : ${[...perMentorship.values()]}`);
  },
);

test(
  'suspension : les demandes PENDING du mentor sont annulées',
  { todo: 'phase 2f : effets de la suspension' },
  async () => {
    const mentor = await createMentor();
    const mentee = await createMentee();
    const skill = await createSkill();
    await send(mentee.user.id, mentor.profile.id, skill.id);
    const admin = await createUser({ role: 'ADMIN' });
    actAs(admin.id, { fresh2fa: true });
    assert.equal((await suspendMentor({ id: mentor.profile.id })).status, 'success');
    assert.equal(await prisma.mentorshipRequest.count({ where: { status: 'PENDING' } }), 0);
  },
);
