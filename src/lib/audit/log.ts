import 'server-only';
import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@/lib/prisma';

/**
 * Append-only audit trail for admin actions.
 *
 * Call from every server action gated behind an admin role check, after the
 * action has succeeded. Failure to log MUST NOT propagate — auditing is
 * observability, not a hard dependency. If the DB write fails we surface
 * the issue to console + Sentry (when wired) and let the action complete.
 *
 * Naming convention for `action`:
 *   <area>.<verb>     — e.g. `mentor.approve`, `challenge.publish`,
 *                       `newsletter.send`, `member.suspend`, `channel.archive`
 *
 * Payload guidelines:
 *   - Keep small (kb, not MB). Don't dump full entities.
 *   - Strip PII when you don't need it for forensic context.
 *   - Always JSON-serialisable (no Date directly — use ISO string).
 *
 * IP + User-Agent are captured automatically from the request headers when
 * available; outside a request scope (cron, scripts) they fall back to
 * `null`.
 */

export type AuditTargetType =
  | 'MentorProfile'
  | 'MenteeProfile'
  | 'User'
  | 'Channel'
  | 'Post'
  | 'Comment'
  | 'Challenge'
  | 'ChallengeSubmission'
  | 'Badge'
  | 'MemberBadge'
  | 'CommunityMember'
  | 'Mentorship'
  | 'MentorshipRequest'
  | 'Session'
  | 'Newsletter'
  | (string & { _brand?: never }); // allow ad-hoc types without a strict enum

type LogInput = {
  action: string;
  targetType?: AuditTargetType;
  targetId?: string;
  payload?: Prisma.JsonValue;
};

/**
 * Read IP + User-Agent from the current request when available. The headers
 * helper throws outside a request scope (e.g. inside `node:test`). We swallow
 * that error and return blanks — the audit log still gets the row, just
 * without forensic detail.
 */
async function readRequestContext(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    const xff = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = h.get('x-real-ip');
    const cfIp = h.get('cf-connecting-ip');
    const ua = h.get('user-agent');
    return {
      ip: xff || realIp || cfIp || null,
      userAgent: ua ? ua.slice(0, 200) : null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Record an audit log entry. The actorUserId is mandatory — pass the user id
 * of whoever triggered the action (typically `ctx.userId` from the action
 * helper that already enforces admin role).
 */
export async function logAdmin(
  actorUserId: string,
  input: LogInput,
): Promise<void> {
  if (!actorUserId) return; // defensive — should never happen post-auth gate
  const { ip, userAgent } = await readRequestContext();

  try {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: input.action.slice(0, 80),
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        payload: (input.payload ?? null) as Prisma.InputJsonValue,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    // Never throw out of the audit logger — it must never block the action.
    // We dual-route the failure: console for local dev visibility, Sentry
    // for prod alerting. A repeated audit-write failure means the trail is
    // gappy, which is itself a security incident worth waking someone up.
    console.error('[audit] failed to record log', { actorUserId, action: input.action, err });
    Sentry.captureException(err, {
      tags: { area: 'audit', action: input.action },
      extra: {
        actorUserId,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
      },
    });
  }
}

/**
 * Convenience: read recent audit log entries for the admin UI. Returns
 * latest-first up to `limit`. Filterable by actor / action / target.
 */
export async function listAuditLog(opts: {
  limit?: number;
  actorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  before?: Date;
}): Promise<
  Array<{
    id: string;
    actorUserId: string;
    actor: { name: string | null; email: string };
    action: string;
    targetType: string | null;
    targetId: string | null;
    payload: Prisma.JsonValue | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>
> {
  const where: Prisma.AuditLogWhereInput = {};
  if (opts.actorUserId) where.actorUserId = opts.actorUserId;
  if (opts.action) where.action = opts.action;
  if (opts.targetType) where.targetType = opts.targetType;
  if (opts.targetId) where.targetId = opts.targetId;
  if (opts.before) where.createdAt = { lt: opts.before };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(200, Math.max(1, opts.limit ?? 50)),
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    actor: { name: r.actor.name, email: r.actor.email },
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    payload: r.payload as Prisma.JsonValue | null,
    ip: r.ip,
    userAgent: r.userAgent,
    createdAt: r.createdAt,
  }));
}
