'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * Read-only fetch helper consumed by `/mentora/become-a-mentor` so it can
 * decide whether to render the wizard, the "in review" notice, or redirect
 * an active mentor to their dashboard.
 *
 * `'use server'` means imports of this module from Client Components only
 * pull in an RPC stub — `prisma` stays on the server.
 */
export async function getMentorProfileForCurrentUser() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  return prisma.mentorProfile.findUnique({
    where: { userId },
    include: { skills: { include: { skill: true } } },
  });
}

/**
 * Read-only fetch helper consumed by `/mentora/onboarding` so it can pre-fill
 * the wizard from any existing MenteeProfile. Shape matches the
 * `OnboardingPrefill` type expected by the client wizard.
 */
export async function getMenteeProfileForCurrentUser() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  const row = await prisma.menteeProfile.findUnique({
    where: { userId },
    include: { goalSkills: { include: { skill: true } } },
  });
  if (!row) return null;
  return {
    goals: row.goals,
    level: row.level,
    preferredFormat: row.preferredFormat,
    languages: row.languages,
    timezone: row.timezone,
    location: row.location,
    currentChallenges: row.currentChallenges,
    discoveredVia: row.discoveredVia,
    goalSkillSlugs: row.goalSkills.map((g) => g.skill.slug),
    // Surface the photo so re-opening the wizard pre-fills the avatar
    // tile instead of starting blank.
    photoUrl: row.photoUrl,
  };
}
