import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * NotificationBell — displays in the dashboard header strip.
 *
 * Server component (no `use client`): the unread count is computed by the
 * layout (cached at request scope) and passed in as a prop. Re-renders on
 * every dashboard navigation, which is sufficient for v1 — we deliberately
 * skip client-side polling here to keep the layout lightweight.
 */
export default async function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const t = await getTranslations('mentora.notifications.bell');

  return (
    <Link
      href="/mentora/dashboard/notifications"
      aria-label={t('ariaLabel')}
      title={unreadCount > 0 ? t('unread', { count: unreadCount }) : t('viewAll')}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 10,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 120ms',
        background: 'transparent',
      }}
    >
      <BellIcon />
      {unreadCount > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 999,
            background: '#F46FB1',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
