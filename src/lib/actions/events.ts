'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { CommunityEventKind, CommunityEventFormat } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { logAdmin } from '@/lib/audit/log';

/**
 * Community events — listing, registration, and host-side CRUD.
 *
 * Hosting is gated to admins + community moderators (covered by the
 * existing `getCommunityViewer().isModerator` flag). Any signed-in
 * user can register / unregister.
 *
 * The public listing on /community/events shows non-cancelled events
 * scheduled in the next 90 days, ordered by startsAt ASC; the live
 * banner picks `isLive === true`.
 */

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  kind: z.nativeEnum(CommunityEventKind),
  format: z.nativeEnum(CommunityEventFormat).default(CommunityEventFormat.REMOTE_VIDEO),
  startsAt: z.coerce.date(),
  durationMin: z.number().int().min(15).max(480).default(60),
  location: z.string().trim().max(500).optional().nullable(),
  meetingUrl: z.string().url().max(2048).optional().nullable(),
  capacity: z.number().int().positive().max(10_000).optional().nullable(),
});

async function requireHost(): Promise<
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

export async function createCommunityEvent(
  input: z.input<typeof createSchema>,
): Promise<{ status: 'success'; id: string } | { status: 'error'; error: string }> {
  const guard = await requireHost();
  if (!guard.ok) return { status: 'error', error: guard.error };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'invalid_input' };
  }

  try {
    const row = await prisma.communityEvent.create({
      data: { ...parsed.data, hostId: guard.userId },
      select: { id: true },
    });
    await logAdmin(guard.userId, {
      action: 'communityEvent.create',
      targetType: 'CommunityEvent',
      targetId: row.id,
      payload: { kind: parsed.data.kind, startsAt: parsed.data.startsAt.toISOString() },
    }).catch(() => {});
    revalidatePath('/community/events');
    return { status: 'success', id: row.id };
  } catch {
    return { status: 'error', error: 'create_failed' };
  }
}

export async function cancelCommunityEvent(
  id: string,
): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const guard = await requireHost();
  if (!guard.ok) return { status: 'error', error: guard.error };

  try {
    const existing = await prisma.communityEvent.findUnique({
      where: { id },
      select: { hostId: true },
    });
    if (!existing) return { status: 'error', error: 'not_found' };
    if (!guard.isAdmin && existing.hostId !== guard.userId) {
      return { status: 'error', error: 'forbidden' };
    }
    await prisma.communityEvent.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });
    revalidatePath('/community/events');
    return { status: 'success' };
  } catch {
    return { status: 'error', error: 'cancel_failed' };
  }
}

/**
 * Toggle the `isLive` flag — used by hosts to flip the gradient
 * banner on /community/events when they go live. Auto-flipped off
 * by a future cron once startsAt + durationMin elapses.
 */
export async function setCommunityEventLive(
  id: string,
  isLive: boolean,
): Promise<{ status: 'success' } | { status: 'error'; error: string }> {
  const guard = await requireHost();
  if (!guard.ok) return { status: 'error', error: guard.error };

  try {
    const existing = await prisma.communityEvent.findUnique({
      where: { id },
      select: { hostId: true },
    });
    if (!existing) return { status: 'error', error: 'not_found' };
    if (!guard.isAdmin && existing.hostId !== guard.userId) {
      return { status: 'error', error: 'forbidden' };
    }
    await prisma.communityEvent.update({
      where: { id },
      data: { isLive },
    });
    revalidatePath('/community/events');
    return { status: 'success' };
  } catch {
    return { status: 'error', error: 'update_failed' };
  }
}

/**
 * Toggle a viewer's registration. Idempotent: the unique
 * `(eventId, userId)` constraint means we upsert with a soft
 * `cancelledAt` flip rather than insert/delete.
 */
export async function toggleEventRegistration(
  eventId: string,
): Promise<
  | { status: 'success'; registered: boolean }
  | { status: 'error'; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: 'error', error: 'unauthorized' };

  try {
    const event = await prisma.communityEvent.findUnique({
      where: { id: eventId },
      select: { id: true, capacity: true, cancelledAt: true },
    });
    if (!event) return { status: 'error', error: 'not_found' };
    if (event.cancelledAt) return { status: 'error', error: 'event_cancelled' };

    const existing = await prisma.communityEventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true, cancelledAt: true },
    });

    if (existing && existing.cancelledAt == null) {
      // Already registered → cancel.
      await prisma.communityEventRegistration.update({
        where: { id: existing.id },
        data: { cancelledAt: new Date() },
      });
      revalidatePath('/community/events');
      return { status: 'success', registered: false };
    }

    // Capacity guard only applies on (re)registration.
    if (event.capacity != null) {
      const activeCount = await prisma.communityEventRegistration.count({
        where: { eventId, cancelledAt: null },
      });
      if (activeCount >= event.capacity) {
        return { status: 'error', error: 'capacity_reached' };
      }
    }

    if (existing) {
      await prisma.communityEventRegistration.update({
        where: { id: existing.id },
        data: { cancelledAt: null, registeredAt: new Date() },
      });
    } else {
      await prisma.communityEventRegistration.create({
        data: { eventId, userId },
      });
    }
    revalidatePath('/community/events');
    return { status: 'success', registered: true };
  } catch {
    return { status: 'error', error: 'register_failed' };
  }
}

// ── Read helpers ──────────────────────────────────────────────────────

export async function listUpcomingCommunityEvents(opts: { limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return prisma.communityEvent.findMany({
    where: {
      cancelledAt: null,
      startsAt: { gte: now, lt: horizon },
    },
    orderBy: { startsAt: 'asc' },
    take: limit,
    include: {
      host: {
        select: { name: true, firstName: true, lastName: true, email: true },
      },
      _count: {
        select: { registrations: { where: { cancelledAt: null } } },
      },
    },
  });
}

export async function getMyEventRegistrations(userId: string) {
  return prisma.communityEventRegistration.findMany({
    where: { userId, cancelledAt: null, event: { cancelledAt: null } },
    orderBy: { event: { startsAt: 'asc' } },
    include: {
      event: { select: { id: true, title: true, startsAt: true, kind: true } },
    },
  });
}

export async function getCurrentLiveEvent() {
  return prisma.communityEvent.findFirst({
    where: { isLive: true, cancelledAt: null },
    orderBy: { startsAt: 'desc' },
    include: {
      host: { select: { name: true, firstName: true, lastName: true } },
      _count: { select: { registrations: { where: { cancelledAt: null } } } },
    },
  });
}
