'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { MemberStatus, ModerationActionType, ReportStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  err,
  handleError,
  ok,
  requireCommunityAdmin,
} from '../_helpers';
import { createCommunityNotification } from '@/lib/community/notifications';
import { sendCommunityTemplatedEmail } from '@/lib/community/email';
import { logAdmin } from '@/lib/audit/log';

/**
 * Admin moderation queue actions. Spec §5.2 moderation.
 *
 * Operational emails (warn/mute/suspend/ban/unban) are the ONLY per-event
 * Community emails — see spec §7.2.
 */

const resolveSchema = z.object({
  reportId: z.string().min(1),
  resolution: z.enum(['remove', 'dismiss', 'warn', 'ban']),
  resolutionNote: z.string().max(500).optional(),
});

export async function resolveReport(
  input: z.input<typeof resolveSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = resolveSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const report = await prisma.report.findUnique({
      where: { id: parsed.data.reportId },
      include: {
        post: { select: { id: true } },
        comment: { select: { id: true, postId: true } },
        againstMember: { select: { id: true, userId: true } },
      },
    });
    if (!report) return err('notFound');
    if (report.status !== 'PENDING') return err('forbidden');

    let actionType: ModerationActionType | null = null;
    let nextStatus: ReportStatus = 'RESOLVED_DISMISSED';
    switch (parsed.data.resolution) {
      case 'remove':
        if (report.post) {
          actionType = 'REMOVE_POST';
          await prisma.post.update({
            where: { id: report.post.id },
            data: { status: 'REMOVED', removedAt: new Date(), removalReason: parsed.data.resolutionNote ?? null },
          });
        } else if (report.comment) {
          actionType = 'REMOVE_COMMENT';
          await prisma.comment.update({
            where: { id: report.comment.id },
            data: {
              status: 'REMOVED',
              removedAt: new Date(),
              removalReason: parsed.data.resolutionNote ?? null,
            },
          });
        }
        nextStatus = 'RESOLVED_REMOVED';
        break;
      case 'warn':
        actionType = 'WARN_AUTHOR';
        nextStatus = 'RESOLVED_WARNED';
        break;
      case 'ban':
        actionType = 'BAN_USER';
        if (report.againstMember) {
          await prisma.communityMember.update({
            where: { id: report.againstMember.id },
            data: { status: 'BANNED', statusReason: parsed.data.resolutionNote ?? null },
          });
        }
        nextStatus = 'RESOLVED_BANNED';
        break;
      case 'dismiss':
        actionType = 'DISMISS_REPORT';
        nextStatus = 'RESOLVED_DISMISSED';
        break;
    }

    let modActionId: string | null = null;
    if (actionType) {
      const ma = await prisma.moderationAction.create({
        data: {
          type: actionType,
          actorId: ctx.member.id,
          targetMemberId: report.againstMember?.id ?? null,
          postId: report.post?.id ?? null,
          commentId: report.comment?.id ?? null,
          reportId: report.id,
          reason: parsed.data.resolutionNote ?? null,
        },
        select: { id: true },
      });
      modActionId = ma.id;
    }

    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: nextStatus,
        resolvedAt: new Date(),
        resolvedById: ctx.member.id,
        resolution: parsed.data.resolutionNote ?? null,
        linkedActionId: modActionId,
      },
    });

    // Email + notif for warn/ban (per §7.2).
    if (report.againstMember && (parsed.data.resolution === 'warn' || parsed.data.resolution === 'ban')) {
      await createCommunityNotification(
        report.againstMember.userId,
        'MODERATION_ACTION',
        {
          action: actionType,
          reason: parsed.data.resolutionNote ?? null,
          reportId: report.id,
        },
      );
      const user = await prisma.user.findUnique({
        where: { id: report.againstMember.userId },
        select: { email: true, firstName: true, name: true },
      });
      if (user?.email) {
        const keyRoot = parsed.data.resolution === 'warn'
          ? 'community.emails.warned'
          : 'community.emails.banned';
        await sendCommunityTemplatedEmail({
          to: user.email,
          keyRoot,
          params: {
            name: user.firstName ?? user.name ?? '',
            reason: parsed.data.resolutionNote ?? '',
          },
          fallbackSubject: parsed.data.resolution === 'warn'
            ? '[Digizelle] Avertissement modération'
            : '[Digizelle] Suspension de votre compte communauté',
          fallbackBody: parsed.data.resolutionNote ?? '',
        });
      }
    }

    await logAdmin(ctx.userId, {
      action: `report.resolve.${parsed.data.resolution}`,
      targetType: report.post ? 'Post' : report.comment ? 'Comment' : 'CommunityMember',
      targetId: report.post?.id ?? report.comment?.id ?? report.againstMember?.id ?? report.id,
      payload: {
        reportId: report.id,
        note: parsed.data.resolutionNote ?? null,
      },
    });

    revalidatePath('/community/admin/moderation');
    return ok({ id: report.id });
  } catch (e) {
    return handleError(e);
  }
}

