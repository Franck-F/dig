/**
 * Integration-test helpers (run under `npm run test:integration`, whose
 * preload has already guarded DATABASE_URL_TEST and pointed Prisma at it).
 *
 * - `prisma`: the app's own client, so actions and tests share one pool.
 * - `actAs()`: the session returned by the `@/auth` double.
 * - `resetData()`: empties every table of the test DB between tests,
 *   after re-checking that the connected database is a `_test` one.
 * - factories for the Mentora aggregates.
 */
// Must stay the first import: refuses to load outside the integration run.
import './db-guard';
import { prisma } from '@/lib/prisma';

export { prisma };

type TestState = { __testUserId?: string | null; __testFresh2fa?: boolean };

export function actAs(userId: string | null, opts: { fresh2fa?: boolean } = {}): void {
  const g = globalThis as TestState;
  g.__testUserId = userId;
  g.__testFresh2fa = opts.fresh2fa ?? false;
}

export async function resetData(): Promise<void> {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (!db.endsWith('_test')) throw new Error(`resetData refused: connected to "${db}", not a _test database`);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  actAs(null);
}

let seq = 0;
const next = () => `${Date.now().toString(36)}${(++seq).toString(36)}`;

export async function createUser(over: { firstName?: string; role?: 'STUDENT' | 'MENTOR' | 'PARTNER' | 'ADMIN' } = {}) {
  const n = next();
  return prisma.user.create({
    data: {
      email: `user-${n}@test.local`,
      firstName: over.firstName ?? `User${n}`,
      lastName: 'Test',
      role: over.role ?? 'STUDENT',
    },
  });
}

export async function createSkill() {
  const n = next();
  return prisma.skill.create({ data: { name: `Skill ${n}`, slug: `skill-${n}`, category: 'TECHNICAL' } });
}

/** ACTIVE mentor accepting mentees, available every day, all day, in Europe/Paris. */
export async function createMentor(
  over: { maxConcurrentMentees?: number; status?: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' | 'DRAFT' | 'PENDING_REVIEW'; userId?: string } = {},
) {
  const user = over.userId ? await prisma.user.findUniqueOrThrow({ where: { id: over.userId } }) : await createUser({ role: 'MENTOR' });
  const profile = await prisma.mentorProfile.create({
    data: {
      userId: user.id,
      headline: 'Mentor de test',
      bio: 'Bio',
      yearsExperience: 5,
      timezone: 'Europe/Paris',
      status: over.status ?? 'ACTIVE',
      isAcceptingMentees: true,
      maxConcurrentMentees: over.maxConcurrentMentees ?? 3,
    },
  });
  await prisma.availabilityRule.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      mentorProfileId: profile.id,
      dayOfWeek,
      startMinute: 0,
      endMinute: 1440,
      timezone: 'Europe/Paris',
    })),
  });
  return { user, profile };
}

export async function createMentee(over: { userId?: string } = {}) {
  const user = over.userId ? await prisma.user.findUniqueOrThrow({ where: { id: over.userId } }) : await createUser();
  const profile = await prisma.menteeProfile.create({
    data: { userId: user.id, goals: 'Progresser', timezone: 'Europe/Paris' },
  });
  return { user, profile };
}

export async function createMentorship(
  mentorProfileId: string,
  menteeProfileId: string,
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED' = 'ACTIVE',
) {
  return prisma.mentorship.create({ data: { mentorProfileId, menteeProfileId, status } });
}

/** A UTC instant `days` ahead, on a 15-minute boundary at 10:00 UTC. */
export function slotInDays(days: number, hourUtc = 10): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d;
}
