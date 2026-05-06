'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { type ActionResult, err, handleError, ok, requireCommunityMember } from './_helpers';

/**
 * Bookmark toggle. Spec §5.2 bookmarks.
 *
 * Members may bookmark any post they can read. The on-row counter
 * `Post.bookmarkCount` is updated atomically so directory pages can sort
 * by it without a separate aggregate.
 */

const schema = z.object({ postId: z.string().min(1) });

export async function toggleBookmark(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ bookmarked: boolean }>> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const post = await prisma.post.findUnique({
      where: { id: parsed.data.postId },
      select: { id: true, status: true, removedAt: true },
    });
    if (!post || post.removedAt) return err('notFound');

    const existing = await prisma.bookmark.findUnique({
      where: { memberId_postId: { memberId: ctx.member.id, postId: post.id } },
    });

    let bookmarked: boolean;
    if (existing) {
      await prisma.$transaction([
        prisma.bookmark.delete({ where: { id: existing.id } }),
        prisma.post.update({
          where: { id: post.id },
          data: { bookmarkCount: { decrement: 1 } },
        }),
      ]);
      bookmarked = false;
    } else {
      await prisma.$transaction([
        prisma.bookmark.create({
          data: { memberId: ctx.member.id, postId: post.id },
        }),
        prisma.post.update({
          where: { id: post.id },
          data: { bookmarkCount: { increment: 1 } },
        }),
      ]);
      bookmarked = true;
    }
    revalidatePath('/community/bookmarks');
    revalidatePath(`/community/posts/${post.id}`);
    return ok({ bookmarked });
  } catch (e) {
    return handleError(e);
  }
}
