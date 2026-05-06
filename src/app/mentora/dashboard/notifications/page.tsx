import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { markAllNotificationsRead } from '@/lib/actions/mentora/notifications';
import NotificationItem from './NotificationItem';
import { dayBucket } from '../_components/format';

type Bucket = 'today' | 'yesterday' | 'earlier';

/**
 * Notifications inbox.
 *
 * Loads the most recent 100 notifications for the current user, groups them
 * by date bucket (today / yesterday / earlier), and exposes a "mark all read"
 * server action button.
 *
 * Per-item mark-read is handled by `NotificationItem` which calls the
 * matching server action when the item is clicked or its inline button is
 * pressed.
 */
export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/notifications');

  const userId = session.user.id;
  const t = await getTranslations('mentora.notifications');

  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const grouped: Record<Bucket, typeof items> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const it of items) {
    grouped[dayBucket(it.createdAt)].push(it);
  }

  async function markAll() {
    'use server';
    // Cast away the action arg shape — spec says `{}`, but upstream's actual
    // signature may evolve. We pass no payload either way.
    const fn = markAllNotificationsRead as unknown as () => Promise<unknown>;
    await fn();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1 className="dz-h2" style={{ fontSize: 24 }}>{t('title')}</h1>
            <p className="dz-body" style={{ marginTop: 6 }}>{t('subtitle')}</p>
          </div>
          {items.some((i) => !i.readAt) && (
            <form action={markAll}>
              <button type="submit" className="dz-btn dz-btn-ghost dz-btn-sm">
                {t('markAllRead')}
              </button>
            </form>
          )}
        </header>
      </div>

      {items.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body">{t('empty')}</p>
        </div>
      ) : (
        (['today', 'yesterday', 'earlier'] as const).map((bucket) =>
          grouped[bucket].length === 0 ? null : (
            <section key={bucket} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="dz-h2" style={{ fontSize: 14, color: '#646A82', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t(`groups.${bucket}`)}
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[bucket].map((n) => (
                  <li key={n.id}>
                    <NotificationItem
                      id={n.id}
                      type={n.type}
                      payload={(n.payload ?? {}) as Record<string, unknown>}
                      createdAt={n.createdAt.toISOString()}
                      readAt={n.readAt ? n.readAt.toISOString() : null}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ),
        )
      )}
    </div>
  );
}
