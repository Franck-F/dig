import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';

import {
  articleJsonLd,
  breadcrumbJsonLd,
  jsonLdScriptProps,
} from '@/lib/seo/jsonld';
import { prisma } from '@/lib/prisma';

import Avatar from '../../_components/Avatar';
import BookmarkButton from '../../_components/BookmarkButton';
import ChannelChip from '../../_components/ChannelChip';
import CommentComposer from '../../_components/CommentComposer';
import CommentThread, { type CommentNode } from '../../_components/CommentThread';
import PostBody from '../../_components/PostBody';
import ReactionsBar from '../../_components/ReactionsBar';
import ReportMenu from '../../_components/ReportMenu';
import SoftPaywall from '../../_components/SoftPaywall';
import TagChip from '../../_components/TagChip';
import { getCommunityViewer } from '../../_components/viewer';

export const dynamic = 'force-dynamic';

export const revalidate = 30;

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('community.post.detail');
  const post = await prisma.post.findUnique({
    where: { id },
    select: { title: true, body: true, status: true },
  });
  if (!post || post.status !== 'PUBLISHED') {
    return { title: t('metaTitleFallback') };
  }
  const titleStr = post.title ?? post.body.slice(0, 60);
  return {
    title: t('metaTitle', { title: titleStr }),
    description: post.body.slice(0, 200),
  };
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=/community/posts/${encodeURIComponent(id)}`);
  }
  const t = await getTranslations('community');
  const viewer = await getCommunityViewer();

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          joinedAt: true,
        },
      },
      channel: {
        select: { slug: true, name: true, emoji: true, coverColor: true },
      },
      hashtags: { select: { tag: true } },
    },
  });

  if (!post) notFound();
  if (post.status === 'REMOVED' || post.status === 'DRAFT') {
    // Hide drafts/removed from public view; show a placeholder card.
    return (
      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div className="dz-card" style={{ padding: 40, textAlign: 'center' }}>
          <p className="dz-body">{t('post.detail.removedPlaceholder')}</p>
          <Link href="/community" className="dz-btn dz-btn-ghost dz-btn-sm" style={{ marginTop: 14 }}>
            ← {t('feed.metaTitle')}
          </Link>
        </div>
      </section>
    );
  }

  // Comments tree (top-level + replies, depth 1).
  const commentsRaw = await prisma.comment.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: { handle: true, displayName: true, avatarUrl: true },
      },
    },
  });
  const topLevel = commentsRaw.filter((c) => c.parentCommentId === null);
  const repliesByParent = new Map<string, typeof commentsRaw>();
  for (const c of commentsRaw) {
    if (c.parentCommentId) {
      const arr = repliesByParent.get(c.parentCommentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentCommentId, arr);
    }
  }
  const commentTree: CommentNode[] = topLevel.map((c) => ({
    id: c.id,
    body: c.body,
    safeHtml: null,
    status: c.status === 'REMOVED' ? 'REMOVED' : 'PUBLISHED',
    editedAt: c.editedAt,
    createdAt: c.createdAt,
    author:
      c.status === 'REMOVED'
        ? null
        : c.author
          ? {
              handle: c.author.handle,
              displayName: c.author.displayName,
              avatarUrl: c.author.avatarUrl,
            }
          : null,
    replies: (repliesByParent.get(c.id) ?? []).map((r) => ({
      id: r.id,
      body: r.body,
      safeHtml: null,
      status: r.status === 'REMOVED' ? 'REMOVED' : 'PUBLISHED',
      editedAt: r.editedAt,
      createdAt: r.createdAt,
      author:
        r.status === 'REMOVED'
          ? null
          : r.author
            ? {
                handle: r.author.handle,
                displayName: r.author.displayName,
                avatarUrl: r.author.avatarUrl,
              }
            : null,
    })),
  }));

  // Reaction counts + viewer state.
  const reactionRows = await prisma.reaction.findMany({
    where: { targetType: 'POST', targetId: post.id },
    select: { emoji: true, memberId: true },
  });
  const counts: Record<string, number> = {};
  let myEmoji: string | null = null;
  for (const r of reactionRows) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    if (viewer.kind === 'member' && r.memberId === viewer.member.id) {
      myEmoji = r.emoji;
    }
  }

  // Bookmark state.
  const bookmarked =
    viewer.kind === 'member'
      ? Boolean(
          await prisma.bookmark.findUnique({
            where: {
              memberId_postId: { memberId: viewer.member.id, postId: post.id },
            },
            select: { id: true },
          }),
        )
      : false;

  const isMember = viewer.kind === 'member';
  const canWrite = isMember && viewer.member.status === 'ACTIVE';
  const canComment = canWrite && !post.isLocked;
  const isAuthor = isMember && viewer.member.id === post.authorId;
  const isAdminOrMod = isMember && (viewer.isAdmin || viewer.isModerator);

  const authorName = post.author.displayName ?? `@${post.author.handle}`;

  const ownerActions: Array<
    { kind: 'edit'; href: string } | { kind: 'archive' } | { kind: 'remove' }
  > = [];
  if (isAuthor) {
    ownerActions.push({ kind: 'edit', href: `/community/posts/${post.id}/edit` });
    ownerActions.push({ kind: 'archive' });
  }
  if (isAuthor || isAdminOrMod) {
    ownerActions.push({ kind: 'remove' });
  }

  return (
    <>
      <script
        {...jsonLdScriptProps(
          articleJsonLd({
            url: `/community/posts/${post.id}`,
            headline: post.title ?? post.body.slice(0, 80),
            description: post.body.slice(0, 200),
            datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
            dateModified: post.editedAt?.toISOString(),
            authorName,
            category: post.channel.name,
            wordCount: post.body.split(/\s+/).filter(Boolean).length,
          }),
        )}
      />
      <script
        {...jsonLdScriptProps(
          breadcrumbJsonLd([
            { name: 'Accueil', url: '/' },
            { name: 'Communauté', url: '/community' },
            { name: post.channel.name, url: `/community/c/${post.channel.slug}` },
            {
              name: post.title ?? 'Publication',
              url: `/community/posts/${post.id}`,
            },
          ]),
        )}
      />

      <section className="dz-section" style={{ paddingTop: 40, maxWidth: 820, margin: '0 auto' }}>
        <article
          className="dz-card"
          style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href={`/community/members/${post.author.handle}`}
              style={{
                display: 'inline-flex',
                gap: 10,
                alignItems: 'center',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <Avatar
                size={44}
                src={post.author.avatarUrl}
                seed={post.author.handle}
                name={authorName}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{authorName}</div>
                <div className="dz-small">
                  @{post.author.handle} ·{' '}
                  {t('post.detail.authorJoined', { date: formatDate(post.author.joinedAt) })}
                </div>
              </div>
            </Link>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChannelChip
                slug={post.channel.slug}
                name={post.channel.name}
                emoji={post.channel.emoji}
                color={post.channel.coverColor}
              />
              {(isAuthor || isAdminOrMod || canWrite) && (
                <ReportMenu
                  targetType="POST"
                  targetId={post.id}
                  canReport={canWrite && !isAuthor}
                  ownerActions={ownerActions}
                />
              )}
            </div>
          </header>

          {post.title && <h1 className="dz-h1" style={{ margin: 0, fontSize: 32 }}>{post.title}</h1>}

          <div className="dz-small" style={{ opacity: 0.7 }}>
            {t('post.detail.publishedAt', { date: formatDate(post.publishedAt) })}
            {post.editedAt && ` · ${t('post.detail.editedNotice')}`}
            {post.isLocked && ` · 🔒 ${t('post.detail.lockedNotice')}`}
          </div>

          {/* Sanitized body. Today the sanitizer (`@/lib/community/sanitizer`)
              is owned by 3B-2 and may not yet be available; we fall back to
              the raw body rendered as text — safe because React escapes.
              When 3B-2 lands, swap in `safeHtml={renderSanitizedMarkdown(post.body)}`. */}
          <PostBody fallbackText={post.body} />

          {/* Attached images uploaded with the post. Stored as data URLs
              (or external URLs) in `post.attachmentUrls`. Server-validated
              to image MIME types so directly rendering as <img> is safe. */}
          {post.attachmentUrls && post.attachmentUrls.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  post.attachmentUrls.length === 1
                    ? '1fr'
                    : 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
                marginTop: 12,
              }}
            >
              {post.attachmentUrls.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={url}
                  alt=""
                  style={{
                    width: '100%',
                    borderRadius: 14,
                    border: '1px solid rgba(115,1,255,0.10)',
                    display: 'block',
                  }}
                />
              ))}
            </div>
          )}

          {post.hashtags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {post.hashtags.map((h) => (
                <TagChip key={h.tag} tag={h.tag} size="md" />
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              borderTop: '1px solid rgba(36,50,95,0.08)',
              paddingTop: 16,
            }}
          >
            <ReactionsBar
              targetType="POST"
              targetId={post.id}
              counts={counts as Partial<Record<string, number>>}
              myEmoji={myEmoji as never}
              canReact={canWrite}
            />
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <BookmarkButton
                postId={post.id}
                initialBookmarked={bookmarked}
                canBookmark={isMember}
              />
            </div>
          </div>
        </article>
      </section>

      <section className="dz-section" style={{ paddingTop: 0, maxWidth: 820, margin: '0 auto' }}>
        <h2 className="dz-h2" style={{ fontSize: 20, marginBottom: 14 }}>
          {t('post.detail.commentsTitle')} ({post.commentCount})
        </h2>

        {!isMember && (
          <SoftPaywall variant="inline" kind={viewer.kind === 'guest' ? 'guest' : 'noMember'} />
        )}

        {canComment ? (
          <div style={{ marginTop: 12, marginBottom: 24 }}>
            <CommentComposer postId={post.id} canComment />
          </div>
        ) : isMember && post.isLocked ? (
          <div className="dz-small" style={{ opacity: 0.7, margin: '12px 0 24px' }}>
            🔒 {t('post.detail.lockedNotice')}
          </div>
        ) : null}

        <CommentThread postId={post.id} comments={commentTree} canComment={canComment} />
      </section>
    </>
  );
}
