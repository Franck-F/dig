import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { actAs, createMentor, createSkill, createUser, prisma, resetData } from '@/test-setup/db';
import {
  adminApproveMentor,
  adminRejectMentor,
  submitMentorApplication,
} from '@/lib/actions/mentora/profile';
import { suspendMentor } from '@/lib/actions/mentora/moderation';
import { nudgePendingMentorshipRequests } from '@/lib/actions/mentora/requests';
import { getCurrentRoleProfile } from '@/lib/mentora/getCurrentRoleProfile';
import { mentorApplicationState } from '@/lib/mentora/mentor-application';

beforeEach(resetData);

const errorOf = (r: { status: string; error?: string }) => (r.status === 'error' ? r.error : null);

async function apply(userId: string, skillCount: number) {
  const skills = await Promise.all(Array.from({ length: skillCount }, () => createSkill()));
  actAs(userId);
  return submitMentorApplication({
    headline: 'Data engineer senior',
    bio: 'Dix ans de data.',
    yearsExperience: 10,
    timezone: 'Europe/Paris',
    languages: ['fr'],
    skillSlugs: skills.map((s) => s.slug),
    skillLevel: 'ADVANCED',
    slots: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 10 * 60 }],
  });
}

const pendingQueue = () =>
  prisma.mentorProfile.findMany({ where: { status: 'PENDING_REVIEW' }, select: { userId: true } });

test('M15 : le wizard complet envoie le candidat dans la file admin', async () => {
  const user = await createUser();
  assert.equal((await apply(user.id, 3)).status, 'success');
  assert.deepEqual((await pendingQueue()).map((p) => p.userId), [user.id]);
});

test('B6 : le candidat voit « en cours d’examen » sur son dashboard', async () => {
  const user = await createUser();
  await apply(user.id, 3);
  const profile = await getCurrentRoleProfile(user.id);
  assert.equal(profile.kind, 'mentor');
  assert.equal(profile.mentorProfile && mentorApplicationState(profile.mentorProfile), 'inReview');
});

test('M15 : moins de 3 compétences, la candidature reste en brouillon', async () => {
  const user = await createUser();
  await apply(user.id, 2);
  assert.deepEqual(await pendingQueue(), []);
  const profile = await getCurrentRoleProfile(user.id);
  assert.equal(profile.mentorProfile && mentorApplicationState(profile.mentorProfile), 'draft');
});

test('B6 : une candidature refusée montre le motif au candidat', async () => {
  const user = await createUser();
  await apply(user.id, 3);
  const admin = await createUser({ role: 'ADMIN' });
  const [{ id }] = await prisma.mentorProfile.findMany({ select: { id: true } });
  actAs(admin.id, { fresh2fa: true });
  assert.equal((await adminRejectMentor({ mentorProfileId: id, reviewNote: 'Bio trop courte' })).status, 'success');
  const profile = await getCurrentRoleProfile(user.id);
  assert.equal(profile.mentorProfile && mentorApplicationState(profile.mentorProfile), 'rejected');
  assert.equal(profile.mentorProfile?.reviewNote, 'Bio trop courte');
});

test('B5 : un ADMIN qui candidate puis est approuvé reste ADMIN', async () => {
  const candidate = await createUser({ role: 'ADMIN' });
  const { profile } = await createMentor({ userId: candidate.id, status: 'PENDING_REVIEW' });
  const approver = await createUser({ role: 'ADMIN' });
  actAs(approver.id, { fresh2fa: true });
  assert.equal((await adminApproveMentor({ mentorProfileId: profile.id })).status, 'success');
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: candidate.id } })).role, 'ADMIN');
  assert.equal((await prisma.mentorProfile.findUniqueOrThrow({ where: { id: profile.id } })).status, 'ACTIVE');
});

test('B5 : un STUDENT approuvé devient MENTOR', async () => {
  const candidate = await createUser();
  const { profile } = await createMentor({ userId: candidate.id, status: 'PENDING_REVIEW' });
  const approver = await createUser({ role: 'ADMIN' });
  actAs(approver.id, { fresh2fa: true });
  await adminApproveMentor({ mentorProfileId: profile.id });
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: candidate.id } })).role, 'MENTOR');
});

test('M6 : sans cookie 2FA frais, les actions admin sont refusées', async () => {
  const candidate = await createUser();
  const { profile } = await createMentor({ userId: candidate.id, status: 'PENDING_REVIEW' });
  const active = await createMentor();
  const admin = await createUser({ role: 'ADMIN' });
  actAs(admin.id, { fresh2fa: false });

  assert.equal(errorOf(await adminApproveMentor({ mentorProfileId: profile.id })), 'mentora.errors.twoFactorRequired');
  assert.deepEqual(await suspendMentor({ id: active.profile.id }), { status: 'error', error: 'two_factor_required' });
  assert.deepEqual(await nudgePendingMentorshipRequests(), { status: 'error', error: 'two_factor_required' });

  assert.equal((await prisma.mentorProfile.findUniqueOrThrow({ where: { id: profile.id } })).status, 'PENDING_REVIEW');
  assert.equal((await prisma.mentorProfile.findUniqueOrThrow({ where: { id: active.profile.id } })).status, 'ACTIVE');
});

test('M6 : un non-admin est refusé, même avec un cookie 2FA', async () => {
  const candidate = await createUser();
  const { profile } = await createMentor({ userId: candidate.id, status: 'PENDING_REVIEW' });
  const user = await createUser({ role: 'MENTOR' });
  actAs(user.id, { fresh2fa: true });
  assert.equal(errorOf(await adminApproveMentor({ mentorProfileId: profile.id })), 'mentora.errors.forbidden');
});

test('B10 : la réactivation ne contourne pas la validation d’une candidature', async () => {
  const { reactivateMentor } = await import('@/lib/actions/mentora/moderation');
  const candidate = await createUser();
  const { profile } = await createMentor({ userId: candidate.id, status: 'PENDING_REVIEW' });
  const admin = await createUser({ role: 'ADMIN' });
  actAs(admin.id, { fresh2fa: true });
  assert.deepEqual(await reactivateMentor({ id: profile.id }), { status: 'error', error: 'not_suspended' });
  assert.equal((await prisma.mentorProfile.findUniqueOrThrow({ where: { id: profile.id } })).status, 'PENDING_REVIEW');
});
