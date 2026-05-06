import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import VoteButton from './VoteButton';

/**
 * Renders one challenge submission row on `/community/challenges/[id]`. The
 * vote pill is a client island (`VoteButton`) so the rest of the page stays
 * fully RSC.
 */

export type SubmissionCardData = {
  id: string;
  title: string;
  body: string;
  projectUrl: string | null;
  voteCount: number;
  isWinner: boolean;
  createdAt: Date;
  author: {
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

type Props = {
  submission: SubmissionCardData;
  /** True when the viewer has already voted for THIS submission. */
  voted: boolean;
  /** True when the parent challenge is in the VOTING phase. */
  votingOpen: boolean;
  /** True when the viewer is logged-in + ACTIVE community member. */
  canVote: boolean;
  /** True when the viewer authored this submission (cannot vote own). */
  isOwn: boolean;
};

function bodyExcerpt(raw: string, max = 320): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default async function SubmissionCard({
  submission,
  voted,
  votingOpen,
  canVote,
  isOwn,
}: Props) {
  const t = await getTranslations('community.challenges');
  const tDetail = await getTranslations('community.challenges.detail');

  const authorName = submission.author.displayName || `@${submission.author.handle}`;
  return (
    <article
      className="dz-card"
      style={{
        padding: 18,
        display: 'grid',
        gap: 10,
        position: 'relative',
        borderColor: submission.isWinner ? 'rgba(255,193,7,0.55)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          href={`/community/members/${submission.author.handle}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: submission.author.avatarUrl
                ? `url(${submission.author.avatarUrl}) center/cover`
                : 'linear-gradient(135deg,#7301FF,#A34BF5)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {!submission.author.avatarUrl ? authorName.slice(0, 1).toUpperCase() : null}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{authorName}</span>
        </Link>
        {submission.isWinner ? (
          <span
            className="dz-chip"
            style={{ background: 'rgba(255,193,7,0.18)', color: '#a86b00', fontSize: 11 }}
          >
            🏆 {t('winnerBadge')}
          </span>
        ) : null}
      </div>
      <h3 className="dz-h3" style={{ fontSize: 17, lineHeight: 1.3, margin: 0 }}>
        {submission.title}
      </h3>
      <p className="dz-small" style={{ margin: 0, fontSize: 13 }}>
        {bodyExcerpt(submission.body)}
      </p>
      {submission.projectUrl ? (
        <Link
          href={submission.projectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dz-small"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {submission.projectUrl}
        </Link>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <span className="dz-small" style={{ fontSize: 12 }}>
          {tDetail('voteCount', { count: submission.voteCount })}
        </span>
        <VoteButton
          submissionId={submission.id}
          voted={voted}
          votingOpen={votingOpen}
          canVote={canVote}
          isOwn={isOwn}
          initialVoteCount={submission.voteCount}
        />
      </div>
    </article>
  );
}