const memberActionSchema = z.object({
  memberId: z.string().min(1),
  reason: z.string().min(1).max(1000),
  until: z.string().datetime().optional(),
});

async function applyStatus(
  actorMemberId: string,
  memberId: string,
  /** Pass `null` to skip the status row update (e.g. warn-only). */
  status: MemberStatus | null,
  type: ModerationActionType,
  reason: string,
  until?: Date | null,
  emailKeyRoot?: string,
  emailSubjectFallback?: string,
) {
  const target = await prisma.communityMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { email: true, firstName: true, name: true } } },
  });
  if (!target) return null;
  if (status !== null) {
    await prisma.$transaction([
      prisma.communityMember.update({
        where: { id: memberId },
        data: {
          status,
          statusReason: reason,
          statusUntil: until ?? null,
        },
      }),
      prisma.moderationAction.create({
        data: { type, actorId: actorMemberId, targetMemberId: memberId, reason },
      }),
    ]);
  } else {
    await prisma.moderationAction.create({
      data: { type, actorId: actorMemberId, targetMemberId: memberId, reason },
    });
  }
  await createCommunityNotification(target.userId, 'MODERATION_ACTION', {
    action: type,
    reason,
    until: until?.toISOString() ?? null,
  });
  if (target.user.email && emailKeyRoot) {
    await sendCommunityTemplatedEmail({
      to: target.user.email,
      keyRoot: emailKeyRoot,
      params: {
        name: target.user.firstName ?? target.user.name ?? '',
        reason,
        until: until ? until.toISOString() : '',
      },
      fallbackSubject: emailSubjectFallback ?? '[Digizelle Community]',
      fallbackBody: reason,
    });
  }
  return target;
}

