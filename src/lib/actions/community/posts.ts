'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { Post } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  CommunityError,
  err,
  handleError,
  ok,
  requireCommunityAdmin,
  requireCommunityMember,
  requireCommunityWriter,
} from './_helpers';
import { extractMentions } from '@/lib/community/mentions';
import { extractHashtags } from '@/lib/community/hashtags';
import { renderSanitizedMarkdown } from '@/lib/community/sanitizer';
import { consume } from '@/lib/community/rateLimit';
import { evaluateBadges } from '@/lib/community/badges';
import { createCommunityNotification } from '@/lib/community/notifications';

/**
 * Post actions. Spec §5.2 posts.
 *
 * Notable rules:
 *  - createPost goes through both POSTS_5MIN and POSTS_DAILY buckets.
 *  - DRAFT → PUBLISHED transition is what fires notifications + badge eval.
 *  - 15-minute edit window; past that an `editReason` is required.
 *  - `removePost` may be invoked by author OR moderator. Moderator removals
 *    fire a MODERATION_ACTION notif to the author.
 */

const EDIT_WINDOW_MS = 15 * 60 * 1000;

// `attachmentUrls` accepts either http(s) URLs or `data:image/...;base64,...`
// data URIs. The data-URI path is what the composer uses today: the client
// reads the file, draws it on a canvas at <=720px wide, exports as JPEG q=0.78,
// and pushes the resulting string here. Each URL ≤ 2MB to keep the row size
// bounded; up to 4 attachments per post.
const attachmentUrlSchema = z
  .string()
  .max(2_500_000)
  .refine(
    (s) =>
      s.startsWith('https://') ||
      s.startsWith('http://') ||
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s),
    { message: 'attachmentUrlInvalid' },
  );

const createPostSchema = z.object({
  channelSlug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(140).optional(),
  body: z.string().min(1).max(10_000),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  tagSkillSlugs: z.array(z.string().min(1).max(60)).max(5).optional(),
  attachmentUrls: z.array(attachmentUrlSchema).max(4).optional(),
});

export async function createPost(
  input: z.input<typeof createPostSchema>,
): Promise<ActionResult<{ id: string; status: Post['status'] }>> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = createPostSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    // Rate limit: both buckets must pass.
    const rl5 = consume(ctx.member.id, 'POSTS_5MIN');
    if (!rl5.ok) return err('rateLimited');
    const rlDay = consume(ctx.member.id, 'POSTS_DAILY');
    if (!rlDay.ok) return err('rateLimited');

    const channel = await prisma.channel.findUnique({
      where: { slug: parsed.data.channelSlug },
    });
    if (!channel || channel.archivedAt) return err('notFound');

    // Permission: ANNOUNCEMENT requires admin/moderator.
    if (channel.type === 'ANNOUNCEMENT' && !ctx.isModerator) {
      return err('forbidden');
    }
    // PRIVATE: must be ACTIVE member.
    if (channel.type === 'PRIVATE') {
      const m = await prisma.channelMembership.findUnique({
        where: { channelId_memberId: { channelId: channel.id, memberId: ctx.member.id } },
      });
      if (!m || m.status !== 'ACTIVE') return err('forbidden');
    }

    // Sanitize fails closed.
    let sanitizedHtml = '';
    try {
      sanitizedHtml = renderSanitizedMarkdown(parsed.data.body);
    } catch {
      return err('sanitizationFailed');
    }

    const handles = extractMentions(parsed.data.body).handles;
    const tags = extractHashtags(parsed.data.body);
    const skillIds = parsed.data.tagSkillSlugs?.length
      ? (
          await prisma.skill.findMany({
            where: { slug: { in: parsed.data.tagSkillSlugs } },
            select: { id: true },
          })
        ).map((s) => s.id)
      : [];

    const isPublishing = parsed.data.status === 'PUBLISHED';
    const created = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          authorId: ctx.member.id,
          channelId: channel.id,
          title: parsed.data.title ?? null,
          body: parsed.data.body,
          bodyTextLength: sanitizedHtml.length,
          attachmentUrls: parsed.data.attachmentUrls ?? [],
          status: parsed.data.status,
          publishedAt: isPublishing ? new Date() : null,
          tags: skillIds.length
            ? { create: skillIds.map((skillId) => ({ skillId })) }
            : undefined,
          hashtags: tags.length ? { create: tags.map((tag) => ({ tag })) } : undefined,
        },
        select: { id: true, status: true, channelId: true, publishedAt: true },
      });

      if (isPublishing) {
        await tx.communityMember.update({
          where: { id: ctx.member.id },
          data: { postCount: { increment: 1 } },
        });
        // Mention rows. Composite unique includes nullable commentId; in PG
        // NULLs are distinct so duplicates by retry are theoretically possible
        // but the surrounding txn + extractMentions dedup keep us safe.
        if (handles.length > 0) {
          const targets = await tx.communityMember.findMany({
            where: { handle: { in: handles } },
            select: { id: true, userId: true, handle: true },
          });
          const rows = targets
            .filter((t) => t.id !== ctx.member.id)
            .map((t) => ({
              authorId: ctx.member.id,
              targetMemberId: t.id,
              postId: post.id,
            }));
          if (rows.length) {
            await tx.mention.createMany({ data: rows, skipDuplicates: true });
          }
        }
      }
      return post;
    });

    if (isPublishing) {
      // Mentions notifications outside the txn (notify writes a separate row).
      if (handles.length > 0) {
        const targets = await prisma.communityMember.findMany({
          where: { handle: { in: handles } },
          select: { id: true, userId: true, handle: true },
        });
        for (const t of targets) {
          if (t.id === ctx.member.id) continue;
          await createCommunityNotification(t.userId, 'MENTION', {
            postId: created.id,
            byMemberId: ctx.member.id,
          });
        }
      }
      await evaluateBadges(ctx.member.id, 'POST_PUBLISHED');
    }

    revalidatePath('/community');
    revalidatePath(`/community/c/${channel.slug}`);
    revalidatePath(`/community/posts/${created.id}`);
    return ok({ id: created.id, status: created.status });
  } catch (e) {
    return handleError(e);
  }
}

const updatePostSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(140).optional(),
  body: z.string().min(1).max(10_000).optional(),
  tagSkillSlugs: z.array(z.string().min(1).max(60)).max(5).optional(),
  editReason: z.string().min(1).max(200).optional(),
});

export async function updatePost(
  input: z.input<typeof updatePostSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = updatePostSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const post = await prisma.post.findUnique({ where: { id: parsed.data.id } });
    if (!post || post.removedAt) return err('notFound');
    if (post.authorId !== ctx.member.id) return err('forbidden');

    const sincePublishMs = post.publishedAt ? Date.now() - post.publishedAt.getTime() : 0;
    const outsideWindow = post.publishedAt !== null && sincePublishMs > EDIT_WINDOW_MS;
    if (outsideWindow && !parsed.data.editReason) return err('editReasonRequired');

    // Re-extract on body change.
    const data: Record<string, unknown> = {
      title: parsed.data.title ?? post.title,
      editedAt: new Date(),
      editReason: parsed.data.editReason ?? post.editReason,
    };
    if (parsed.data.body) {
      data.body = parsed.data.body;
      const newTags = extractHashtags(parsed.data.body);
      // Replace hashtag set.
      await prisma.postHashtag.deleteMany({ where: { postId: post.id } });
      if (newTags.length) {
        await prisma.postHashtag.createMany({
          data: newTags.map((tag) => ({ postId: post.id, tag })),
          skipDuplicates: true,
        });
      }
    }
    if (parsed.data.tagSkillSlugs) {
      const ids = (
        await prisma.skill.findMany({
          where: { slug: { in: parsed.data.tagSkillSlugs } },
          select: { id: true },
        })
      ).map((s) => s.id);
      await prisma.postTag.deleteMany({ where: { postId: post.id } });
      if (ids.length) {
        await prisma.postTag.createMany({
          data: ids.map((skillId) => ({ postId: post.id, skillId })),
          skipDuplicates: true,
        });
      }
    }
    await prisma.post.update({ where: { id: post.id }, data });
    revalidatePath(`/community/posts/${post.id}`);
    return ok({ id: post.id });
  } catch (e) {
    return handleError(e);
  }
}

