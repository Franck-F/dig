import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../_components/viewer';
import AutoMarkRead from '@/components/notifications/AutoMarkRead';
import MarkAllReadButton from '@/components/notifications/MarkAllReadButton';
import { targetFor } from '@/components/notifications/targetFor';

/**
 * Community notifications inbox — Gmail-style master / detail layout.
 *
 * Left rail: chronological list grouped by day (Aujourd'hui / Hier /
 * Plus tôt). The currently selected row pops with a left accent bar
 * and a soft violet wash; unread rows carry a dot.
 *
 * Right pane: full content of the selected notification — message,
 * timestamp, deep link to the originating thread / channel / profile.
 * On open we auto-mark the notification read via `<AutoMarkRead />`.
 *
 * URL contract: `/community/notifications?selected=<id>`. Server-
 * rendered both ways so reload, share-link and back-button all work
 * without client state. When `selected` is missing or invalid we
 * default to the first notification — saves the user a click.
 *
 * Mobile: the grid collapses to a single column. With no selection
 * we show the list; with a selection we show only the detail and a
 * "← Retour" link to clear the param.
 */

const COMMUNITY_TYPES = [
  'POST_REPLY',
  'COMMENT_REPLY',
  'MENTION',
  'REACTION_RECEIVED',
  'CHANNEL_INVITE',
  'CHANNEL_JOIN_REQUESTED',
  'CHANNEL_JOIN_APPROVED',
  'MODERATION_ACTION',
  'BADGE_AWARDED',
  'CHALLENGE_NEW',
  'CHALLENGE_RESULT',
  'CHALLENGE_VOTE_RECEIVED',
  'REPORT_RECEIVED',
] as const;

type Bucket = 'today' | 'yesterday' | 'earlier';

function dayBucket(d: Date): Bucket {
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  if (ms < 24 * 60 * 60 * 1000 && now.getDate() === d.getDate()) return 'today';
  if (ms < 48 * 60 * 60 * 1000) return 'yesterday';
  return 'earlier';
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.notifications');
  return { title: t('metaTitle') };
}

type Search = { selected?: string };

export default async function CommunityNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const t = await getTranslations('community.notifications');
  const sp = await searchParams;
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect('/login?next=/community/notifications');
  }
  if (viewer.kind === 'logged-in-no-member') {
    redirect('/community/onboarding');
  }

  const items = await prisma.notification.findMany({
    where: {
      userId: viewer.user.id,
      OR: [{ type: { in: COMMUNITY_TYPES as unknown as string[] } as never }],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const grouped: Record<Bucket, typeof items> = { today: [], yesterday: [], earlier: [] };
  for (const it of items) grouped[dayBucket(it.createdAt)].push(it);

  // Resolve the selected notification — only when a valid `selected`
  // param is present. We deliberately do NOT auto-select the first
  // item: on mobile the layout collapses based on whether a selection
  // exists, and auto-selecting would skip the list view entirely.
  // Desktop simply shows an empty-state in the right pane until the
  // user clicks an item.
  const selectedId = sp.selected;
  const selected = selectedId
    ? items.find((i) => i.id === selectedId) ?? null
    : null;

  const unreadCount = items.filter((i) => !i.readAt).length;

  const buildHref = (id: string | null) => {
    const params = new URLSearchParams();
    if (id) params.set('selected', id);
    const qs = params.toString();
    return `/community/notifications${qs ? `?${qs}` : ''}`;
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

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('metaTitle'), url: '/community/notifications' },
          ]),
        )}
      />

      {selected && !selected.readAt && (
        <AutoMarkRead notificationId={selected.id} alreadyRead={false} />
      )}

      <section
        className="dz-section dz-notif"
        style={{ paddingTop: 32, paddingBottom: 48 }}
      >
        <header
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <h1 className="dz-h1" style={{ margin: 0, fontSize: 36 }}>
              {t('title')}
            </h1>
            <p className="dz-small" style={{ marginTop: 4 }}>
              {t('subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MarkAllReadButton unreadCount={unreadCount} />
            <Link
              href="/mentora/dashboard/notifications"
              className="dz-btn dz-btn-ghost dz-btn-sm"
              style={{ fontSize: 12 }}
            >
              {t('crossLinkMentorat')}
            </Link>
          </div>
        </header>

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
                        const payload = (n.payload ?? {}) as { actor?: string };
                        const messageKey = `types.${n.type}`;
                        const message = t.has(messageKey)
                          ? t(messageKey, { actor: payload.actor ?? '' })
                          : (n.type as string);
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
                const payload = (selected.payload ?? {}) as {
                  actor?: string;
                  href?: string;
                  context?: string;
                };
                const messageKey = `types.${selected.type}`;
                const message = t.has(messageKey)
                  ? t(messageKey, { actor: payload.actor ?? '' })
                  : (selected.type as string);
                // Deep-link priority: explicit `href` from the payload
                // (tag-injected by the action layer) > the shared
                // type-based router > nothing (informational notif).
                const href =
                  payload.href ??
                  targetFor(selected.type as string, (selected.payload ?? {}) as Record<string, unknown>);
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
                      {/* Title doubles as the deep-link when one exists.
                          Underlined-on-hover makes it discoverable
                          without adding a redundant "Open" button. */}
                      {href ? (
                        <Link
                          href={href}
                          className="dz-notif-title-link"
                          style={{
                            color: '#1a1f3a',
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}
                        >
                          <h2
                            style={{
                              margin: 0,
                              fontSize: 22,
                              fontWeight: 800,
                              lineHeight: 1.3,
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {message}
                          </h2>
                        </Link>
                      ) : (
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
                      )}
                      <p style={{ marginTop: 8, fontSize: 13, color: '#8b91ad' }}>
                        {dateFmtFull.format(selected.createdAt)}
                      </p>
                    </div>

                    {payload.context && (
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
                        {payload.context}
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
          /* Mobile collapse: single column, hide one pane based on
             the selection state. The data attribute on the grid drives
             which pane shows. */
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
          .dz-notif-title-link:hover h2 {
            text-decoration: underline;
            text-decoration-color: #7301FF;
            text-underline-offset: 4px;
            text-decoration-thickness: 2px;
          }
        `}</style>
      </section>
    </>
  );
}
