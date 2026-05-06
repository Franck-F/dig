'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

// Owned by 3B-2.
import { toggleBookmark } from '@/lib/actions/community/bookmarks';

type Props = {
  postId: string;
  initialBookmarked: boolean;
  /** Anon viewers see a disabled button → login link. */
  canBookmark: boolean;
};

export default function BookmarkButton({
  postId,
  initialBookmarked,
  canBookmark,
}: Props) {
  const t = useTranslations('community.post.detail');
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!canBookmark || pending) return;
    setBookmarked((b) => !b);
    startTransition(async () => {
      try {
        const fn = toggleBookmark as unknown as (
          input: { postId: string },
        ) => Promise<unknown>;
        await fn({ postId });
      } catch {
        setBookmarked((b) => !b);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canBookmark || pending}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? t('unbookmarkCta') : t('bookmarkCta')}
      title={bookmarked ? t('unbookmarkCta') : t('bookmarkCta')}
      className="dz-btn dz-btn-ghost dz-btn-sm"
      style={{
        padding: '6px 12px',
        opacity: canBookmark ? 1 : 0.55,
        cursor: canBookmark ? 'pointer' : 'not-allowed',
      }}
    >
      {bookmarked ? '★' : '☆'}{' '}
      <span style={{ marginLeft: 4 }}>
        {bookmarked ? t('unbookmarkCta') : t('bookmarkCta')}
      </span>
    </button>
  );
}
