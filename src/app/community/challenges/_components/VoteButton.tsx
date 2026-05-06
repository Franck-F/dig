'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { unvoteSubmission, voteSubmission } from '@/lib/actions/community/challenges';

type Props = {
  submissionId: string;
  voted: boolean;
  votingOpen: boolean;
  canVote: boolean;
  isOwn: boolean;
  initialVoteCount: number;
};

/**
 * Optimistic vote toggle. Disables itself when:
 *   - The challenge isn't in VOTING phase (`votingOpen=false`)
 *   - The viewer is anon / not an ACTIVE member (`canVote=false`)
 *   - The viewer is the submission author (`isOwn=true`)
 *
 *  Optimistic update flips local state immediately; on server error we revert
 *  and surface a small inline message via `aria-live="polite"`.
 */
export default function VoteButton({
  submissionId,
  voted: initialVoted,
  votingOpen,
  canVote,
  isOwn,
  initialVoteCount,
}: Props) {
  const t = useTranslations('community.challenges');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voted, setVoted] = useState(initialVoted);
  const [voteCount, setVoteCount] = useState(initialVoteCount);
  const [error, setError] = useState<string | null>(null);

  const disabled = !votingOpen || !canVote || isOwn || pending;

  const reasonForDisabled = !votingOpen
    ? t('votingNotOpen')
    : isOwn
      ? t('cannotVoteOwn')
      : !canVote
        ? t('submitDisabledNotMember')
        : null;

  const onClick = () => {
    if (disabled) return;
    setError(null);
    const wasVoted = voted;
    // Optimistic flip.
    setVoted(!wasVoted);
    setVoteCount((c) => c + (wasVoted ? -1 : 1));

    startTransition(async () => {
      try {
        const res = wasVoted
          ? await unvoteSubmission({ submissionId })
          : await voteSubmission({ submissionId });
        if (res.status === 'error') {
          // Revert.
          setVoted(wasVoted);
          setVoteCount((c) => c + (wasVoted ? 1 : -1));
          setError(res.error);
          return;
        }
        // Sync with server-side data (counter, badges etc.).
        router.refresh();
      } catch {
        setVoted(wasVoted);
        setVoteCount((c) => c + (wasVoted ? 1 : -1));
        setError(t('submitDisabledClosed'));
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={reasonForDisabled ?? undefined}
        className={`dz-btn dz-btn-sm ${voted ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
        aria-pressed={voted}
        style={{ minWidth: 110, opacity: disabled ? 0.6 : 1 }}
      >
        {voted ? `★ ${t('voteRemoveCta')}` : `☆ ${t('voteCta')}`}
      </button>
      <span className="dz-small" aria-live="polite" style={{ fontSize: 12, minWidth: 32 }}>
        {voteCount}
      </span>
      {error ? (
        <span className="dz-small" role="alert" style={{ fontSize: 11, color: '#a8235e' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
