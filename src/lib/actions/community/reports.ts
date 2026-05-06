'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ReactionTargetType, ReportReason } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { type ActionResult, err, handleError, ok, requireCommunityMember } from './_helpers';
import { consume } from '@/lib/community/rateLimit';
import { createCommunityNotification } from '@/lib/community/notifications';

/**
 * Member-side report actions. Admin-side resolution lives in
 * `community/admin/moderation.ts`.
 */

const reportSchema = z.object({
  targetType: z.nativeEnum(ReactionTargetType), // POST | COMMENT
  targetId: z.string().min(1),
  reason: z.nativeEnum(ReportReason),
  details: z.string().max(1000).optional(),
});

export async function reportContent(
  input: z.input<typeof reportSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const rl = consume(ctx.member.id, 'REPORTS_HOURLY');
    if (!rl.ok) return err('rateLimited');

    const isPost = parsed.data.targetType === 'POST';
    let postId: string | null = null;
    let commentId: string | null = null;
    let againstMemberId: string | null = null;

    if (isPost) {
      const p = await prisma.post.findUnique({
        where: { id: parsed.data.targetId },
        select: { id: true, authorId: true, removedAt: true },
      });
      if (!p || p.removedAt) return err('notFound');
      if (p.authorId === ctx.member.id) return err('cannotReportSelf');
      postId = p.id;
      againstMemberId = p.authorId;
    } else {
      const c = await prisma.comment.findUnique({
        where: { id: parsed.data.targetId },
        select: { id: true, authorId: true, status: true, postId: true },
      });
      if (!c || c.status !== 'PUBLISHED') return err('notFound');
      if (c.authorId === ctx.member.id) return err('cannotReportSelf');
      commentId = c.id;
      againstMemberId = c.authorId;
    }

    // Reject if a PENDING report already exists for the same target by this user.
    const dupe = await prisma.report.findFirst({
      where: {
        reporterId: ctx.member.id,
        status: 'PENDING',
        ...(isPost ? { postId } : { commentId }),
      },
      select: { id: true },
    });
    if (dupe) return err('duplicateReport');

    const report = await prisma.$transaction(async (tx) => {
      const r = await tx.report.create({
        data: {
          reporterId: ctx.member.id,
          againstMemberId,
          postId,
          commentId,
          reason: parsed.data.reason,
          details: parsed.data.details ?? null,
        },
        select: { id: true },
      });
      // Counter on post.
      if (isPost && postId) {
        await tx.post.update({
          where: { id: postId },
          data: { reportCount: { increment: 1 }, status: 'REPORTED' },
        });
      }
      return r;
    });

    // Notify all moderators.
    const mods = await prisma.communityMember.findMany({
      where: { OR: [{ isModerator: true }, { user: { role: 'ADMIN' } }] },
      select: { userId: true },
    });
    for (const m of mods) {
      await createCommunityNotification(m.userId, 'REPORT_RECEIVED', {
        reportId: report.id,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
      });
    }

    revalidatePath('/community/admin/moderation');
    return ok({ id: report.id });
  } catch (e) {
    return handleError(e);
  }
}

const withdrawSchema = z.object({ reportId: z.string().min(1) });

export async function withdrawReport(
  input: z.input<typeof withdrawSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = withdrawSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const r = await prisma.report.findUnique({ where: { id: parsed.data.reportId } });
    if (!r) return err('notFound');
    if (r.reporterId !== ctx.member.id) return err('forbidden');
    if (r.status !== 'PENDING') return err('forbidden');
    await prisma.report.update({
      where: { id: r.id },
      data: { status: 'RESOLVED_DISMISSED', resolvedAt: new Date() },
    });
    revalidatePath('/community/admin/moderation');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
