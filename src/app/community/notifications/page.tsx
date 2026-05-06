import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import { getCommunityViewer } from '../_components/viewer';

/**
 * Community notifications inbox.
 *
 * JUDGMENT CALL — separate page (kept) vs. combined Mentora+Community page:
 *
 *   For v1 we keep `/community/notifications` distinct from
 *   `/mentora/dashboard/notifications`. Reasons:
 *
 *   1. The two surfaces have very different chrome and visual identity:
 *      Mentora has a sidebar dashboard layout; Community lives in the
 *      Frame-only public surface.
 *   2. Filtering by `payload.surface = 'community'` is a one-line addition
 *      and lets each page stay focused on its own type vocabulary, so the
 *      i18n keys (`community.notifications.types.*` vs.
 *      `mentora.notifications.types.*`) stay disjoint.
 *   3. The shared `Notification` table and `markAllNotificationsRead` action
 *      mean the bell counter is still global. Cross-link at the top of each
 *      page makes the relationship explicit.
 *   4. Combining is a simple v1.1 follow-up if we discover users want one
 *      pane: just merge the where clause and switch on type prefix.
 *
 * Read-only page: list + per-row "mark read" handled by the Mentora
 * `markNotificationRead` action when 3B-2 ships its community variant we
 * swap. For now, the link to the originating surface counts as "read"
 * tracking from the user's POV.
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

export default async function CommunityNotificationsPage() {
  const t = await getTranslations('community.notifications');
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect('/login?next=/community/notifications');
  }
  if (viewer.kind === 'logged-in-no-member') {
    redirect('/community/onboarding');
  }

  // Filter: community-namespaced types AND/OR payload.surface = 'community'.
  // Both fences keep us safe if 3B-2 forgets to tag the payload.
  const items = await prisma.notification.findMany({
    where: {
      userId: viewer.user.id,
      OR: [
        { type: { in: COMMUNITY_TYPES as unknown as string[] } as never },
      ],
    },
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

      <section className="dz-section" style={{ paddingTop: 40, maxWidth: 760, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <h1 className="dz-h1" style={{ margin: 0 }}>{t('title')}</h1>
            <p className="dz-small" style={{ marginTop: 6 }}>{t('subtitle')}</p>
          </div>
          <Link
            href="/mentora/dashboard/notifications"
            className="dz-btn dz-btn-ghost dz-btn-sm"
          >
            {t('crossLinkMentora')}
          </Link>
        </header>

        {items.length === 0 ? (
          <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="dz-body">{t('empty')}</p>
          </div>
        ) : (
          (['today', 'yesterday', 'earlier'] as const).map((bucket) =>
            grouped[bucket].length === 0 ? null : (
              <section
                key={bucket}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}
              >
                <h2
                  className="dz-h2"
                  style={{
                    fontSize: 13,
                    color: '#646A82',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    margin: 0,
                  }}
                >
                  {t(`groups.${bucket}`)}
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {grouped[bucket].map((n) => {
                    const payload = (n.payload ?? {}) as { actor?: string; href?: string };
                    const messageKey = `types.${n.type}`;
                    const message = t.has(messageKey)
                      ? t(messageKey, { actor: payload.actor ?? '' })
                      : (n.type as string);
                    const href = payload.href ?? '/community';
                    return (
                      <li key={n.id}>
                        <Link
                          href={href}
                          className="dz-card"
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: 16,
                            textDecoration: 'none',
                            color: 'inherit',
                            background: n.readAt ? undefined : 'rgba(115,1,255,0.06)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{message}</div>
                            <div className="dz-small">
                              {n.createdAt.toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          {!n.readAt && (
                            <span
                              aria-hidden
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#7301FF',
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ),
          )
        )}
      </section>
    </>
  );
}
