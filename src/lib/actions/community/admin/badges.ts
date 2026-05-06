'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { BadgeKind } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  type ActionResult,
  err,
  handleError,
  ok,
  requireCommunityAdmin,
} from '../_helpers';
import { createCommunityNotification } from '@/lib/community/notifications';

/**
 * Admin badge actions. Spec §5.2 badges admin.
 *
 *  - Manual `awardBadge`: only badges where `Badge.isAuto = false`.
 *  - Manual `revokeBadge`: any badge; recorded as a moderation action.
 */

const awardSchema = z.object({
  memberId: z.string().min(1),
  badgeKind: z.nativeEnum(BadgeKind),
  note: z.string().max(200).optional(),
});

export async function awardBadge(
  input: z.input<typeof awardSchema>,
): Promise<ActionResult<{ memberBadgeId: string }>> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = awardSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const badge = await prisma.badge.findUnique({ where: { kind: parsed.data.badgeKind } });
    if (!badge) return err('notFound');
    if (badge.isAuto) return err('badgeNotManual');
    const member = await prisma.communityMember.findUnique({
      where: { id: parsed.data.memberId },
      select: { id: true, userId: true, handle: true },
    });
    if (!member) return err('notFound');

    const existing = await prisma.memberBadge.findUnique({
      where: { memberId_badgeId: { memberId: member.id, badgeId: badge.id } },
    });
    if (existing) return ok({ memberBadgeId: existing.id });

    const created = await prisma.$transaction(async (tx) => {
      const mb = await tx.memberBadge.create({
        data: {
          memberId: member.id,
          badgeId: badge.id,
          awardedById: ctx.member.id,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });
      await tx.moderationAction.create({
        data: {
          type: 'GRANT_BADGE',
          actorId: ctx.member.id,
          targetMemberId: member.id,
          badgeId: badge.id,
          reason: parsed.data.note ?? null,
        },
      });
      return mb;
    });
    await createCommunityNotification(member.userId, 'BADGE_AWARDED', {
      badgeKind: parsed.data.badgeKind,
      badgeSlug: badge.slug,
      manual: true,
    });
    revalidatePath(`/community/members/${member.handle}`);
    revalidatePath('/community/admin/badges');
    return ok({ memberBadgeId: created.id });
  } catch (e) {
    return handleError(e);
  }
}

const revokeSchema = z.object({ memberBadgeId: z.string().min(1) });

export async function revokeBadge(
  input: z.input<typeof revokeSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requireCommunityAdmin();
    const parsed = revokeSchema.safeParse(input);
    if (!parsed.success) return err('invalidInput');
    const mb = await prisma.memberBadge.findUnique({
      where: { id: parsed.data.memberBadgeId },
      include: { member: { select: { handle: true, id: true } } },
    });
    if (!mb) return err('notFound');
    await prisma.$transaction([
      prisma.memberBadge.delete({ where: { id: mb.id } }),
      prisma.moderationAction.create({
        data: {
          type: 'REVOKE_BADGE',
          actorId: ctx.member.id,
          targetMemberId: mb.member.id,
          badgeId: mb.badgeId,
        },
      }),
    ]);
    revalidatePath(`/community/members/${mb.member.handle}`);
    revalidatePath('/community/admin/badges');
    return ok();
  } catch (e) {
    return handleError(e);
  }
}
