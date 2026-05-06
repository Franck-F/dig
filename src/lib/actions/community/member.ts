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
  requireCommunityMember,
} from './_helpers';
import { requireUser } from '@/lib/actions/_shared';
import { evaluateBadges } from '@/lib/community/badges';

/**
 * Member / onboarding actions. Spec §5.2 (member).
 */

const HANDLE_REGEX = /^[a-z0-9_]{3,30}$/;

// Reserved words & slugs we never grant. Keep alphabetical.
const RESERVED_HANDLES = new Set([
  'admin', 'admins', 'administrator', 'api', 'auth', 'badge', 'badges',
  'community', 'digizelle', 'help', 'login', 'logout', 'me', 'mentora',
  'mentor', 'mentee', 'moderator', 'moderators', 'modo', 'mod', 'new',
  'official', 'profile', 'register', 'root', 'settings', 'signup', 'staff',
  'support', 'system', 'team',
]);

const handleSchema = z.string().regex(HANDLE_REGEX);

const claimHandleSchema = z.object({
  handle: handleSchema,
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(600).optional(),
  defaultChannelSlugs: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export async function claimHandle(
  input: z.input<typeof claimHandleSchema>,
): Promise<ActionResult<{ memberId: string; handle: string }>> {
  try {
    const ctx = await requireUser();
    const parsed = claimHandleSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const { handle, displayName, bio, defaultChannelSlugs } = parsed.data;

    if (RESERVED_HANDLES.has(handle)) return err('handleInvalid');

    // Check existing community member; reject if already onboarded.
    const existing = await prisma.communityMember.findUnique({ where: { userId: ctx.userId } });
    if (existing?.onboardedAt) return err('alreadyOnboarded');

    // Check handle availability (case-insensitive thanks to regex).
    const handleTaken = await prisma.communityMember.findUnique({ where: { handle } });
    if (handleTaken && handleTaken.userId !== ctx.userId) return err('handleTaken');

    const channels = defaultChannelSlugs?.length
      ? await prisma.channel.findMany({
          where: { slug: { in: defaultChannelSlugs }, archivedAt: null },
          select: { id: true, type: true },
        })
      : await prisma.channel.findMany({
          where: { isDefault: true, archivedAt: null },
          select: { id: true, type: true },
        });

    const member = await prisma.$transaction(async (tx) => {
      const m = existing
        ? await tx.communityMember.update({
            where: { id: existing.id },
            data: {
              handle,
              displayName: displayName ?? existing.displayName,
              bio: bio ?? existing.bio,
              onboardedAt: new Date(),
            },
          })
        : await tx.communityMember.create({
            data: {
              userId: ctx.userId,
              handle,
              displayName,
              bio,
              onboardedAt: new Date(),
            },
          });

      // Auto-join non-PRIVATE channels.
      for (const c of channels) {
        if (c.type === 'PRIVATE') continue;
        await tx.channelMembership.upsert({
          where: { channelId_memberId: { channelId: c.id, memberId: m.id } },
          create: {
            channelId: c.id,
            memberId: m.id,
            status: c.type === 'RESTRICTED' ? 'PENDING' : 'ACTIVE',
          },
          update: {},
        });
      }
      return m;
    });

    // Eval EARLY_MEMBER + role-derived badges (idempotent).
    await evaluateBadges(member.id, 'MEMBER_CREATED');

    revalidatePath('/community');
    revalidatePath(`/community/members/${member.handle}`);
    return ok({ memberId: member.id, handle: member.handle });
  } catch (e) {
    return handleError(e);
  }
}

// Avatar URL: accepts an http(s) URL or a `data:image/...;base64,...` data
// URI (from the in-page resize/compress canvas). The previous `.url().max(2000)`
// cap rejected every uploaded avatar — a 320×320 JPEG at quality 0.85 is
// ~70-200 KB base64, far over 2 KB.
const avatarUrlSchema = z
  .string()
  .max(1_000_000)
  .refine(
    (s) =>
      s.startsWith('https://') ||
      s.startsWith('http://') ||
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s),
    { message: 'avatarUrlInvalid' },
  );

const updateMemberProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(600).optional(),
  avatarUrl: avatarUrlSchema.optional().nullable(),
  bannerColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  digestEnabled: z.boolean().optional(),
});

