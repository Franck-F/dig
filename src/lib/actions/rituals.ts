'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { logAdmin } from '@/lib/audit/log';

/**
 * Community rituals — weekly planner backing
 * /community/admin/animation. Only admins + community moderators
 * can create / edit / delete rituals.
 *
 * Rituals are simple recurring blocks (dayOfWeek 0..6, time-of-day
 * minute, duration). They feed the planner grid; converting them
 * into one-shot CommunityEvent rows for a given week is left to
 * a future "publish to next week" action.
 */

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  durationMin: z.number().int().min(15).max(480).default(60),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'invalid_color')
    .default('#7301FF'),
  isPublished: z.boolean().default(false),
});

async function requireMod(): Promise<
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; error: 'unauthorized' | 'forbidden' }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };
  const me = await prisma.user
    .findUnique({
      where: { id: userId },
      select: {
        role: true,
        communityMember: { select: { isModerator: true } },
      },
    })
    .catch(() => null);
  if (!me) return { ok: false, error: 'unauthorized' };
  const isAdmin = me.role === 'ADMIN';
  const isMod = Boolean(me.communityMember?.isModerator);
  if (!isAdmin && !isMod) return { ok: false, error: 'forbidden' };
  return { ok: true, userId, isAdmin };
}

export async function createCommunityRitual(
  input: z.input<typeof createSchema>,
): Promise<{ status: 'success'; id: string } | { status: 'error'; error: string }> {
  const guard = await requireMod();
  if (!guard.ok) return { status: 'error', error: guard.error };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  try {
    const row = await prisma.communityRitual.create({
      data: { ...parsed.data, createdById: guard.userId },
      select: { id: true },
    });
    await logAdmin(guard.userId, {
      action: 'communityRitual.create',
      targetType: 'CommunityRitual',
      targetId: row.id,
    }).catch(() => {});
    revalidatePath('/community/admin/animation');
    return { status: 'success', id: row.id };
  } catch {
    return { status: 'error', error: 'create_failed' };
  }
}

export async function deleteCommunityRitual(
  id: string,
): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const guard = await requireMod();
  if (!guard.ok) return { status: 'error', error: guard.error };
  try {
    const existing = await prisma.communityRitual.findUnique({
      where: { id },
      select: { createdById: true },
    });
    if (!existing) return { status: 'error', error: 'not_found' };
    if (!guard.isAdmin && existing.createdById !== guard.userId) {
      return { status: 'error', error: 'forbidden' };
    }
    await prisma.communityRitual.delete({ where: { id } });
    revalidatePath('/community/admin/animation');
    return { status: 'success' };
  } catch {
    return { status: 'error', error: 'delete_failed' };
  }
}

export async function listRitualsByDayOfWeek() {
  return prisma.communityRitual.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
  });
}

// ── Broadcast notification ───────────────────────────────────────────
//
// "Annonce communauté" textarea — pushes a Notification row to every
// active community member. Cap at 5 000 recipients per call so we
// don't fan-out to the whole DB if someone pastes a million-row
// audience by mistake; further scaling lives in the email queue.

const broadcastSchema = z.object({
  body: z.string().trim().min(2).max(500),
});

export async function broadcastCommunityAnnouncement(
  input: z.input<typeof broadcastSchema>,
): Promise<
  | { status: 'success'; recipientCount: number }
  | { status: 'error'; error: string }
> {
  const guard = await requireMod();
  if (!guard.ok) return { status: 'error', error: guard.error };

  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  try {
    // Resolve audience: every signed-in user with an active community
    // member row. We do NOT email — the broadcast lands in-app via
    // the existing Notification table. Email blasts have their own
    // deliberate throttling story (see /lib/actions/newsletter).
    const recipients = await prisma.communityMember.findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true },
      take: 5000,
    });

    if (recipients.length === 0) {
      return { status: 'error', error: 'no_recipients' };
    }

    // Bulk insert. createMany skips per-row IDs so we generate them
    // server-side via cuid (Prisma's default).
    const now = new Date();
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.userId,
        type: NotificationType.MODERATION_ACTION,
        payload: {
          kind: 'community_broadcast',
          body: parsed.data.body,
          actorId: guard.userId,
        },
        createdAt: now,
      })),
      skipDuplicates: true,
    });

    await logAdmin(guard.userId, {
      action: 'communityBroadcast.send',
      targetType: 'CommunityBroadcast',
      payload: {
        recipientCount: recipients.length,
        bodyPreview: parsed.data.body.slice(0, 200),
      },
    }).catch(() => {});

    revalidatePath('/community/admin/animation');
    return { status: 'success', recipientCount: recipients.length };
  } catch {
    return { status: 'error', error: 'broadcast_failed' };
  }
}
