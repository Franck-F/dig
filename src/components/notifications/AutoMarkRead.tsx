'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { markNotificationRead } from '@/lib/actions/mentora/notifications';

/**
 * Mounts only when a notification is selected and unread. Fires
 * `markNotificationRead` once and refreshes the route so the row's
 * unread dot disappears + the bell counter ticks down. Mirrors
 * Gmail's behaviour: opening a message marks it read.
 *
 * Guarded by a ref-flag so a re-render of the parent (e.g. user
 * navigates away and back to the same id) doesn't re-fire the
 * action on a row that's already read.
 *
 * Shared between `/community/notifications` and
 * `/mentora/dashboard/notifications` — the underlying action
 * revalidates both surfaces so either page picks up the change.
 */
export default function AutoMarkRead({
  notificationId,
  alreadyRead,
}: {
  notificationId: string;
  alreadyRead: boolean;
}) {
  const router = useRouter();
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (alreadyRead) return;
    if (fired.current === notificationId) return;
    fired.current = notificationId;
    void markNotificationRead({ notificationId }).then(() => {
      router.refresh();
    });
  }, [notificationId, alreadyRead, router]);

  return null;
}
