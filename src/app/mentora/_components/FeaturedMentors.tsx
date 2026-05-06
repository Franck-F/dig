import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Provided by Agent 2B-2.
import { discoverMentors } from '@/lib/actions/mentora/discovery';

import MentorCard, { type MentorCardData } from './MentorCard';

/**
 * Server-rendered featured-mentors strip used on the public landing page.
 * Calls `discoverMentors({ pageSize })` and renders a grid of `MentorCard`.
 * Falls back to an empty-state copy if no mentors yet (or if the action
 * returns an error).
 */
export default async function FeaturedMentors({ limit = 6 }: { limit?: number } = {}) {
  const t = await getTranslations('mentora.landing.featured');

  let mentors: MentorCardData[] = [];
  try {
    const result = await discoverMentors({ pageSize: limit, page: 1 });
    if (result.status === 'success' && result.data) {
      mentors = result.data.items as unknown as MentorCardData[];
    }
  } catch {
    mentors = [];
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 28,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div className="dz-eyebrow"><span className="dot" />{t('eyebrow')}</div>
          <h2 className="dz-h2" style={{ marginTop: 12 }}>
            {t('title')} <span className="dz-grad-text">{t('titleHighlight')}</span>
          </h2>
          <p className="dz-body" style={{ marginTop: 10, maxWidth: 560 }}>
            {t('intro')}
          </p>
        </div>
        <Link href="/mentora/discover" className="dz-btn dz-btn-ghost">
          {t('seeAllCta')}
        </Link>
      </div>

      {mentors.length === 0 ? (
        <div
          className="dz-card"
          style={{ padding: 32, textAlign: 'center' }}
        >
          <p className="dz-body">{t('empty')}</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {mentors.map((mentor) => (
            <MentorCard key={mentor.userId} mentor={mentor} variant="full" />
          ))}
        </div>
      )}
    </>
  );
}
