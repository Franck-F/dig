/**
 * Authorisation decision for viewing a mentee's full profile. Pure (no I/O)
 * so it is unit-testable; the page performs the Prisma lookups and passes the
 * resulting booleans in.
 *
 * Rule: ADMIN always; a MENTOR only when an actual relationship exists — a
 * Mentorship (any status) OR an active MentorshipRequest (PENDING/ACCEPTED)
 * between the viewing mentor and the mentee. Any other role: never.
 */
export type MenteeAccessInput = {
  viewerRole: string;
  hasMentorship: boolean;
  hasActiveRequest: boolean;
};

export function canViewerSeeMenteeProfile(i: MenteeAccessInput): boolean {
  if (i.viewerRole === 'ADMIN') return true;
  if (i.viewerRole !== 'MENTOR') return false;
  return i.hasMentorship || i.hasActiveRequest;
}
