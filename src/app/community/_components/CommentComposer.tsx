'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

// Owned by 3B-2.
import { createComment } from '@/lib/actions/community/comments';

type Props = {
  postId: string;
  parentCommentId?: string;
  /** When false, the textarea + submit are disabled and a CTA is rendered. */
  canComment: boolean;
  /** When provided, the form clears + cancels after a successful submit. */
  onCancel?: () => void;
  /** Auto-focus on mount (used by reply forms). */
  autoFocus?: boolean;
};

export default function CommentComposer({
  postId,
  parentCommentId,
  canComment,
  onCancel,
  autoFocus,
}: Props) {
  const t = useTranslations('community.comment');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canComment || pending) return;
    const trimmed = body.trim();
    if (trimmed.length === 0) return;

    startTransition(async () => {
      try {
        const fn = createComment as unknown as (
          input: { postId: string; parentCommentId?: string; body: string },
        ) => Promise<{ status: 'success' | 'error'; error?: string }>;
        const res = await fn({ postId, parentCommentId, body: trimmed });
        if (res.status === 'error') {
          setError(res.error ?? 'community.errors.unauthorized');
          return;
        }
        setBody('');
        setError(null);
        onCancel?.();
        router.refresh();
      } catch {
        setError('community.errors.unauthorized');
      }
    });
  }

  if (!canComment) {
    return (
      <div
        className="dz-small"
        style={{
          padding: 14,
          background: 'rgba(115,1,255,0.06)',
          borderRadius: 12,
          textAlign: 'center',
        }}
      >
        {t('loginToComment')}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('placeholder')}
        rows={parentCommentId ? 3 : 4}
        autoFocus={autoFocus}
        maxLength={4000}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 12,
          border: '1px solid rgba(36,50,95,0.18)',
          background: 'transparent',
          color: 'inherit',
          fontFamily: 'inherit',
          fontSize: 15,
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {error && (
          <span className="dz-small" style={{ color: '#d33', flex: 1 }}>
            {error}
          </span>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="dz-btn dz-btn-ghost dz-btn-sm"
            disabled={pending}
          >
            {t('delete')}
          </button>
        )}
        <button
          type="submit"
          className="dz-btn dz-btn-primary dz-btn-sm"
          disabled={pending || body.trim().length === 0}
          style={{ marginLeft: 'auto' }}
        >
          {pending ? t('submittingLabel') : t('submit')}
        </button>
      </div>
    </form>
  );
}
