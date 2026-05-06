'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  err,
  handleError,
  ok,
  requireCommunityMember,
  requireCommunityWriter,
} from './_helpers';
import { extractMentions } from '@/lib/community/mentions';
import { renderSanitizedMarkdown } from '@/lib/community/sanitizer';
import { consume } from '@/lib/community/rateLimit';
import { evaluateBadges } from '@/lib/community/badges';
import { createCommunityNotification } from '@/lib/community/notifications';

/**
 * Comment actions. Spec §5.2 comments.
 *
 *  - depth ≤ 1 (single-level replies). If `parentCommentId` resolves to a
 *    comment whose own `parentCommentId` is non-null → reject.
 *  - removed comments are soft-deleted; the UI renders a placeholder.
 *  - 15-min edit window enforced; thereafter rejected (mirror posts edit guard).
 */

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const createCommentSchema = z.object({
  postId: z.string().min(1),
  parentCommentId: z.string().min(1).optional(),
  body: z.string().min(1).max(4000),
});

export async function createComment(
  input: z.input<typeof createCommentSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = createCommentSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const rl = consume(ctx.member.id, 'COMMENTS_5MIN');
    if (!rl.ok) return err('rateLimited');
    const rlDay = consume(ctx.member.id, 'COMMENTS_DAILY');
    if (!rlDay.ok) return err('rateLimited');

    const post = await prisma.post.findUnique({
      where: { id: parsed.data.postId },
      include: { author: { select: { userId: true, id: true } } },
    });
    if (!post || post.status === 'REMOVED' || post.removedAt) return err('notFound');
    if (post.isLocked) return err('channelLocked');

    let parentCommentAuthorUserId: string | null = null;
    if (parsed.data.parentCommentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parsed.data.parentCommentId },
        select: { id: true, parentCommentId: true, postId: true, status: true, author: { select: { userId: true } } },
      });
      if (!parent || parent.postId !== post.id) return err('notFound');
      if (parent.parentCommentId !== null) return err('forbidden'); // depth>1
      if (parent.status !== 'PUBLISHED') return err('notFound');
      parentCommentAuthorUserId = parent.author.userId;
    }

    let sanitizedHtml = '';
    try {
      sanitizedHtml = renderSanitizedMarkdown(parsed.data.body);
    } catch {
      return err('sanitizationFailed');
    }
    void sanitizedHtml; // computed for early-fail; HTML is rendered at read-time

    const handles = extractMentions(parsed.data.body).handles;

    const created = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          postId: post.id,
          authorId: ctx.member.id,
          parentCommentId: parsed.data.parentCommentId ?? null,
          body: parsed.data.body,
        },
        select: { id: true },
      });
      await tx.post.update({
        where: { id: post.id },
        data: { commentCount: { increment: 1 } },
      });
      await tx.communityMember.update({
        where: { id: ctx.member.id },
        data: { commentCount: { increment: 1 } },
      });
      if (handles.length > 0) {
        const targets = await tx.communityMember.findMany({
          where: { handle: { in: handles } },
          select: { id: true },
        });
        const rows = targets
          .filter((t) => t.id !== ctx.member.id)
          .map((t) => ({
            authorId: ctx.member.id,
            targetMemberId: t.id,
            commentId: comment.id,
          }));
        if (rows.length) {
          await tx.mention.createMany({ data: rows, skipDuplicates: true });
        }
      }
      return comment;
    });

    // Notifications outside txn.
    // 1. Post author (POST_REPLY) unless self-comment.
    if (post.author.userId && post.authorId !== ctx.member.id && !parsed.data.parentCommentId) {
      await createCommunityNotification(post.author.userId, 'POST_REPLY', {
        postId: post.id,
        commentId: created.id,
        byMemberId: ctx.member.id,
      });
    }
    // 2. Parent-comment author (COMMENT_REPLY).
    if (parentCommentAuthorUserId && parentCommentAuthorUserId !== post.author.userId) {
      await createCommunityNotification(parentCommentAuthorUserId, 'COMMENT_REPLY', {
        postId: post.id,
        commentId: created.id,
        byMemberId: ctx.member.id,
      });
    }
    // 3. Mentions.
    if (handles.length > 0) {
      const targets = await prisma.communityMember.findMany({
        where: { handle: { in: handles } },
        select: { id: true, userId: true },
      });
      for (const t of targets) {
        if (t.id === ctx.member.id) continue;
        await createCommunityNotification(t.userId, 'MENTION', {
          postId: post.id,
          commentId: created.id,
          byMemberId: ctx.member.id,
        });
      }
    }

    await evaluateBadges(ctx.member.id, 'COMMENT_PUBLISHED');

    revalidatePath(`/community/posts/${post.id}`);
    return ok({ id: created.id });
  } catch (e) {
    return handleError(e);
  }
}

const updateCommentSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export async function updateComment(
  input: z.input<typeof updateCommentSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = updateCommentSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const c = await prisma.comment.findUnique({ where: { id: parsed.data.id } });
    if (!c || c.status !== 'PUBLISHED') return err('notFound');
    if (c.authorId !== ctx.member.id) return err('forbidden');
    const ageMs = Date.now() - c.createdAt.getTime();
    if (ageMs > EDIT_WINDOW_MS) return err('editWindowExpired');
    await prisma.comment.update({
      where: { id: c.id },
      data: { body: parsed.data.body, editedAt: new Date() },
    });
    revalidatePath(`/community/posts/${c.postId}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const removeCommentSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1).max(1000).optional(),
});

export async function removeComment(
  input: z.input<typeof removeCommentSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = removeCommentSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const c = await prisma.comment.findUnique({ where: { id: parsed.data.id } });
    if (!c) return err('notFound');
    const isAuthor = c.authorId === ctx.member.id;
    if (!isAuthor && !ctx.isModerator) return err('forbidden');
    await prisma.$transaction([
      prisma.comment.update({
        where: { id: c.id },
        data: {
          status: 'REMOVED',
          removedAt: new Date(),
          removalReason: parsed.data.reason ?? null,
        },
      }),
      prisma.moderationAction.create({
        data: {
          type: 'REMOVE_COMMENT',
          actorId: ctx.member.id,
          targetMemberId: c.authorId,
          commentId: c.id,
          postId: c.postId,
          reason: parsed.data.reason ?? null,
        },
      }),
      prisma.post.update({
        where: { id: c.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);
    revalidatePath(`/community/posts/${c.postId}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

/** Alias for spec compatibility. */
export const deleteComment = removeComment;
