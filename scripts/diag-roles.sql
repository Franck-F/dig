-- Diagnostic for B5 (docs/mentora-rebuild/01-audit.md): `adminApproveMentor`
-- used to overwrite User.role with MENTOR unconditionally, so an ADMIN or a
-- PARTNER who applied as mentor and got approved may have lost their role.
--
-- READ-ONLY: run with a read-only role. It changes nothing; the owner decides
-- which roles to restore by hand.
--
-- 1. Users who are still ADMIN or PARTNER and have a mentor profile (not
--    damaged, listed for completeness).
SELECT u.id, u.email, u.role, u."isSuperAdmin", mp.status AS mentor_status, mp."publishedAt"
FROM "User" u
JOIN "MentorProfile" mp ON mp."userId" = u.id
WHERE u.role IN ('ADMIN', 'PARTNER')
ORDER BY u.role, u.email;

-- 2. Users whose role is MENTOR but whose audit trail shows they were
--    approved as mentor: check each against your list of admins and partners.
--    The approving admin is in AuditLog.actorUserId. A super-admin flag on a
--    MENTOR row is a strong sign of a lost ADMIN role.
SELECT u.id, u.email, u.role, u."isSuperAdmin", a."createdAt" AS approved_at, a."actorUserId" AS approved_by
FROM "User" u
JOIN "MentorProfile" mp ON mp."userId" = u.id
LEFT JOIN "AuditLog" a
  ON a."targetType" = 'MentorProfile' AND a."targetId" = mp.id AND a.action = 'mentor.approve'
WHERE u.role = 'MENTOR'
ORDER BY u."isSuperAdmin" DESC, a."createdAt" DESC NULLS LAST;
