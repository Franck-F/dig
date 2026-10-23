import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { recommendMentorsForMe, type MentorCardData } from '@/lib/actions/mentora/discovery';
import type { CurrentRoleProfile } from '@/lib/mentora/getCurrentRoleProfile';
import { menteeCompletion, sentRequestsSummary } from '@/lib/mentora/home';
import MentorCard from '../../_components/MentorCard';
import TrainingsPanel from '../resources/formations/TrainingsPanel';
import ReferentCard from './ReferentCard';
import GoFurtherTiles from './home/GoFurtherTiles';
import LatestMessages from './home/LatestMessages';
import ProfileSummaryCard from './home/ProfileSummaryCard';
import { fmtDateTime } from './format';

/**
 * Mentee home, modelled on the Entourage Pro candidate dashboard
 * (Oct 2026 slim-down): profile + referent on the left; recommended
 * mentors, next session, "Pour aller plus loin", latest messages and
 * trainings on the right. Stats grids and activity feeds were dropped.
 */
export default async function MenteeOverview({
  profile,
}: {
  profile: Extract<CurrentRoleProfile, { kind: 'mentee' }>;
}) {
  const user = profile.user;
  const mentee = profile.menteeProfile;
  const name = user.name ?? ([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email);

  const [t, recommendations, nextSession, pendingSentCount] = await Promise.all([
    getTranslations('mentora.dashboard.home'),
    safeRecommend(),
    prisma.session
      .findFirst({
        where: { mentorship: { menteeProfileId: mentee.id }, status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        select: {
          id: true,
          scheduledAt: true,
          mentorship: {
            select: { mentorProfile: { select: { user: { select: { name: true, firstName: true, lastName: true } } } } },
          },
        },
      })
      .catch(() => null),
    prisma.mentorshipRequest
      .count({ where: { fromMenteeId: mentee.id, status: 'PENDING' } })
      .catch(() => 0),
  ]);
  const sentRequests = sentRequestsSummary(pendingSentCount);

  const completion = menteeCompletion({
    goals: mentee.goals,
    languages: mentee.languages,
    timezone: mentee.timezone,
    goalSkillsCount: mentee.goalSkills.length,
    location: mentee.location,
    currentChallenges: mentee.currentChallenges,
  });
  const nextMentor = nextSession?.mentorship.mentorProfile.user;
  const nextMentorName = nextMentor
    ? (nextMentor.name ?? [nextMentor.firstName, nextMentor.lastName].filter(Boolean).join(' '))
    : '';

  return (
    <div className="dz-home-grid">
      <div className="dz-home-col">
        <ProfileSummaryCard
          name={name}
          location={mentee.location}
          photoUrl={mentee.photoUrl}
          completion={completion}
          intro={mentee.goals || null}
        />
        <ReferentCard />
      </div>

      <div className="dz-home-col">
        <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <header style={{ textAlign: 'center' }}>
            <h2 className="dz-h3" style={{ fontSize: 18, margin: 0 }}>{t('recommendedTitle')}</h2>
            <p className="dz-small" style={{ margin: '4px 0 0' }}>{t('recommendedSubtitle')}</p>
            <details style={{ marginTop: 8 }}>
              <summary className="dz-small" style={{ cursor: 'pointer', color: '#7301FF', fontWeight: 700 }}>
                {t('howItWorks')}
              </summary>
              <p className="dz-small" style={{ margin: '6px auto 0', maxWidth: 520 }}>{t('howItWorksBody')}</p>
            </details>
          </header>
          {recommendations.length === 0 ? (
            <p className="dz-small" style={{ margin: 0, textAlign: 'center' }}>{t('recommendedEmpty')}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {recommendations.map((m) => (
                <MentorCard
                  key={m.mentorProfileId}
                  mentor={m}
                  variant="compact"
                  matchScore={m.match?.total}
                  breakdown={m.match?.breakdown}
                />
              ))}
            </div>
          )}
          <Link href="/mentora/discover" className="dz-btn dz-btn-primary dz-btn-sm" style={{ alignSelf: 'center' }}>
            {t('seeAllMentors')}
          </Link>
        </section>

        {sentRequests && (
          <Link
            href={sentRequests.href}
            className="dz-card"
            style={{ padding: '14px 22px', display: 'flex', gap: 10, alignItems: 'center', color: 'inherit', textDecoration: 'none' }}
          >
            <span aria-hidden style={{ color: '#7301FF', fontSize: 18 }}>✉</span>
            <span style={{ fontWeight: 700, flex: 1 }}>{t('sentRequests', { count: sentRequests.count })}</span>
            <span className="dz-small" style={{ color: '#7301FF', fontWeight: 700 }}>{t('sentRequestsCta')} →</span>
          </Link>
        )}

        {nextSession && (
          <Link
            href={`/mentora/dashboard/sessions/${nextSession.id}`}
            className="dz-card"
            style={{ padding: '14px 22px', display: 'flex', gap: 10, alignItems: 'center', color: 'inherit', textDecoration: 'none' }}
          >
            <span aria-hidden style={{ color: '#7301FF', fontSize: 18 }}>◌</span>
            <span style={{ fontWeight: 700 }}>{t('nextSessionTitle')}</span>
            <span className="dz-small">
              {t('nextSessionWith', { date: fmtDateTime(nextSession.scheduledAt), name: nextMentorName })}
            </span>
          </Link>
        )}

        <GoFurtherTiles role="mentee" />
        <LatestMessages userId={user.id} role="mentee" profileId={mentee.id} />
        <TrainingsPanel userId={user.id} role="mentee" variant="compact" />
      </div>
    </div>
  );
}

async function safeRecommend(): Promise<MentorCardData[]> {
  try {
    const result = await recommendMentorsForMe();
    if (result.status !== 'success' || !Array.isArray(result.data)) return [];
    return result.data.slice(0, 3);
  } catch {
    return [];
  }
}
