'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ReactionEmoji, ReactionTargetType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { type ActionResult, err, handleError, ok, requireCommunityWriter } from './_helpers';
import { consume } from '@/lib/community/rateLimit';
import { notifyReactionDebounced } from '@/lib/community/notifications';
import { evaluateBadges } from '@/lib/community/badges';

/**
 * Toggle reaction. Spec §5.2 reactions.
 *
 *  - Upsert keyed on the unique `(memberId, targetType, targetId)`.
 *  - If same emoji exists → remove (toggle off).
 *  - If different emoji exists → update (replace).
 *  - Counter (Post.reactionCount or Comment.reactionCount) is updated atomically.
 *  - Reaction-received notification is debounced 30 min per target.
 */

const toggleSchema = z.object({
  targetType: z.nativeEnum(ReactionTargetType),
  targetId: z.string().min(1),
  emoji: z.nativeEnum(ReactionEmoji),
});

export async function toggleReaction(
  input: z.input<typeof toggleSchema>,
): Promise<ActionResult<{ added: boolean; emoji: ReactionEmoji | null }>> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = toggleSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const rl = consume(ctx.member.id, 'REACTIONS_5MIN');
    if (!rl.ok) return err('rateLimited');

    const isPost = parsed.data.targetType === 'POST';
    const target = isPost
      ? await prisma.post.findUnique({
          where: { id: parsed.data.targetId },
          select: { id: true, status: true, isLocked: true, authorId: true, author: { select: { userId: true } } },
        })
      : await prisma.comment.findUnique({
          where: { id: parsed.data.targetId },
          select: { id: true, status: true, postId: true, authorId: true, author: { select: { userId: true } } },
        });
    if (!target) return err('notFound');
    if (isPost && (target as { status: string }).status === 'REMOVED') return err('notFound');
    if (!isPost && (target as { status: string }).status !== 'PUBLISHED') return err('notFound');

    const existing = await prisma.reaction.findUnique({
      where: {
        memberId_targetType_targetId: {
          memberId: ctx.member.id,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
        },
      },
    });

    let added: boolean;
    let finalEmoji: ReactionEmoji | null;

    if (existing && existing.emoji === parsed.data.emoji) {
      // Toggle off.
      await prisma.$transaction([
        prisma.reaction.delete({ where: { id: existing.id } }),
        isPost
          ? prisma.post.update({
              where: { id: parsed.data.targetId },
              data: { reactionCount: { decrement: 1 } },
            })
          : prisma.comment.update({
              where: { id: parsed.data.targetId },
              data: { reactionCount: { decrement: 1 } },
            }),
        prisma.communityMember.update({
          where: { id: ctx.member.id },
          data: { reactionsGivenCount: { decrement: 1 } },
        }),
        prisma.communityMember.update({
          where: { id: (target as { authorId: string }).authorId },
          data: { reactionsReceivedCount: { decrement: 1 } },
        }),
      ]);
      added = false;
      finalEmoji = null;
    } else if (existing) {
      // Swap emoji — counters unchanged.
      await prisma.reaction.update({
        where: { id: existing.id },
        data: { emoji: parsed.data.emoji },
      });
      added = true;
      finalEmoji = parsed.data.emoji;
    } else {
      // New reaction.
      await prisma.$transaction([
        prisma.reaction.create({
          data: {
            memberId: ctx.member.id,
            targetType: parsed.data.targetType,
            targetId: parsed.data.targetId,
            emoji: parsed.data.emoji,
            postId: isPost ? parsed.data.targetId : null,
            commentId: isPost ? null : parsed.data.targetId,
          },
        }),
        isPost
          ? prisma.post.update({
              where: { id: parsed.data.targetId },
              data: { reactionCount: { increment: 1 } },
            })
          : prisma.comment.update({
              where: { id: parsed.data.targetId },
              data: { reactionCount: { increment: 1 } },
            }),
        prisma.communityMember.update({
          where: { id: ctx.member.id },
          data: { reactionsGivenCount: { increment: 1 } },
        }),
        prisma.communityMember.update({
          where: { id: (target as { authorId: string }).authorId },
          data: { reactionsReceivedCount: { increment: 1 } },
        }),
      ]);
      added = true;
      finalEmoji = parsed.data.emoji;

      // Notification (debounced) — only when ADDING and not self-react.
      const targetAuthorUserId = (target as { author: { userId: string } }).author.userId;
      if ((target as { authorId: string }).authorId !== ctx.member.id) {
        await notifyReactionDebounced({
          recipientUserId: targetAuthorUserId,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          payload: { byMemberId: ctx.member.id, emoji: parsed.data.emoji },
        });
      }
      // Recipient's HUNDRED_REACTIONS badge eligibility may have changed.
      await evaluateBadges((target as { authorId: string }).authorId, 'REACTION_RECEIVED');
    }

    if (isPost) {
      revalidatePath(`/community/posts/${parsed.data.targetId}`);
    } else {
      revalidatePath(`/community/posts/${(target as { postId: string }).postId}`);
    }
    return ok({ added, emoji: finalEmoji });
  } catch (e) {
    return handleError(e);
  }
}
