import 'server-only';
import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notify, type NotifyPayload } from '@/lib/mentora/notifications';

/**
 * Community-side helpers around the shared `Notification` table. Spec §7.
 *
 * - `createCommunityNotification` always tags `payload.surface = 'community'`
 *   so the bell UI can split Mentora vs Community streams client-side.
 * - `notifyReactionDebounced` enforces the 30-min window from §3.7 to prevent
 *   reaction-notif spam.
 * - `getUnreadCount` is a tiny aggregator the Mentora bell can call alongside
 *   its own counter.
 *
 * Email is **only** sent for MODERATION_ACTION (handled here by passing
 * `email: true`). The Mentora `notify()` defaults to its own EMAIL_ENABLED
 * map for known-Mentora types and otherwise no-ops, so `email: false` is the
 * safe default for community types.
 */

/** Always-on community notification — ensures the surface tag. */
export async function createCommunityNotification(
  userId: string,
  type: NotificationType,
  payload: NotifyPayload = {},
  opts: { email?: boolean } = {},
): Promise<{ id: string } | null> {
  return notify(
    userId,
    type,
    { ...payload, surface: 'community' },
    { email: opts.email ?? false },
  );
}

const REACTION_DEBOUNCE_MS = 30 * 60 * 1000; // 30 minutes per spec §3.7.

/**
 * Notify the author of a target (post/comment) that someone reacted, but only
 * if no REACTION_RECEIVED notif for the same target was created in the past
 * 30 minutes. Idempotent-ish — concurrent reactors will race; worst case the
 * author gets a couple of duplicate notifs in the same minute. Acceptable.
 */
export async function notifyReactionDebounced(args: {
  recipientUserId: string;
  targetType: 'POST' | 'COMMENT';
  targetId: string;
  payload?: NotifyPayload;
}): Promise<void> {
  const { recipientUserId, targetType, targetId, payload = {} } = args;
  try {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: recipientUserId,
        type: 'REACTION_RECEIVED',
        payload: { path: ['targetId'], equals: targetId },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    if (existing && Date.now() - existing.createdAt.getTime() < REACTION_DEBOUNCE_MS) {
      return;
    }
    await createCommunityNotification(recipientUserId, 'REACTION_RECEIVED', {
      ...payload,
      targetType,
      targetId,
    });
  } catch (e) {
    console.error('[community notifications] notifyReactionDebounced', e);
  }
}

/**
 * Count unread community-tagged notifications. The Mentora bell already
 * counts notifications in the same table; the community badge is layered on
 * top by filtering on `payload.surface = 'community'`.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
      payload: {
        path: ['surface'],
        equals: 'community',
      } as Prisma.JsonNullableFilter<'Notification'>,
    },
  });
}
