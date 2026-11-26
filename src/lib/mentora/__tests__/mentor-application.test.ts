import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isMentorApplicationComplete,
  isValidSlot,
  mentorApplicationState,
  resolveProfileKind,
} from '../mentor-application.ts';

const complete = { headline: 'Data engineer', bio: 'Bio', skillCount: 3, slotCount: 1 };

test('une candidature complète est prête pour la revue', () => {
  assert.equal(isMentorApplicationComplete(complete), true);
});

test('moins de 3 compétences : candidature incomplète', () => {
  assert.equal(isMentorApplicationComplete({ ...complete, skillCount: 2 }), false);
});

test('aucun créneau : candidature incomplète', () => {
  assert.equal(isMentorApplicationComplete({ ...complete, slotCount: 0 }), false);
});

test('bio vide ou titre vide : candidature incomplète', () => {
  assert.equal(isMentorApplicationComplete({ ...complete, bio: '   ' }), false);
  assert.equal(isMentorApplicationComplete({ ...complete, headline: '' }), false);
});

test('un créneau doit finir après son début', () => {
  assert.equal(isValidSlot({ startMinute: 540, endMinute: 600 }), true);
  assert.equal(isValidSlot({ startMinute: 600, endMinute: 600 }), false);
  assert.equal(isValidSlot({ startMinute: 600, endMinute: 540 }), false);
});

test('état de candidature : en revue', () => {
  assert.equal(mentorApplicationState({ status: 'PENDING_REVIEW', reviewNote: null }), 'inReview');
});

test('état de candidature : refusée avec motif', () => {
  assert.equal(mentorApplicationState({ status: 'DRAFT', reviewNote: 'Bio trop courte' }), 'rejected');
});

test('état de candidature : brouillon', () => {
  assert.equal(mentorApplicationState({ status: 'DRAFT', reviewNote: null }), 'draft');
});

test("un mentor validé n'a plus d'état de candidature", () => {
  assert.equal(mentorApplicationState({ status: 'ACTIVE', reviewNote: 'ancienne note' }), null);
  assert.equal(mentorApplicationState({ status: 'SUSPENDED', reviewNote: null }), null);
});

test('un mentor validé est vu comme mentor quel que soit son rôle', () => {
  assert.equal(resolveProfileKind({ mentorStatus: 'ACTIVE', hasMenteeProfile: false }), 'mentor');
  assert.equal(resolveProfileKind({ mentorStatus: 'ACTIVE', hasMenteeProfile: true }), 'mentor');
});

test('un candidat sans profil mentee voit son espace mentor (statut)', () => {
  assert.equal(resolveProfileKind({ mentorStatus: 'PENDING_REVIEW', hasMenteeProfile: false }), 'mentor');
  assert.equal(resolveProfileKind({ mentorStatus: 'DRAFT', hasMenteeProfile: false }), 'mentor');
});

test('un mentee qui candidate garde son espace mentee', () => {
  assert.equal(resolveProfileKind({ mentorStatus: 'PENDING_REVIEW', hasMenteeProfile: true }), 'mentee');
});

test('sans aucun profil : none', () => {
  assert.equal(resolveProfileKind({ mentorStatus: null, hasMenteeProfile: false }), 'none');
  assert.equal(resolveProfileKind({ mentorStatus: null, hasMenteeProfile: true }), 'mentee');
});
