import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { breadcrumbJsonLd, jsonLdScriptProps } from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import PostCard, { type PostCardData } from '../_components/PostCard';
import { getCommunityViewer } from '../_components/viewer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.bookmarks');
  return { title: t('metaTitle') };
}

function bodyExcerpt(raw: string, max = 240): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default async function BookmarksPage() {
  const t = await getTranslations('community.bookmarks');
  const viewer = await getCommunityViewer();

  if (viewer.kind === 'guest') {
    redirect('/login?next=/community/bookmarks');
  }
  if (viewer.kind === 'logged-in-no-member') {
    redirect('/community/onboarding');
  }

  const bookmarks = await prisma.bookmark.findMany({
    where: { memberId: viewer.member.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      post: {
        include: {
          author: { select: { handle: true, displayName: true, avatarUrl: true } },
          channel: { select: { slug: true, name: true, emoji: true, coverColor: true } },
          hashtags: { select: { tag: true } },
        },
      },
    },
  });

  const cards: PostCardData[] = bookmarks
    .filter((b) => b.post.status === 'PUBLISHED')
    .map((b) => ({
      id: b.post.id,
      title: b.post.title,
      bodyExcerpt: bodyExcerpt(b.post.body),
      publishedAt: b.post.publishedAt,
      isPinned: b.post.isPinned,
      isLocked: b.post.isLocked,
      reactionCount: b.post.reactionCount,
      commentCount: b.post.commentCount,
      bookmarkCount: b.post.bookmarkCount,
      hashtags: b.post.hashtags.map((h) => h.tag),
      author: b.post.author,
      channel: b.post.channel,
    }));

  return (
    <>
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: t('metaTitle'), url: '/community/bookmarks' },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40 }}>
        <h1 className="dz-h1">
          {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
        </h1>
        <p className="dz-body" style={{ fontSize: 17, marginTop: 14, maxWidth: 640 }}>
          {t('intro')}
        </p>
      </section>

      <section className="dz-section" style={{ paddingTop: 0 }}>
        {cards.length === 0 ? (
          <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
            <p className="dz-body">{t('empty')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cards.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