export async function warnAuthor(
  input: z.input<typeof memberActionSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = memberActionSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    await applyStatus(
      ctx.member.id,
      parsed.data.memberId,
      null, // warn doesn't change row status
      'WARN_AUTHOR',
      parsed.data.reason,
      null,
      'community.emails.warned',
      '[Digizelle] Avertissement modération',
    );
    await logAdmin(ctx.userId, {
      action: 'member.warn',
      targetType: 'CommunityMember',
      targetId: parsed.data.memberId,
      payload: { reason: parsed.data.reason.slice(0, 500) },
    });
    revalidatePath('/community/admin/moderation');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function muteUser(
  input: z.input<typeof memberActionSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = memberActionSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    await applyStatus(
      ctx.member.id,
      parsed.data.memberId,
      'MUTED',
      'MUTE_USER',
      parsed.data.reason,
      parsed.data.until ? new Date(parsed.data.until) : null,
      'community.emails.muted',
      '[Digizelle] Restriction de votre compte communauté',
    );
    await logAdmin(ctx.userId, {
      action: 'member.mute',
      targetType: 'CommunityMember',
      targetId: parsed.data.memberId,
      payload: {
        reason: parsed.data.reason.slice(0, 500),
        until: parsed.data.until ?? null,
      },
    });
    revalidatePath('/community/admin/moderation');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function suspendUser(
  input: z.input<typeof memberActionSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = memberActionSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    await applyStatus(
      ctx.member.id,
      parsed.data.memberId,
      'SUSPENDED',
      'SUSPEND_USER',
      parsed.data.reason,
      parsed.data.until ? new Date(parsed.data.until) : null,
      'community.emails.suspended',
      '[Digizelle] Suspension de votre compte communauté',
    );
    await logAdmin(ctx.userId, {
      action: 'member.suspend',
      targetType: 'CommunityMember',
      targetId: parsed.data.memberId,
      payload: {
        reason: parsed.data.reason.slice(0, 500),
        until: parsed.data.until ?? null,
      },
    });
    revalidatePath('/community/admin/moderation');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

/**
 * BAN flow — Phase 3 task #42 enforces dual-moderator approval.
 *
 *   proposeBan()   first moderator submits a proposal with a reason
 *   banUser()      a SECOND, distinct moderator finalises within 24 h
 *
 * Why this matters: a phished mod account, or a single bad-faith mod,
 * could otherwise unilaterally ban a member. Requiring two distinct
 * moderator IDs makes that significantly harder.
 *
 * Implementation notes:
 *  - The proposal is just a `ModerationAction` row of type BAN_PROPOSAL.
 *    No new table; we read recent rows and apply policy in code.
 *  - Window: 24 h from the proposal's `createdAt`. Past that the
 *    proposer must re-propose.
 *  - The actor of `BAN_USER` MUST differ from the actor of the most
 *    recent BAN_PROPOSAL on this target.
 */
const BAN_PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

export async function proposeBan(
  input: z.input<typeof memberActionSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = memberActionSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const target = await prisma.communityMember.findUnique({
      where: { id: parsed.data.memberId },
      select: { id: true },
    });
    if (!target) return err('notFound');

    await prisma.moderationAction.create({
      data: {
        type: 'BAN_PROPOSAL',
        actorId: ctx.member.id,
        targetMemberId: target.id,
        reason: parsed.data.reason,
      },
    });
    await logAdmin(ctx.userId, {
      action: 'member.ban_proposal',
      targetType: 'CommunityMember',
      targetId: target.id,
      payload: { reason: parsed.data.reason.slice(0, 500) },
    });
    revalidatePath('/community/admin/moderation');
    revalidatePath(`/community/admin/users/${target.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function banUser(
  input: z.input<typeof memberActionSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = memberActionSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    // A different moderator must have proposed the ban within the
    // 24 h window. No proposal → reject; same actor as proposer →
    // reject (would defeat the purpose).
    const since = new Date(Date.now() - BAN_PROPOSAL_TTL_MS);
    const recentProposal = await prisma.moderationAction.findFirst({
      where: {
        type: 'BAN_PROPOSAL',
        targetMemberId: parsed.data.memberId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!recentProposal) return err('banProposalRequired');
    if (recentProposal.actorId === ctx.member.id) {
      return err('banProposalSelfApprove');
    }

    await applyStatus(
      ctx.member.id,
      parsed.data.memberId,
      'BANNED',
      'BAN_USER',
      parsed.data.reason,
      null,
      'community.emails.banned',
      '[Digizelle] Bannissement de votre compte communauté',
    );
    await logAdmin(ctx.userId, {
      action: 'member.ban',
      targetType: 'CommunityMember',
      targetId: parsed.data.memberId,
      payload: {
        reason: parsed.data.reason.slice(0, 500),
        proposedBy: recentProposal.actorId,
        proposedAt: recentProposal.createdAt.toISOString(),
      },
    });
    revalidatePath('/community/admin/moderation');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const memberOnlySchema = z.object({ memberId: z.string().min(1) });

export async function unbanUser(
  input: z.input<typeof memberOnlySchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = memberOnlySchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    await applyStatus(
      ctx.member.id,
      parsed.data.memberId,
      'ACTIVE',
      'UNBAN_USER',
      'unbanned',
      null,
      'community.emails.unbanned',
      '[Digizelle] Reactivation de votre compte communauté',
    );
    await logAdmin(ctx.userId, {
      action: 'member.unban',
      targetType: 'CommunityMember',
      targetId: parsed.data.memberId,
    });
    revalidatePath('/community/admin/moderation');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const dismissSchema = z.object({
  reportId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function dismissReport(
  input: z.input<typeof dismissSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = dismissSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const r = await prisma.report.findUnique({ where: { id: parsed.data.reportId } });
    if (!r) return err('notFound');
    if (r.status !== 'PENDING') return err('forbidden');
    await prisma.$transaction([
      prisma.report.update({
        where: { id: r.id },
        data: {
          status: 'RESOLVED_DISMISSED',
          resolvedAt: new Date(),
          resolvedById: ctx.member.id,
          resolution: parsed.data.note ?? null,
        },
      }),
      prisma.moderationAction.create({
        data: {
          type: 'DISMISS_REPORT',
          actorId: ctx.member.id,
          reportId: r.id,
          reason: parsed.data.note ?? null,
        },
      }),
    ]);
    await logAdmin(ctx.userId, {
      action: 'report.dismiss',
      targetType: 'Comment',
      targetId: r.id,
      payload: { note: parsed.data.note ?? null },
    });
    revalidatePath('/community/admin/moderation');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

// ── Editorial moderation (Contenu admin tab) ────────────────────────

const postIdSchema = z.object({ postId: z.string().min(1) });

/**
 * Editorial "Approuver" action used by `/community/admin/content`.
 * Restores a REPORTED post to PUBLISHED, clears its denormalised
 * `reportCount`, and dismisses every PENDING report against it in
 * the same transaction so the signalements queue stays consistent.
 *
 * For PUBLISHED posts (with reportCount > 0 but status unchanged), it
 * still clears reports & resets the counter — letting the admin
 * "vouch" for content that's been flagged but is fine.
 */
export async function approvePostContent(
  input: z.input<typeof postIdSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = postIdSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const post = await prisma.post.findUnique({
      where: { id: parsed.data.postId },
      select: { id: true, status: true, channelId: true },
    });
    if (!post) return err('notFound');

    await prisma.$transaction([
      prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'PUBLISHED',
          reportCount: 0,
          // Clear any previous removal so the post becomes visible again
          // — admins can choose Approuver after a botched Refuser.
          removedAt: null,
          removalReason: null,
        },
      }),
      prisma.report.updateMany({
        where: { postId: post.id, status: 'PENDING' },
        data: {
          status: 'RESOLVED_DISMISSED',
          resolvedAt: new Date(),
          resolvedById: ctx.member.id,
          resolution: 'approved by editorial review',
        },
      }),
    ]);

    await logAdmin(ctx.userId, {
      action: 'content.approve_post',
      targetType: 'Post',
      targetId: post.id,
      payload: { channelId: post.channelId },
    });
    revalidatePath('/community/admin/content');
    revalidatePath('/community');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
