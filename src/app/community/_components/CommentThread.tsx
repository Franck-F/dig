import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import Avatar from './Avatar';
import MentionRenderer from './MentionRenderer';
import PostBody from './PostBody';
import ReplyAffordance from './ReplyAffordance';

/**
 * One node in the comment tree. Recursive — but the spec caps depth at 1, so
 * top-level comments expose `replies[]` and replies themselves do not nest
 * further.
 */
export type CommentNode = {
  id: string;
  body: string;
  /** Sanitized HTML body if the caller pre-sanitized; else null. */
  safeHtml?: string | null;
  status: 'PUBLISHED' | 'REMOVED';
  editedAt: Date | string | null;
  createdAt: Date | string;
  author: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  replies?: CommentNode[];
};

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function CommentItem({
  comment,
  postId,
  canComment,
  isReply = false,
}: {
  comment: CommentNode;
  postId: string;
  canComment: boolean;
  isReply?: boolean;
}) {
  const t = await getTranslations('community.comment');
  const author = comment.author;
  const isRemoved = comment.status === 'REMOVED' || !author;

  return (
    <li
      style={{
        listStyle: 'none',
        display: 'flex',
        gap: 10,
        paddingLeft: isReply ? 36 : 0,
      }}
    >
      <Avatar
        size={isReply ? 28 : 36}
        src={author?.avatarUrl ?? null}
        seed={author?.handle ?? comment.id}
        name={author?.displayName ?? author?.handle ?? null}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {author ? (
            <Link
              href={`/community/members/${author.handle}`}
              style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none', color: 'inherit' }}
            >
              {author.displayName ?? `@${author.handle}`}
            </Link>
          ) : (
            <span style={{ fontWeight: 600, fontSize: 14, opacity: 0.6 }}>—</span>
          )}
          <span className="dz-small" style={{ opacity: 0.7 }}>
            {formatDate(comment.createdAt)}
          </span>
          {comment.editedAt && (
            <span className="dz-small" style={{ opacity: 0.5 }}>
              · {t('editedNotice')}
            </span>
          )}
        </header>

        <div style={{ marginTop: 4 }}>
          {isRemoved ? (
            <p className="dz-body" style={{ fontStyle: 'italic', opacity: 0.6, margin: 0 }}>
              {t('deletedPlaceholder')}
            </p>
          ) : comment.safeHtml ? (
            <PostBody safeHtml={comment.safeHtml} style={{ fontSize: 15 }} />
          ) : (
            <p
              className="dz-body"
              style={{ margin: 0, fontSize: 15, whiteSpace: 'pre-wrap' }}
            >
              <MentionRenderer text={comment.body} />
            </p>
          )}
        </div>

        {!isRemoved && !isReply && (
          <div style={{ marginTop: 8 }}>
            <ReplyAffordance
              postId={postId}
              parentCommentId={comment.id}
              canComment={canComment}
            />
          </div>
        )}

        {!isReply && comment.replies && comment.replies.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '12px 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {comment.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                postId={postId}
                canComment={canComment}
                isReply
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default async function CommentThread({
  postId,
  comments,
  canComment,
}: {
  postId: string;
  comments: CommentNode[];
  canComment: boolean;
}) {
  const t = await getTranslations('community.post.detail');
  if (comments.length === 0) {
    return (
      <p className="dz-body" style={{ opacity: 0.7 }}>
        {t('noComments')}
      </p>
    );
  }
  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {comments.map((c) => (
        <CommentItem key={c.id} comment={c} postId={postId} canComment={canComment} />
      ))}
    </ul>
  );
}
