import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Avatar from './Avatar';
import ChannelChip from './ChannelChip';
import TagChip from './TagChip';

/**
 * Shape consumed by feed-style lists (community feed, channel feed, member
 * profile recent posts, tag pages, bookmarks). The composer/edit pages do
 * not use PostCard.
 *
 * Loose typing on the inputs — RSC pages assemble these from prisma queries
 * with the fields they actually loaded.
 */
export type PostCardData = {
  id: string;
  title: string | null;
  bodyExcerpt: string;
  publishedAt: Date | string | null;
  isPinned: boolean;
  isLocked: boolean;
  reactionCount: number;
  commentCount: number;
  bookmarkCount?: number;
  hashtags: string[];
  author: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  channel: {
    slug: string;
    name: string;
    emoji: string | null;
    coverColor: string | null;
  };
};

function formatDate(d: Date | string | null): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / min))} min`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} h`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default async function PostCard({ post }: { post: PostCardData }) {
  const t = await getTranslations('community');
  const authorName = post.author.displayName ?? `@${post.author.handle}`;
  const detailHref = `/community/posts/${post.id}`;

  return (
    <article
      className="dz-card"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderTop: post.isPinned
          ? '2px solid #A34BF5'
          : undefined,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <Link
          href={`/community/members/${post.author.handle}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <Avatar
            size={36}
            src={post.author.avatarUrl}
            seed={post.author.handle}
            name={authorName}
          />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{authorName}</span>
            <span className="dz-small">@{post.author.handle}</span>
          </div>
        </Link>

        <span className="dz-small" aria-hidden style={{ opacity: 0.5 }}>·</span>
        <ChannelChip
          slug={post.channel.slug}
          name={post.channel.name}
          emoji={post.channel.emoji}
          color={post.channel.coverColor}
        />
        <span className="dz-small" style={{ marginLeft: 'auto', opacity: 0.7 }}>
          {formatDate(post.publishedAt)}
        </span>
        {post.isPinned && (
          <span
            className="dz-chip --pink"
            style={{ fontSize: 10, padding: '2px 8px' }}
          >
            {t('feed.pinnedLabel')}
          </span>
        )}
      </header>

      <Link
        href={detailHref}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {post.title && (
          <h3 className="dz-h3" style={{ fontSize: 18, margin: 0 }}>
            {post.title}
          </h3>
        )}
        <p
          className="dz-body"
          style={{
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            fontSize: 15,
          }}
        >
          {post.bodyExcerpt}
        </p>
      </Link>

      {post.hashtags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {post.hashtags.slice(0, 6).map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}

      <footer
        className="dz-small"
        style={{
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          marginTop: 4,
          opacity: 0.85,
        }}
      >
        <span aria-label="reactions" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {post.reactionCount}
        </span>
        <span aria-label="comments" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {post.commentCount}
        </span>
        {typeof post.bookmarkCount === 'number' && (
          <span aria-label="bookmarks" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            {post.bookmarkCount}
          </span>
        )}
        <Link
          href={detailHref}
          style={{
            marginLeft: 'auto',
            color: '#7301FF',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          {t('post.detail.commentsTitle')} →
        </Link>
      </footer>
    </article>
  );
}
