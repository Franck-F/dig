'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { ChannelType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  err,
  handleError,
  ok,
  requireCommunityAdmin,
} from '../_helpers';
import { createCommunityNotification } from '@/lib/community/notifications';
import { logAdmin } from '@/lib/audit/log';

/** Admin channel CRUD + pin/approve. Spec §5.2 channels admin. */

const slug = z.string().min(2).max(40).regex(/^[a-z0-9-]+$/);

const createSchema = z.object({
  slug,
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  emoji: z.string().min(1).max(8).optional(),
  coverColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  type: z.nativeEnum(ChannelType).default('PUBLIC'),
  isDefault: z.boolean().optional(),
  position: z.number().int().min(0).max(1000).optional(),
});

export async function createChannel(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const dup = await prisma.channel.findUnique({ where: { slug: parsed.data.slug } });
    if (dup) return err('invalidInput');

    const channel = await prisma.channel.create({
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        emoji: parsed.data.emoji ?? null,
        coverColor: parsed.data.coverColor ?? '#7301FF',
        type: parsed.data.type,
        isDefault: parsed.data.isDefault ?? false,
        position: parsed.data.position ?? 0,
        createdById: ctx.member.id,
      },
      select: { id: true, slug: true },
    });
    await logAdmin(ctx.userId, {
      action: 'channel.create',
      targetType: 'Channel',
      targetId: channel.id,
      payload: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        type: parsed.data.type,
      },
    });
    revalidatePath('/community/channels');
    revalidatePath('/community/admin/channels');
    return ok(channel);
  } catch (e) {
    return handleError(e);
  }
}

const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

export async function updateChannel(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const { id, ...rest } = parsed.data;
    const channel = await prisma.channel.update({
      where: { id },
      data: rest,
      select: { slug: true },
    });
    await logAdmin(ctx.userId, {
      action: 'channel.update',
      targetType: 'Channel',
      targetId: id,
      payload: { changedFields: Object.keys(rest) },
    });
    revalidatePath('/community/channels');
    revalidatePath(`/community/c/${channel.slug}`);
    revalidatePath('/community/admin/channels');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const idSchema = z.object({ id: z.string().min(1) });

export async function archiveChannel(
  input: z.input<typeof idSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = idSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    await prisma.channel.update({
      where: { id: parsed.data.id },
      data: { archivedAt: new Date() },
    });
    await logAdmin(ctx.userId, {
      action: 'channel.archive',
      targetType: 'Channel',
      targetId: parsed.data.id,
    });
    revalidatePath('/community/channels');
    revalidatePath('/community/admin/channels');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

/** Spec compatibility — admin "delete" is archive. */
export const deleteChannel = archiveChannel;

const pinSchema = z.object({ channelId: z.string().min(1), postId: z.string().min(1) });

const MAX_PINNED = 3;

export async function pinPost(input: z.input<typeof pinSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = pinSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const channel = await prisma.channel.findUnique({ where: { id: parsed.data.channelId } });
    if (!channel) return err('notFound');
    const next = Array.from(new Set([parsed.data.postId, ...channel.pinnedPostIds]));
    if (next.length > MAX_PINNED) next.length = MAX_PINNED;
    await prisma.$transaction([
      prisma.channel.update({
        where: { id: channel.id },
        data: { pinnedPostIds: next },
      }),
      prisma.post.update({
        where: { id: parsed.data.postId },
        data: { isPinned: true },
      }),
      prisma.moderationAction.create({
        data: {
          type: 'PIN_POST',
          actorId: ctx.member.id,
          channelId: channel.id,
          postId: parsed.data.postId,
        },
      }),
    ]);
    await logAdmin(ctx.userId, {
      action: 'channel.pin_post',
      targetType: 'Post',
      targetId: parsed.data.postId,
      payload: { channelId: channel.id, channelSlug: channel.slug },
    });
    revalidatePath(`/community/c/${channel.slug}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function unpinPost(input: z.input<typeof pinSchema>): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = pinSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const channel = await prisma.channel.findUnique({ where: { id: parsed.data.channelId } });
    if (!channel) return err('notFound');
    const next = channel.pinnedPostIds.filter((p) => p !== parsed.data.postId);
    await prisma.$transaction([
      prisma.channel.update({
        where: { id: channel.id },
        data: { pinnedPostIds: next },
      }),
      prisma.post.update({
        where: { id: parsed.data.postId },
        data: { isPinned: false },
      }),
      prisma.moderationAction.create({
        data: {
          type: 'UNPIN_POST',
          actorId: ctx.member.id,
          channelId: channel.id,
          postId: parsed.data.postId,
        },
      }),
    ]);
    await logAdmin(ctx.userId, {
      action: 'channel.unpin_post',
      targetType: 'Post',
      targetId: parsed.data.postId,
      payload: { channelId: channel.id, channelSlug: channel.slug },
    });
    revalidatePath(`/community/c/${channel.slug}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const approveSchema = z.object({ membershipId: z.string().min(1) });

export async function approveChannelJoin(
  input: z.input<typeof approveSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = approveSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const m = await prisma.channelMembership.findUnique({
      where: { id: parsed.data.membershipId },
      include: {
        member: { select: { userId: true } },
        channel: { select: { slug: true, id: true } },
      },
    });
    if (!m) return err('notFound');
    if (m.status !== 'PENDING') return err('forbidden');
    await prisma.$transaction([
      prisma.channelMembership.update({
        where: { id: m.id },
        data: { status: 'ACTIVE' },
      }),
      prisma.moderationAction.create({
        data: {
          type: 'APPROVE_CHANNEL_JOIN',
          actorId: ctx.member.id,
          targetMemberId: m.memberId,
          channelId: m.channelId,
        },
      }),
    ]);
    await createCommunityNotification(m.member.userId, 'CHANNEL_JOIN_APPROVED', {
      channelSlug: m.channel.slug,
      channelId: m.channelId,
    });
    await logAdmin(ctx.userId, {
      action: 'channel.approve_join',
      targetType: 'CommunityMember',
      targetId: m.memberId,
      payload: { channelId: m.channelId, channelSlug: m.channel.slug },
    });
    revalidatePath(`/community/c/${m.channel.slug}`);
    revalidatePath('/community/admin/channels');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const denySchema = z.object({
  membershipId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function denyChannelJoin(
  input: z.input<typeof denySchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = denySchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const m = await prisma.channelMembership.findUnique({
      where: { id: parsed.data.membershipId },
    });
    if (!m) return err('notFound');
    if (m.status !== 'PENDING') return err('forbidden');
    await prisma.$transaction([
      prisma.channelMembership.update({
        where: { id: m.id },
        data: { status: 'REMOVED' },
      }),
      prisma.moderationAction.create({
        data: {
          type: 'DENY_CHANNEL_JOIN',
          actorId: ctx.member.id,
          targetMemberId: m.memberId,
          channelId: m.channelId,
          reason: parsed.data.reason ?? null,
        },
      }),
    ]);
    await logAdmin(ctx.userId, {
      action: 'channel.deny_join',
      targetType: 'CommunityMember',
      targetId: m.memberId,
      payload: { channelId: m.channelId, reason: parsed.data.reason ?? null },
    });
    revalidatePath('/community/admin/channels');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
