'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markAllNotificationsRead } from '@/lib/actions/mentora/notifications';

/**
 * Compact inline action — visible only when the user has unread
 * notifications. Fires the bulk-mark action and refreshes the route
 * so the right pane and the bell counter both reset together.
 *
 * Shared between Community and Mentora notification inboxes.
 */
export default function MarkAllReadButton({
  unreadCount,
  label = 'Tout marquer comme lu',
  pendingLabel = 'En cours…',
}: {
  unreadCount: number;
  label?: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (unreadCount === 0) return null;

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
      disabled={pending}
      className="dz-btn dz-btn-ghost dz-btn-sm"
      style={{ fontSize: 12 }}
    >
      {pending ? pendingLabel : `${label} (${unreadCount})`}
    </button>
  );
}
