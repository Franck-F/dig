import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Mascot3D from '@/components/Mascot3D';
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import FeedFilters from './FeedFilters';
import PostCard, { type PostCardData } from './PostCard';
import SoftPaywall from './SoftPaywall';

export type PublicLandingSearchParams = {
  channel?: string;
  cursor?: string;
};

const PAGE_SIZE = 20;

function bodyExcerpt(raw: string, max = 280): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/**
 * Public-facing community landing — shown to unauthenticated visitors.
 *
 * Hero, value props, channel showcase, and a public read-only feed with a
 * soft paywall that nudges visitors to sign up before posting/reacting.
 *
 * Authenticated users never see this page — `community/page.tsx` dispatches
 * them to `<ConnectedFeed>` inside the `AppShell` instead.
 */
export default async function PublicLanding({
  searchParams,
}: {
  searchParams: PublicLandingSearchParams;
}) {
  const t = await getTranslations('community');
  const tCommon = await getTranslations('common');

  const cursorRaw = searchParams.cursor ?? null;
  const cursorDate = cursorRaw
    ? new Date(Buffer.from(cursorRaw, 'base64').toString('utf8'))
    : null;

  const allChannels = await prisma.channel.findMany({
    where: { archivedAt: null, type: { in: ['PUBLIC', 'ANNOUNCEMENT'] } },
    orderBy: [{ isDefault: 'desc' }, { position: 'asc' }, { name: 'asc' }],
    select: {
      slug: true,
      name: true,
      description: true,
      emoji: true,
      coverColor: true,
      isDefault: true,
      type: true,
      _count: { select: { memberships: true, posts: true } },
    },
    take: 12,
  });

  const channelFilter = searchParams.channel
    ? allChannels.find((c) => c.slug === searchParams.channel)
    : null;

  const [memberCount, postCount, channelCount] = await Promise.all([
    prisma.communityMember.count({ where: { status: 'ACTIVE' } }),
    prisma.post.count({ where: { status: 'PUBLISHED' } }),
    prisma.channel.count({ where: { archivedAt: null } }),
  ]);

  const where: {
    status: 'PUBLISHED';
    channel: {
      archivedAt: null;
      type?: { in: Array<'PUBLIC' | 'ANNOUNCEMENT'> };
      slug?: string;
    };
    publishedAt?: { lt: Date };
  } = {
    status: 'PUBLISHED',
    channel: {
      archivedAt: null,
      type: { in: ['PUBLIC', 'ANNOUNCEMENT'] },
    },
  };
  if (channelFilter) {
    where.channel.slug = channelFilter.slug;
  }
  if (cursorDate && !Number.isNaN(cursorDate.getTime())) {
    where.publishedAt = { lt: cursorDate };
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
    take: PAGE_SIZE + 1,
    include: {
      author: { select: { handle: true, displayName: true, avatarUrl: true } },
      channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
      hashtags: { select: { tag: true } },
    },
  });

  const hasMore = posts.length > PAGE_SIZE;
  const visible = hasMore ? posts.slice(0, PAGE_SIZE) : posts;
  const last = visible[visible.length - 1];
  const nextCursor =
    hasMore && last?.publishedAt
      ? Buffer.from(last.publishedAt.toISOString(), 'utf8').toString('base64')
      : null;

  const cards: PostCardData[] = visible.map((p) => ({
    id: p.id,
    title: p.title,
    bodyExcerpt: bodyExcerpt(p.body),
    publishedAt: p.publishedAt,
    isPinned: p.isPinned,
    isLocked: p.isLocked,
    reactionCount: p.reactionCount,
    commentCount: p.commentCount,
    bookmarkCount: p.bookmarkCount,
    hashtags: p.hashtags.map((h) => h.tag),
    author: {
      handle: p.author.handle,
      displayName: p.author.displayName,
      avatarUrl: p.author.avatarUrl,
    },
    channel: {
      slug: p.channel.slug,
      name: p.channel.name,
      emoji: p.channel.emoji,
      coverColor: p.channel.coverColor,
    },
  }));

  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const trendingTags = await prisma.postHashtag
    .groupBy({
      by: ['tag'],
      where: { post: { publishedAt: { gte: sinceDate }, status: 'PUBLISHED' } },
      _count: { tag: true },
      orderBy: { _count: { tag: 'desc' } },
      take: 8,
    })
    .catch(() => [] as Array<{ tag: string; _count: { tag: number } }>);

  const valueProps = t.raw('feed.valueProps') as Array<{
    title: string;
    desc: string;
    accent: string;
  }>;

  return (
    <>
      <script
        {...jsonLdScriptProps(
          collectionPageJsonLd({
            url: '/community',
            name: t('feed.metaTitle'),
            description: t('feed.metaDescription'),
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: t('feed.metaTitle'), url: '/community' },
          ]),
        )}
      />

      {/* HERO */}
      <section className="dz-section" style={{ paddingTop: 40, paddingBottom: 24, maxWidth: 1560 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 40, alignItems: 'center' }}>
          <div>
            <div className="dz-eyebrow">
              <span className="dot" />
              {t('feed.eyebrow')}
            </div>
            <h1 className="dz-h1" style={{ marginTop: 18 }}>
              {t('feed.title')} <span className="dz-grad-text">{t('feed.titleHighlight')}</span>
            </h1>
            <p className="dz-body" style={{ fontSize: 19, marginTop: 22, maxWidth: 620 }}>
              {t('feed.heroBody')}
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
              <Link href="/login" className="dz-btn dz-btn-primary dz-btn-lg">
                {t('feed.joinCommunity')}
              </Link>
              <Link href="#feed" className="dz-btn dz-btn-ghost dz-btn-lg">
                {t('feed.exploreFeed')}
              </Link>
            </div>
            <div style={{ display: 'flex', gap: 40, marginTop: 44, flexWrap: 'wrap' }}>
              <div className="dz-stat">
                <div className="num dz-grad-text">{formatCount(memberCount)}</div>
                <div className="lbl">{t('feed.statsLabels.members')}</div>
              </div>
              <div className="dz-stat">
                <div className="num dz-grad-text">{formatCount(postCount)}</div>
                <div className="lbl">{t('feed.statsLabels.posts')}</div>
              </div>
              <div className="dz-stat">
                <div className="num dz-grad-text">{formatCount(channelCount)}</div>
                <div className="lbl">{t('feed.statsLabels.channels')}</div>
              </div>
            </div>
          </div>

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 460 }}>
            <Mascot3D
              src="/images/robot-mascotte-1.png"
              width={460}
              intensity={18}
              alt={tCommon('mascotAlt')}
            />
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="dz-section" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 className="dz-h2">
            {t('feed.valuePropsTitle')} <span className="dz-grad-text">{t('feed.valuePropsTitleHighlight')}</span>
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {valueProps.map((vp, i) => (
            <article
              key={i}
              className="dz-card"
              style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}
            >
              <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${vp.accent}, ${vp.accent}66)` }} />
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: vp.accent, boxShadow: `0 0 0 4px ${vp.accent}22` }} />
              <h3 className="dz-h3" style={{ fontSize: 20, margin: 0 }}>{vp.title}</h3>
              <p className="dz-body" style={{ fontSize: 15, margin: 0 }}>{vp.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CHANNEL SHOWCASE */}
      <section className="dz-section" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="dz-h2" style={{ fontSize: 36, margin: 0 }}>{t('feed.channelsExploreTitle')}</h2>
            <p className="dz-body" style={{ marginTop: 10, maxWidth: 560 }}>{t('feed.channelsExploreSubtitle')}</p>
          </div>
          <Link href="/community/channels" className="dz-btn dz-btn-ghost">{t('feed.seeAllChannels')}</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {allChannels.slice(0, 6).map((c) => {
            const accent = c.coverColor ?? '#7301FF';
            return (
              <Link
                key={c.slug}
                href={`/community/c/${c.slug}`}
                className="dz-card"
                style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 8, textDecoration: 'none', color: 'inherit', position: 'relative', overflow: 'hidden' }}
              >
                <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: accent }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</span>
                </div>
                {c.description && (
                  <p className="dz-small" style={{ fontSize: 13, margin: 0, color: '#545b7a' }}>{c.description}</p>
                )}
                <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                  <span className="dz-small" style={{ fontSize: 12 }}>{formatCount(c._count.memberships)} membres</span>
                  <span className="dz-small" style={{ fontSize: 12 }}>{formatCount(c._count.posts)} posts</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEED */}
      <section id="feed" className="dz-section" style={{ paddingTop: 40 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 className="dz-h2" style={{ fontSize: 36, margin: 0 }}>{t('feed.feedSectionTitle')}</h2>
          <p className="dz-small" style={{ marginTop: 6 }}>{t('feed.feedSectionSubtitle')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)', gap: 32, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <FeedFilters
              channels={allChannels.map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji, coverColor: c.coverColor }))}
              current={searchParams.channel ?? null}
            />
            <SoftPaywall variant="card" />
            {cards.length === 0 ? (
              <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
                <p className="dz-body">{t('feed.empty')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {cards.map((p) => (<PostCard key={p.id} post={p} />))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              {nextCursor ? (
                <Link
                  href={`/community?${new URLSearchParams({
                    ...(searchParams.channel ? { channel: searchParams.channel } : {}),
                    cursor: nextCursor,
                  }).toString()}#feed`}
                  className="dz-btn dz-btn-ghost dz-btn-sm"
                >
                  {t('feed.loadMore')} →
                </Link>
              ) : null}
            </div>
          </div>
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 88 }}>
            <div className="dz-card" style={{ padding: 20 }}>
              <h3 className="dz-small" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 12, color: '#8b91ad', fontWeight: 700 }}>
                {t('feed.channelsTitle')}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allChannels.slice(0, 6).map((c) => {
                  const accent = c.coverColor ?? '#7301FF';
                  return (
                    <li key={c.slug}>
                      <Link href={`/community/c/${c.slug}`} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 8px', borderRadius: 8, textDecoration: 'none', color: 'inherit', fontSize: 14 }}>
                        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flex: '0 0 auto' }} />
                        <span>{c.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link href="/community/channels" className="dz-small" style={{ marginTop: 10, display: 'inline-block', fontWeight: 600, color: '#7301FF' }}>
                {t('feed.seeAllChannels')}
              </Link>
            </div>
            {trendingTags.length > 0 && (
              <div className="dz-card" style={{ padding: 20 }}>
                <h3 className="dz-small" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 12, color: '#8b91ad', fontWeight: 700 }}>
                  {t('feed.trendingTagsTitle')}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {trendingTags.map((row) => (
                    <Link key={row.tag} href={`/community/tag/${row.tag}`} className="dz-chip" style={{ fontSize: 12, textDecoration: 'none' }}>
                      #{row.tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
