import type { UserRole } from '@prisma/client';

/**
 * `User.role` holds a single value while mentor, mentee and admin are
 * cumulative capacities. Approving a mentor may only upgrade the default
 * STUDENT role: an ADMIN or PARTNER who also mentors keeps their role (B5).
 */
export const ROLES_PROMOTED_ON_MENTOR_APPROVAL = ['STUDENT'] as const satisfies readonly UserRole[];

export function roleAfterMentorApproval(current: UserRole): UserRole {
  return (ROLES_PROMOTED_ON_MENTOR_APPROVAL as readonly UserRole[]).includes(current) ? 'MENTOR' : current;
}