export async function updateMemberProfile(
  input: z.input<typeof updateMemberProfileSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = updateMemberProfileSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const updated = await prisma.communityMember.update({
      where: { id: ctx.member.id },
      data: parsed.data,
      select: { id: true, handle: true },
    });
    revalidatePath(`/community/members/${updated.handle}`);
    revalidatePath('/community/settings');
    return ok({ id: updated.id });
  } catch (e) {
    return handleError(e);
  }
}

const requestHandleChangeSchema = z.object({ newHandle: handleSchema });

export async function requestHandleChange(
  input: z.input<typeof requestHandleChangeSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = requestHandleChangeSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    if (RESERVED_HANDLES.has(parsed.data.newHandle)) return err('handleInvalid');
    const taken = await prisma.communityMember.findUnique({
      where: { handle: parsed.data.newHandle },
    });
    if (taken) return err('handleTaken');

    // V1: just record a moderation action and notify admins. No auto-apply.
    await prisma.moderationAction.create({
      data: {
        type: 'WARN_AUTHOR', // semantically 'noticed by admins'; spec defers a dedicated type
        actorId: ctx.member.id,
        targetMemberId: ctx.member.id,
        reason: `handle change request: ${parsed.data.newHandle}`,
        payload: { newHandle: parsed.data.newHandle, currentHandle: ctx.member.handle },
      },
    });
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Change the viewer's `@handle` directly (self-service).
 *
 * Validates the requested handle against the same regex/reserved-list as the
 * onboarding flow. Returns `handleTaken` if another member already owns it.
 * Updates the `CommunityMember.handle` row in place — `@unique` on the field
 * is the canonical race-condition guard if two users race to claim the same
 * handle simultaneously, in which case Prisma throws and `handleError`
 * surfaces a generic error.
 *
 * Decision: we apply the change immediately rather than queueing it for
 * admin review — the user explicitly asked for free pseudonym editing.
 */
export async function changeHandle(
  input: z.input<typeof requestHandleChangeSchema>,
): Promise<ActionResult<{ handle: string }>> {
  try {
    const ctx = await requireCommunityMember();
    const parsed = requestHandleChangeSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const newHandle = parsed.data.newHandle;
    if (newHandle === ctx.member.handle) {
      // No-op — return success so the UI can reflect the unchanged state.
      return ok({ handle: ctx.member.handle });
    }
    if (RESERVED_HANDLES.has(newHandle)) return err('handleInvalid');

    const taken = await prisma.communityMember.findUnique({
      where: { handle: newHandle },
      select: { id: true },
    });
    if (taken && taken.id !== ctx.member.id) return err('handleTaken');

    const updated = await prisma.communityMember.update({
      where: { id: ctx.member.id },
      data: { handle: newHandle },
      select: { handle: true },
    });
    revalidatePath(`/community/members/${ctx.member.handle}`);
    revalidatePath(`/community/members/${updated.handle}`);
    revalidatePath('/community/settings');
    return ok({ handle: updated.handle });
  } catch (e) {
    return handleError(e);
  }
}

// ─────────────── Notifications (community-scoped) ─────────────────────────

const markNotifReadSchema = z.object({ notificationId: z.string().min(1) });

export async function markCommunityNotificationRead(
  input: z.input<typeof markNotifReadSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireUser();
    const parsed = markNotifReadSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');

    const row = await prisma.notification.findUnique({
      where: { id: parsed.data.notificationId },
      select: { id: true, userId: true, readAt: true },
    });
    if (!row) return err('notFound');
    if (row.userId !== ctx.userId) throw new CommunityError('forbidden');
    if (row.readAt) return ok();
    await prisma.notification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    revalidatePath('/community/notifications');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}

export async function markAllCommunityNotificationsRead(): Promise<ActionResult<{ updated: number }>> {
  try {
    const ctx = await requireUser();
    const r = await prisma.notification.updateMany({
      where: {
        userId: ctx.userId,
        readAt: null,
        payload: { path: ['surface'], equals: 'community' },
      },
      data: { readAt: new Date() },
    });
    revalidatePath('/community/notifications');
    return ok({ updated: r.count });
  } catch (e) {
    return handleError(e);
  }
}
