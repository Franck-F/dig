import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ResponseTime } from '@prisma/client';

import WhyMatchTooltip, { type MatchBreakdown } from './WhyMatchTooltip';

/**
 * Minimal mentor shape consumed by the public preview card. Mirrors the
 * fields produced by `discoverMentors` (`MentorCardData` from
 * `@/lib/actions/mentora/discovery`) but accepts arbitrary providers so the
 * landing page can adapt other shapes without coupling.
 */
export type MentorCardData = {
  mentorProfileId: string;
  userId: string;
  name: string | null;
  headline: string;
  photoUrl: string | null;
  yearsExperience: number;
  languages: string[];
  averageRating: number | null;
  reviewCount: number;
  topSkills: { id: string; name: string; slug?: string }[];
  responseTime?: ResponseTime;
};

type Props = {
  mentor: MentorCardData;
  breakdown?: MatchBreakdown;
  matchScore?: number;
  variant?: 'compact' | 'full';
};

const palettes: Array<[string, string]> = [
  ['#7301FF', '#A34BF5'],
  ['#A34BF5', '#F46FB1'],
  ['#F46FB1', '#7301FF'],
  ['#24325F', '#A34BF5'],
];

function avatarColors(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default async function MentorCard({
  mentor,
  breakdown,
  matchScore,
  variant = 'full',
}: Props) {
  const t = await getTranslations('mentora.discover.card');
  const [a, b] = avatarColors(mentor.userId);
  const displayName = mentor.name ?? 'Mentor';
  const responseLabel = mentor.responseTime ? t(`responseTime.${mentor.responseTime}`) : null;
  const profileUrl = `/mentora/${mentor.userId}`;

  return (
    <article
      className="dz-card"
      style={{
        padding: 22,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'relative',
      }}
    >
      {typeof matchScore === 'number' && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span className="dz-chip" style={{ fontSize: 11 }}>
            {t('matchScore', { score: Math.round(matchScore) })}
          </span>
          {breakdown && <WhyMatchTooltip breakdown={breakdown} />}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {mentor.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mentor.photoUrl}
            alt=""
            width={56}
            height={56}
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${a}, ${b})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 18,
            }}
          >
            {initials(displayName)}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{displayName}</div>
          <div
            className="dz-small"
            style={{
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={mentor.headline}
          >
            {mentor.headline}
          </div>
        </div>
      </div>

      {variant === 'full' && mentor.topSkills.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {mentor.topSkills.slice(0, 4).map((s) => (
            <span key={s.id} className="dz-chip" style={{ fontSize: 11 }}>
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div
        className="dz-small"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          rowGap: 4,
        }}
      >
        <span>{t('yearsLabel', { years: mentor.yearsExperience })}</span>
        <span>
          {mentor.reviewCount === 0
            ? t('noRating')
            : t('ratingLabel', {
                rating: (mentor.averageRating ?? 0).toFixed(1),
                count: mentor.reviewCount,
              })}
        </span>
        <span>
          {t('languagesLabel')}: {mentor.languages.join(', ').toUpperCase() || '—'}
        </span>
        {responseLabel && (
          <span>{t('responseLabel', { time: responseLabel })}</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Link
          href={profileUrl}
          className="dz-btn dz-btn-primary dz-btn-sm"
          style={{ flex: 1, textAlign: 'center' }}
        >
          {t('viewProfile')}
        </Link>
      </div>
    </article>
  );
}
