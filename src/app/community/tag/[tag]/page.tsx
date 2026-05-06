import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import PostCard, { type PostCardData } from '../../_components/PostCard';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type Params = { tag: string };

function normalizeTag(raw: string): string {
  return decodeURIComponent(raw).toLowerCase().replace(/^#/, '').slice(0, 32);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag } = await params;
  const t = await getTranslations('community.tag');
  return { title: t('metaTitle', { tag: normalizeTag(tag) }) };
}

function bodyExcerpt(raw: string, max = 240): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default async function TagPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tag: rawTag } = await params;
  const tag = normalizeTag(rawTag);
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=/community/tag/${encodeURIComponent(tag)}`);
  }
  const t = await getTranslations('community.tag');

  const taggedPosts = await prisma.post.findMany({
    where: {
      status: 'PUBLISHED',
      hashtags: { some: { tag } },
      channel: { archivedAt: null, type: { in: ['PUBLIC', 'ANNOUNCEMENT'] } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 30,
    include: {
      author: { select: { handle: true, displayName: true, avatarUrl: true } },
      channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
      hashtags: { select: { tag: true } },
    },
  });

  // Related tags: tags that co-occur with this one in the same posts.
  const relatedRows =
    taggedPosts.length > 0
      ? await prisma.postHashtag.groupBy({
          by: ['tag'],
          where: {
            postId: { in: taggedPosts.map((p) => p.id) },
            tag: { not: tag },
          },
          _count: { tag: true },
          orderBy: { _count: { tag: 'desc' } },
          take: 8,
        })
      : [];

  const cards: PostCardData[] = taggedPosts.map((p) => ({
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
    author: p.author,
    channel: p.channel,
  }));

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: `#${tag}`, url: `/community/tag/${tag}` },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <h1 className="dz-h1">
          {t('title')} <span className="dz-grad-text">{t('titleHighlight', { tag })}</span>
        </h1>
        <p className="dz-small" style={{ marginTop: 14 }}>
          {t('postsCount', { count: cards.length })}
        </p>
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 260px)',
            gap: 32,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {cards.length === 0 ? (
              <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
                <p className="dz-body">{t('empty')}</p>
              </div>
            ) : (
              cards.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </div>

          {relatedRows.length > 0 && (
            <aside
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'sticky',
                top: 88,
              }}
            >
              <div className="dz-card" style={{ padding: 18 }}>
                <h2 className="dz-h3" style={{ fontSize: 14, marginBottom: 12 }}>
                  {t('relatedTagsTitle')}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {relatedRows.map((row) => (
                    <Link
                      key={row.tag}
                      href={`/community/tag/${row.tag}`}
                      className="dz-chip"
                      style={{ fontSize: 12, textDecoration: 'none' }}
                    >
                      #{row.tag}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>
    </>
  );
}
