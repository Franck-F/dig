import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import type { ChallengeStatus } from '@prisma/client';

/**
 * Cards used on `/community/challenges` to surface a Challenge in the Active /
 * Upcoming / Past sections. Server-rendered; no client logic.
 */
export type ChallengeCardData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  prize: string | null;
  coverImageUrl: string | null;
  status: ChallengeStatus;
  submissionOpensAt: Date;
  submissionClosesAt: Date;
  votingClosesAt: Date;
  submissionsCount: number;
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function descriptionExcerpt(raw: string, max = 220): string {
  const flat = raw.replace(/[`*_>#~]+/g, '').replace(/\n+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export default async function ChallengeCard({ challenge }: { challenge: ChallengeCardData }) {
  const t = await getTranslations('community.challenges');
  const tStatus = await getTranslations('community.challenges.statusLabels');

  const statusLabel = tStatus(challenge.status);
  let deadlineText = '';
  if (challenge.status === 'OPEN') {
    deadlineText = t('deadlineSubmissions', { date: fmtDate(challenge.submissionClosesAt) });
  } else if (challenge.status === 'VOTING') {
    deadlineText = t('deadlineVoting', { date: fmtDate(challenge.votingClosesAt) });
  } else if (challenge.status === 'CLOSED') {
    deadlineText = t('deadlineEnded', { date: fmtDate(challenge.votingClosesAt) });
  } else {
    deadlineText = fmtDate(challenge.submissionOpensAt);
  }

  return (
    <article
      className="dz-card"
      style={{
        padding: 20,
        display: 'grid',
        gap: 12,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {challenge.coverImageUrl ? (
        <div
          aria-hidden
          style={{
            height: 120,
            borderRadius: 12,
            backgroundImage: `url(${challenge.coverImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            height: 120,
            borderRadius: 12,
            background: 'linear-gradient(135deg,#7301FF,#A34BF5,#F46FB1)',
            opacity: 0.85,
          }}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <h3 className="dz-h3" style={{ fontSize: 19, lineHeight: 1.3, margin: 0 }}>
          <Link href={`/community/challenges/${challenge.id}`} style={{ textDecoration: 'none' }}>
            {challenge.title}
          </Link>
        </h3>
        <span
          className="dz-chip"
          style={{
            fontSize: 11,
            background:
              challenge.status === 'OPEN'
                ? 'rgba(0, 184, 124, 0.15)'
                : challenge.status === 'VOTING'
                  ? 'rgba(115,1,255,0.12)'
                  : challenge.status === 'CLOSED'
                    ? 'rgba(36,50,95,0.10)'
                    : 'rgba(244,111,177,0.12)',
          }}
        >
          {statusLabel}
        </span>
      </div>
      <p className="dz-small" style={{ margin: 0, fontSize: 13 }}>
        {descriptionExcerpt(challenge.description)}
      </p>
      <div className="dz-small" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
        <span>
          <strong>{t('deadlineLabel')} :</strong> {deadlineText}
        </span>
        {challenge.prize ? (
          <span>
            <strong>{t('prizeLabel')} :</strong> {challenge.prize}
          </span>
        ) : null}
        <span>{t('submissionsCount', { count: challenge.submissionsCount })}</span>
      </div>
      <div style={{ marginTop: 4 }}>
        <Link href={`/community/challenges/${challenge.id}`} className="dz-btn dz-btn-sm dz-btn-ghost">
          {t('viewCta')}
        </Link>
      </div>
    </article>
  );
}