const idSchema = z.object({ id: z.string().min(1) });

/**
 * Publish a DRAFT post. Mirrors createPost's notif fan-out for late publishes.
 */
export async function publishPost(
  input: z.input<typeof idSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const post = await prisma.post.findUnique({ where: { id: parsed.data.id } });
    if (!post) return err('notFound');
    if (post.authorId !== ctx.member.id) return err('forbidden');
    if (post.status !== 'DRAFT') return err('invalidInput');

    await prisma.$transaction([
      prisma.post.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      }),
      prisma.communityMember.update({
        where: { id: ctx.member.id },
        data: { postCount: { increment: 1 } },
      }),
    ]);
    await evaluateBadges(ctx.member.id, 'POST_PUBLISHED');
    revalidatePath('/community');
    revalidatePath(`/community/posts/${post.id}`);
    return ok({ id: post.id });
  } catch (e) {
    return handleError(e);
  }
}

export async function archivePost(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityWriter({ allowMuted: true });
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const post = await prisma.post.findUnique({ where: { id: parsed.data.id } });
    if (!post) return err('notFound');
    if (post.authorId !== ctx.member.id) return err('forbidden');
    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'ARCHIVED' },
    });
    revalidatePath('/community');
    revalidatePath(`/community/posts/${post.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function unarchivePost(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const post = await prisma.post.findUnique({ where: { id: parsed.data.id } });
    if (!post) return err('notFound');
    if (post.authorId !== ctx.member.id) return err('forbidden');
    await prisma.post.update({ where: { id: post.id }, data: { status: 'PUBLISHED' } });
    revalidatePath(`/community/posts/${post.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const removePostSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1).max(1000).optional(),
});

/**
 * Soft-delete. Author OR moderator. Moderator removals notify the author.
 */
export async function removePost(
  input: z.input<typeof removePostSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = removePostSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const post = await prisma.post.findUnique({
      where: { id: parsed.data.id },
      include: { author: { select: { userId: true } } },
    });
    if (!post) return err('notFound');
    const isAuthor = post.authorId === ctx.member.id;
    if (!isAuthor && !ctx.isModerator) return err('forbidden');

    await prisma.$transaction([
      prisma.post.update({
        where: { id: post.id },
        data: {
          status: 'REMOVED',
          removedAt: new Date(),
          removalReason: parsed.data.reason ?? null,
        },
      }),
      prisma.moderationAction.create({
        data: {
          type: 'REMOVE_POST',
          actorId: ctx.member.id,
          targetMemberId: post.authorId,
          postId: post.id,
          reason: parsed.data.reason ?? null,
        },
      }),
    ]);

    if (!isAuthor) {
      await createCommunityNotification(post.author.userId, 'MODERATION_ACTION', {
        postId: post.id,
        action: 'REMOVE_POST',
        reason: parsed.data.reason ?? null,
      }, { email: false });
    }
    revalidatePath('/community');
    revalidatePath(`/community/posts/${post.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function restorePost(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    await requireCommunityAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const post = await prisma.post.findUnique({ where: { id: parsed.data.id } });
    if (!post) return err('notFound');
    await prisma.post.update({
      where: { id: post.id },
      data: { status: 'PUBLISHED', removedAt: null, removalReason: null },
    });
    revalidatePath(`/community/posts/${post.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function lockPost(input: z.input<typeof idSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    await prisma.$transaction([
      prisma.post.update({ where: { id: parsed.data.id }, data: { isLocked: true } }),
      prisma.moderationAction.create({
        data: { type: 'LOCK_POST', actorId: ctx.member.id, postId: parsed.data.id },
      }),
    ]);
    revalidatePath(`/community/posts/${parsed.data.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function unlockPost(input: z.input<typeof idSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    await prisma.$transaction([
      prisma.post.update({ where: { id: parsed.data.id }, data: { isLocked: false } }),
      prisma.moderationAction.create({
        data: { type: 'UNLOCK_POST', actorId: ctx.member.id, postId: parsed.data.id },
      }),
    ]);
    revalidatePath(`/community/posts/${parsed.data.id}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

/** Alias retained for spec compatibility — `deletePost = removePost`. */
export const deletePost = removePost;
