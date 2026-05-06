'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import CommentComposer from './CommentComposer';

/**
 * Inline "Reply" toggle: shows a button that opens a child CommentComposer
 * when clicked. Used by CommentThread (which is RSC) to embed reply forms
 * without making the whole thread a client island.
 */
export default function ReplyAffordance({
  postId,
  parentCommentId,
  canComment,
}: {
  postId: string;
  parentCommentId: string;
  canComment: boolean;
}) {
  const t = useTranslations('community.post.detail');
  const [open, setOpen] = useState(false);

  if (!canComment) {
    return null;
  }

  if (open) {
    return (
      <div style={{ marginTop: 8 }}>
        <CommentComposer
          postId={postId}
          parentCommentId={parentCommentId}
          canComment={canComment}
          onCancel={() => setOpen(false)}
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="dz-btn dz-btn-ghost dz-btn-sm"
      style={{ padding: '4px 10px', fontSize: 12 }}
    >
      {t('replyCta')}
    </button>
  );
}
