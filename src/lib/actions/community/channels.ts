'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  CommunityError,
  err,
  handleError,
  ok,
  requireCommunityAdmin,
  requireCommunityWriter,
} from './_helpers';
import { createCommunityNotification } from '@/lib/community/notifications';

/**
 * Channel membership actions (member-facing).
 * Spec §5.2 channels.
 */

const slugSchema = z.string().min(2).max(40).regex(/^[a-z0-9-]+$/);

const slugInputSchema = z.object({ slug: slugSchema });

async function loadChannelOrThrow(slug: string) {
  const c = await prisma.channel.findUnique({ where: { slug } });
  if (!c || c.archivedAt) throw new CommunityError('notFound');
  return c;
}

export async function joinChannel(
  input: z.input<typeof slugInputSchema>,
): Promise<ActionResult<{ status: 'ACTIVE' | 'PENDING' }>> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = slugInputSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const channel = await loadChannelOrThrow(parsed.data.slug);

    if (channel.type === 'PRIVATE') return err('channelInviteOnly');

    const existing = await prisma.channelMembership.findUnique({
      where: { channelId_memberId: { channelId: channel.id, memberId: ctx.member.id } },
    });

    const desired: 'ACTIVE' | 'PENDING' = channel.type === 'RESTRICTED' ? 'PENDING' : 'ACTIVE';

    const row = await prisma.channelMembership.upsert({
      where: { channelId_memberId: { channelId: channel.id, memberId: ctx.member.id } },
      create: {
        channelId: channel.id,
        memberId: ctx.member.id,
        status: existing && existing.status === 'ACTIVE' ? 'ACTIVE' : desired,
      },
      update: {
        status: existing?.status === 'ACTIVE' ? 'ACTIVE' : desired,
        leftAt: null,
      },
      select: { status: true },
    });

    // Notify admins if this is a join request.
    if (row.status === 'PENDING') {
      const admins = await prisma.communityMember.findMany({
        where: { OR: [{ isModerator: true }, { user: { role: 'ADMIN' } }] },
        select: { userId: true },
      });
      for (const a of admins) {
        await createCommunityNotification(a.userId, 'CHANNEL_JOIN_REQUESTED', {
          channelSlug: channel.slug,
          channelId: channel.id,
          memberId: ctx.member.id,
          memberHandle: ctx.member.handle,
        });
      }
    }

    revalidatePath(`/community/c/${channel.slug}`);
    return ok({ status: row.status as 'ACTIVE' | 'PENDING' });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Stamp `ChannelMembership.lastReadAt = now()` for the current viewer.
 * Called from the channel page on mount so the unread badge clears as soon
 * as the user opens the channel. No-op when the viewer isn't a community
 * member or isn't a member of the channel — we don't auto-create a row.
 */
export async function markChannelRead(
  input: z.input<typeof slugInputSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityWriter({ allowMuted: true });
    const parsed = slugInputSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const channel = await loadChannelOrThrow(parsed.data.slug);
    await prisma.channelMembership.updateMany({
      where: { channelId: channel.id, memberId: ctx.member.id },
      data: { lastReadAt: new Date() },
    });
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function leaveChannel(
  input: z.input<typeof slugInputSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityWriter({ allowMuted: true });
    const parsed = slugInputSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const channel = await loadChannelOrThrow(parsed.data.slug);

    await prisma.channelMembership.updateMany({
      where: { channelId: channel.id, memberId: ctx.member.id },
      data: { status: 'LEFT', leftAt: new Date() },
    });
    revalidatePath(`/community/c/${channel.slug}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function requestChannelJoin(
  input: z.input<typeof slugInputSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityWriter();
    const parsed = slugInputSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const channel = await loadChannelOrThrow(parsed.data.slug);
    if (channel.type !== 'RESTRICTED') return err('forbidden');

    const existing = await prisma.channelMembership.findUnique({
      where: { channelId_memberId: { channelId: channel.id, memberId: ctx.member.id } },
    });
    if (existing && (existing.status === 'PENDING' || existing.status === 'ACTIVE')) {
      return ok();
    }
    await prisma.channelMembership.upsert({
      where: { channelId_memberId: { channelId: channel.id, memberId: ctx.member.id } },
      create: { channelId: channel.id, memberId: ctx.member.id, status: 'PENDING' },
      update: { status: 'PENDING', leftAt: null },
    });
    revalidatePath(`/community/c/${channel.slug}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

const inviteSchema = z.object({
  slug: slugSchema,
  handle: z.string().regex(/^[a-z0-9_]{3,30}$/),
});

export async function inviteToChannel(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const channel = await loadChannelOrThrow(parsed.data.slug);
    if (channel.type !== 'PRIVATE') return err('forbidden');

    const target = await prisma.communityMember.findUnique({
      where: { handle: parsed.data.handle },
      select: { id: true, userId: true },
    });
    if (!target) return err('notFound');

    await prisma.channelMembership.upsert({
      where: { channelId_memberId: { channelId: channel.id, memberId: target.id } },
      create: {
        channelId: channel.id,
        memberId: target.id,
        status: 'ACTIVE',
        invitedById: ctx.member.id,
      },
      update: { status: 'ACTIVE', leftAt: null },
    });

    await createCommunityNotification(target.userId, 'CHANNEL_INVITE', {
      channelSlug: channel.slug,
      channelId: channel.id,
      invitedByMemberId: ctx.member.id,
    });

    revalidatePath(`/community/c/${channel.slug}`);
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
