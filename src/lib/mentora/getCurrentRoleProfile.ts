import 'server-only';
import type {
  User,
  UserRole,
  MentorProfile,
  MentorSkill,
  MenteeProfile,
  MenteeGoalSkill,
  Skill,
} from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export type CurrentMentorProfile = MentorProfile & {
  skills: (MentorSkill & { skill: Skill })[];
};
export type CurrentMenteeProfile = MenteeProfile & {
  goalSkills: (MenteeGoalSkill & { skill: Skill })[];
};

/**
 * Discriminated-union profile context. Both legacy `profile` (per spec §7.3)
 * and new `mentorProfile` / `menteeProfile` (per partition instructions) are
 * exposed so dashboard pages can use either convention.
 */
export type CurrentRoleProfile =
  | {
      kind: 'guest';
      user: null;
      role: null;
      profile: null;
      mentorProfile: null;
      menteeProfile: null;
    }
  | {
      kind: 'mentor';
      user: User;
      role: UserRole;
      profile: CurrentMentorProfile;
      mentorProfile: CurrentMentorProfile;
      menteeProfile: CurrentMenteeProfile | null;
    }
  | {
      kind: 'mentee';
      user: User;
      role: UserRole;
      profile: CurrentMenteeProfile;
      mentorProfile: null;
      menteeProfile: CurrentMenteeProfile;
    }
  | {
      kind: 'none';
      user: User;
      role: UserRole;
      profile: null;
      mentorProfile: null;
      menteeProfile: null;
    };

/**
 * Resolve the current user's profile context for use by route pages.
 *
 * - When called without an argument, derives userId from the active session.
 * - When called with an explicit `userId`, fetches that user (assumes the
 *   caller has already verified ownership).
 *
 * Used by `dashboard/layout.tsx` and pages requiring DB-level role checks
 * (since the Edge `authorized` callback can't read the DB).
 */
export async function getCurrentRoleProfile(userIdParam?: string): Promise<CurrentRoleProfile> {
  let userId = userIdParam;
  if (!userId) {
    const session = await auth();
    userId = (session?.user as { id?: string } | undefined)?.id;
  }
  if (!userId) {
    return {
      kind: 'guest',
      user: null,
      role: null,
      profile: null,
      mentorProfile: null,
      menteeProfile: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      mentorProfile: { include: { skills: { include: { skill: true } } } },
      menteeProfile: { include: { goalSkills: { include: { skill: true } } } },
    },
  });
  if (!user) {
    return {
      kind: 'guest',
      user: null,
      role: null,
      profile: null,
      mentorProfile: null,
      menteeProfile: null,
    };
  }

  const { mentorProfile, menteeProfile, ...bareUser } = user;
  const role = user.role;

  if (mentorProfile && role === 'MENTOR') {
    const mp = mentorProfile as CurrentMentorProfile;
    return {
      kind: 'mentor',
      user: bareUser as User,
      role,
      profile: mp,
      mentorProfile: mp,
      menteeProfile: (menteeProfile as CurrentMenteeProfile | null) ?? null,
    };
  }
  if (menteeProfile) {
    const me = menteeProfile as CurrentMenteeProfile;
    return {
      kind: 'mentee',
      user: bareUser as User,
      role,
      profile: me,
      mentorProfile: null,
      menteeProfile: me,
    };
  }
  return {
    kind: 'none',
    user: bareUser as User,
    role,
    profile: null,
    mentorProfile: null,
    menteeProfile: null,
  };
}
