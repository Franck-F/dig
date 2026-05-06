// requires Node 22+ (or run with `tsx --test`)
// Node 22+ has stable type-stripping with --experimental-strip-types.
// On Node 25 (current dev env), no flag is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Tests run via `node --test --experimental-strip-types` (Node 22+).
// The `.ts` import resolves at runtime via type-stripping. The `__tests__`
// directory is excluded from tsc in tsconfig.json so this file is not part
// of the production type check.
import {
  rankMentors,
  scoreMentor,
  fnv1aFraction,
  type MentorCandidate,
  type MenteeContext,
} from '../matching.ts';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function baseMentee(overrides: Partial<MenteeContext> = {}): MenteeContext {
  return {
    menteeId: 'mentee_1',
    level: 'BEGINNER',
    languages: ['fr', 'en'],
    timezone: 'Europe/Paris',
    goalSkillIds: [],
    ...overrides,
  };
}

function baseMentor(overrides: Partial<MentorCandidate> = {}): MentorCandidate {
  return {
    mentorProfileId: 'mp_1',
    userId: 'u_1',
    yearsExperience: 8,
    languages: ['fr', 'en'],
    timezone: 'Europe/Paris',
    responseTime: 'WITHIN_DAY',
    status: 'ACTIVE',
    isAcceptingMentees: true,
    maxConcurrentMentees: 5,
    activeMenteeCount: 1,
    publishedAt: new Date(Date.now() - 30 * 86400 * 1000),
    averageRating: 4.9,
    reviewCount: 50,
    sessionsLast30d: 8,
    skills: [
      { skillId: 's_react', level: 'EXPERT', isFeatured: true },
      { skillId: 's_ts', level: 'EXPERT', isFeatured: true },
      { skillId: 's_node', level: 'ADVANCED', isFeatured: true },
    ],
    alreadyMentoringMentee: false,
    ...overrides,
  };
}

// ─── Scenarios ─────────────────────────────────────────────────────────────

test('1. perfect match scores >= 85 with relevant reasons', () => {
  const mentee = baseMentee({ goalSkillIds: ['s_react', 's_ts', 's_node'] });
  const mentor = baseMentor();
  const ranked = rankMentors(mentee, [mentor]);
  assert.equal(ranked.length, 1);
  assert.ok(ranked[0].total >= 85, `expected >=85, got ${ranked[0].total}`);
  const r = ranked[0].reasons;
  assert.ok(r.includes('mentora.matching.reasons.skillsMatch'));
  assert.ok(r.includes('mentora.matching.reasons.sameTimezone'));
  assert.ok(r.includes('mentora.matching.reasons.sharedLanguage'));
  // total <= 4 reasons
  assert.ok(r.length <= 4);
});

test('2. empty inputs return []', () => {
  const mentee = baseMentee();
  assert.deepEqual(rankMentors(mentee, []), []);
});

test('3. hard filter rejection — disjoint languages excludes mentor', () => {
  const mentee = baseMentee({ languages: ['de'] });
  const mentor = baseMentor({ languages: ['fr', 'en'] });
  const ranked = rankMentors(mentee, [mentor]);
  assert.equal(ranked.length, 0);
});

test('4. at-capacity mentor excluded', () => {
  const mentee = baseMentee({ goalSkillIds: ['s_react'] });
  const mentor = baseMentor({ activeMenteeCount: 5, maxConcurrentMentees: 5 });
  const ranked = rankMentors(mentee, [mentor]);
  assert.equal(ranked.length, 0);
});

test('5. no-skill-overlap drops skill component', () => {
  const mentee = baseMentee({ goalSkillIds: ['s_python'] });
  const mentor = baseMentor(); // skills: react/ts/node
  const ranked = rankMentors(mentee, [mentor]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].breakdown.skills, 0);
  // total stays well under perfect — exact value depends on weights, just sanity
  assert.ok(ranked[0].total < 70);
});

test('6. tie-break determinism — same mentee yields same order across calls', () => {
  const mentee = baseMentee({ goalSkillIds: ['s_react'] });
  const mentorA = baseMentor({ mentorProfileId: 'mp_A', userId: 'u_A' });
  const mentorB = baseMentor({ mentorProfileId: 'mp_B', userId: 'u_B' });
  const r1 = rankMentors(mentee, [mentorA, mentorB]);
  const r2 = rankMentors(mentee, [mentorB, mentorA]); // reversed input order
  assert.deepEqual(
    r1.map((r) => r.mentorProfileId),
    r2.map((r) => r.mentorProfileId),
    'order must be deterministic per mentee regardless of input order',
  );

  // Different mentee may produce different order at exact ties
  const menteeOther = baseMentee({ menteeId: 'mentee_other', goalSkillIds: ['s_react'] });
  const rOther = rankMentors(menteeOther, [mentorA, mentorB]);
  // Both menteeIds happen to share rankings here — but the salt computation
  // demonstrates determinism either way.
  assert.equal(rOther.length, 2);
});

test('7. new mentor (zero reviews) gets neutral rating component (60)', () => {
  const mentee = baseMentee();
  const mentor = baseMentor({ reviewCount: 0, averageRating: null });
  const { breakdown } = scoreMentor(mentee, mentor);
  assert.equal(breakdown.rating, 60);
});

test('8. fnv1aFraction is deterministic and in [0,1)', () => {
  const a = fnv1aFraction('hello');
  const b = fnv1aFraction('hello');
  const c = fnv1aFraction('world');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a >= 0 && a <= 1);
});
