import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

import AutoMarkRead from '@/components/notifications/AutoMarkRead';
import MarkAllReadButton from '@/components/notifications/MarkAllReadButton';
import { targetFor } from '@/components/notifications/targetFor';
import { dayBucket } from '../_components/format';

type Bucket = 'today' | 'yesterday' | 'earlier';

/**
 * Mentora notifications inbox — Gmail-style master / detail layout.
 *
 * Identical UX to `/community/notifications`: left rail lists every
 * notification grouped by day with a unread-dot, right pane renders
 * the selected entry's full content with a deep-link "Ouvrir" button.
 * URL contract `?selected=<id>` keeps everything server-rendered so
 * back / reload / share-link all work without client state.
 *
 * Auto-mark-read mounts when an unread row is opened. The shared
 * `markNotificationRead` action revalidates both surfaces, so the
 * Community inbox and the bell counter refresh in lockstep.
 *
 * Mobile: collapses to single column, list ↔ detail driven by the
 * presence of `?selected=` (CSS at the bottom of this file).
 */
type Search = { selected?: string };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/notifications');

  const userId = session.user.id;
  const t = await getTranslations('mentora.notifications');
  const sp = await searchParams;

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
  for (const it of items) grouped[dayBucket(it.createdAt)].push(it);

  const selectedId = sp.selected;
  const selected = selectedId
    ? items.find((i) => i.id === selectedId) ?? null
    : null;

  const unreadCount = items.filter((i) => !i.readAt).length;

  const buildHref = (id: string | null) => {
    const params = new URLSearchParams();
    if (id) params.set('selected', id);
    const qs = params.toString();
    return `/mentora/dashboard/notifications${qs ? `?${qs}` : ''}`;
  };

  const dateFmt = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateFmtFull = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Defensive translator — types.<unknown> resolves to the raw key in
  // dev, which we don't want to leak. Same helper as NotificationItem
  // but inline since we only call it twice here.
  const safe = (key: string): string => {
    try {
      const v = t(key as Parameters<typeof t>[0]);
      if (typeof v === 'string' && v.startsWith('mentora.notifications.')) return '';
      return v;
    } catch {
      return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {selected && !selected.readAt && (
        <AutoMarkRead notificationId={selected.id} alreadyRead={false} />
      )}

      <div className="dz-card" style={{ padding: 24 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h1 className="dz-h2" style={{ fontSize: 26, margin: 0 }}>
              {t('title')}
            </h1>
            <p className="dz-body" style={{ marginTop: 6 }}>
              {t('subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MarkAllReadButton unreadCount={unreadCount} label={t('markAllRead')} />
            <Link
              href="/community/notifications"
              className="dz-btn dz-btn-ghost dz-btn-sm"
              style={{ fontSize: 12 }}
            >
              {safe('crossLinkCommunity') || 'Notifications Communauté →'}
            </Link>
          </div>
        </header>
      </div>

      {items.length === 0 ? (
        <div className="dz-card" style={{ padding: 48, textAlign: 'center' }}>
          <p className="dz-body">{t('empty')}</p>
        </div>
      ) : (
        <div
          className="dz-notif-grid"
          data-has-selection={selected ? 'true' : 'false'}
          style={{
            display: 'grid',
            gridTemplateColumns: '360px minmax(0, 1fr)',
            gap: 18,
            alignItems: 'flex-start',
          }}
        >
          {/* ── Left rail: list ─────────────────────────────── */}
          <aside
            className="dz-notif-list"
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 18,
              overflow: 'hidden',
              maxHeight: 'calc(100vh - 180px)',
              overflowY: 'auto',
              position: 'sticky',
              top: 96,
            }}
          >
            {(['today', 'yesterday', 'earlier'] as const).map((bucket) =>
              grouped[bucket].length === 0 ? null : (
                <section key={bucket}>
                  <h2
                    style={{
                      margin: 0,
                      padding: '12px 16px 6px',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#7301FF',
                      textTransform: 'uppercase',
                      letterSpacing: '0.10em',
                      background: 'rgba(115,1,255,0.04)',
                    }}
                  >
                    {t(`groups.${bucket}`)}
                  </h2>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {grouped[bucket].map((n) => {
                      const message = safe(`types.${n.type}`) || (n.type as string);
                      const isSelected = selected?.id === n.id;
                      return (
                        <li key={n.id}>
                          <Link
                            href={buildHref(n.id)}
                            prefetch={false}
                            style={{
                              display: 'flex',
                              gap: 10,
                              alignItems: 'flex-start',
                              padding: '14px 16px 14px 14px',
                              textDecoration: 'none',
                              color: 'inherit',
                              borderLeft: '3px solid',
                              borderLeftColor: isSelected ? '#7301FF' : 'transparent',
                              background: isSelected
                                ? 'rgba(115,1,255,0.08)'
                                : !n.readAt
                                  ? 'rgba(115,1,255,0.03)'
                                  : 'transparent',
                              borderTop: '1px solid rgba(115,1,255,0.06)',
                              transition: 'background 160ms ease',
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                width: 8,
                                height: 8,
                                marginTop: 6,
                                borderRadius: '50%',
                                background: n.readAt ? 'rgba(115,1,255,0.18)' : '#7301FF',
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: n.readAt ? 500 : 700,
                                  color: '#1a1f3a',
                                  lineHeight: 1.4,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                {message}
                              </div>
                              <div style={{ fontSize: 11, color: '#8b91ad', marginTop: 4 }}>
                                {dateFmt.format(n.createdAt)}
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ),
            )}
          </aside>

          {/* ── Right pane: detail ──────────────────────────── */}
          <main
            className="dz-notif-detail"
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 18,
              padding: '28px 32px',
              minHeight: 320,
            }}
          >
            {selected ? (() => {
              const payload = (selected.payload ?? {}) as Record<string, unknown>;
              const message = safe(`types.${selected.type}`) || (selected.type as string);
              const body = safe(`bodies.${selected.type}`);
              const href =
                (typeof payload.href === 'string' ? payload.href : null) ??
                targetFor(selected.type as string, payload);
              return (
                <article style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <Link
                    href={buildHref(null)}
                    className="dz-notif-back"
                    style={{
                      display: 'none',
                      fontSize: 13,
                      color: '#7301FF',
                      textDecoration: 'none',
                      marginBottom: 4,
                    }}
                  >
                    ← Retour à la liste
                  </Link>
                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: 'rgba(115,1,255,0.10)',
                        color: '#7301FF',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: 10,
                      }}
                    >
                      {selected.readAt ? 'Lu' : 'Non lu'}
                    </span>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 800,
                        color: '#1a1f3a',
                        lineHeight: 1.3,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {message}
                    </h2>
                    <p style={{ marginTop: 8, fontSize: 13, color: '#8b91ad' }}>
                      {dateFmtFull.format(selected.createdAt)}
                    </p>
                  </div>

                  {body && (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'rgba(115,1,255,0.04)',
                        border: '1px solid rgba(115,1,255,0.10)',
                        fontSize: 14,
                        color: '#3a2960',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {body}
                    </div>
                  )}

                  {href && (
                    <div>
                      <Link
                        href={href}
                        className="dz-btn dz-btn-primary"
                        style={{ display: 'inline-flex' }}
                      >
                        {t('open')} →
                      </Link>
                    </div>
                  )}
                </article>
              );
            })() : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '64px 24px',
                  color: '#8b91ad',
                }}
              >
                <p className="dz-body">Sélectionne une notification dans la liste à gauche.</p>
              </div>
            )}
          </main>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .dz-notif-grid { grid-template-columns: 1fr !important; }
          .dz-notif-list {
            position: static !important;
            max-height: none !important;
          }
          .dz-notif-grid[data-has-selection='true'] .dz-notif-list { display: none; }
          .dz-notif-grid[data-has-selection='false'] .dz-notif-detail { display: none; }
          .dz-notif-grid[data-has-selection='true'] .dz-notif-back { display: inline-block !important; }
        }
      `}</style>
    </div>
  );
}
