/**
 * Privilege hierarchy for community sanctions (warn / mute / suspend / ban).
 *
 * An actor may only sanction a target of STRICTLY lower privilege:
 *   super-admin (3) > admin (2) > moderator (1) > member (0)
 *
 * Pure (no I/O) so it is unit-testable; callers fetch each principal's role +
 * flags from the DB and pass them in. This prevents a moderator (or a phished
 * moderator account) from sanctioning a peer moderator, an admin, or a
 * super-admin.
 */
export type Principal = {
  role: string;
  isSuperAdmin: boolean;
  isModerator: boolean;
};

export function privilegeLevel(p: Principal): number {
  if (p.isSuperAdmin) return 3;
  if (p.role === 'ADMIN') return 2;
  if (p.isModerator) return 1;
  return 0;
}

/** True iff `actor` may sanction `target` (target strictly lower privilege). */
export function canSanction(actor: Principal, target: Principal): boolean {
  return privilegeLevel(target) < privilegeLevel(actor);
}
