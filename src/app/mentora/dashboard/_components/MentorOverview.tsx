import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import type { CurrentRoleProfile } from '@/lib/mentora/getCurrentRoleProfile';
import { isMentorAvailable } from '@/lib/mentora/badges';
import { mentorCompletion, truncatePreview } from '@/lib/mentora/home';
import TrainingsPanel from '../resources/formations/TrainingsPanel';
import ReferentCard from './ReferentCard';
import GoFurtherTiles from './home/GoFurtherTiles';
import LatestMessages from './home/LatestMessages';
import ProfileSummaryCard from './home/ProfileSummaryCard';
import { fmtDate, fmtDateTime } from './format';

type PersonName = { name: string | null; firstName: string | null; lastName: string | null };

function displayName(u: PersonName): string {
  return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '—');
}

/**
 * Mentor home, modelled on the Entourage Pro dashboard (Oct 2026
 * slim-down): profile + availability + referent on the left; pending
 * requests, upcoming sessions, "Pour aller plus loin", latest messages and
 * trainings on the right. KPI strips, impact card and activity feed were
 * dropped.
 */
export default async function MentorOverview({
  profile,
}: {
  profile: Extract<CurrentRoleProfile, { kind: 'mentor' }>;
}) {
  const user = profile.user;
  const mentor = profile.mentorProfile;

  const [t, pendingRequests, upcomingSessions, activeMentorships] = await Promise.all([
    getTranslations('mentora.dashboard.home'),
    prisma.mentorshipRequest
      .findMany({
        where: { toMentorId: mentor.id, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          message: true,
          createdAt: true,
          fromMentee: { select: { user: { select: { name: true, firstName: true, lastName: true } } } },
        },
      })
      .catch(() => []),
    prisma.session
      .findMany({
        where: { mentorship: { mentorProfileId: mentor.id }, status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 3,
        select: {
          id: true,
          scheduledAt: true,
          mentorship: { select: { menteeProfile: { select: { user: { select: { name: true, firstName: true, lastName: true } } } } } },
        },
      })
      .catch(() => []),
    prisma.mentorship.count({ where: { mentorProfileId: mentor.id, status: 'ACTIVE' } }).catch(() => 0),
  ]);

  const completion = mentorCompletion({
    headline: mentor.headline,
    bio: mentor.bio,
    photoUrl: mentor.photoUrl,
    linkedinUrl: mentor.linkedinUrl,
    languages: mentor.languages,
    skillsCount: mentor.skills.length,
  });
  const name = user.name ?? ([user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email);

  return (
    <div className="dz-home-grid">
      <div className="dz-home-col">
        <ProfileSummaryCard
          name={name}
          location={mentor.location}
          photoUrl={mentor.photoUrl}
          completion={completion}
          intro={mentor.headline || null}
          isAvailable={isMentorAvailable({
            isAcceptingMentees: mentor.isAcceptingMentees,
            activeMentorships,
            maxConcurrentMentees: mentor.maxConcurrentMentees,
          })}
        />
        <ReferentCard />
      </div>

      <div className="dz-home-col">
        <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="dz-h3" style={{ fontSize: 18, margin: 0, textAlign: 'center' }}>{t('requestsTitle')}</h2>
          {pendingRequests.length === 0 ? (
            <p className="dz-small" style={{ margin: 0, textAlign: 'center' }}>{t('requestsEmpty')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingRequests.map((r) => (
                <li
                  key={r.id}
                  style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(115,1,255,0.06)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{displayName(r.fromMentee.user)}</span>
                    <span className="dz-small" style={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</span>
                  </div>
                  <p className="dz-small" style={{ margin: '4px 0 0' }}>{truncatePreview(r.message)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/mentora/dashboard/requests" className="dz-btn dz-btn-primary dz-btn-sm" style={{ alignSelf: 'center' }}>
            {t('requestsCta')}
          </Link>
        </section>

        <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 className="dz-h3" style={{ fontSize: 18, margin: 0, textAlign: 'center' }}>{t('sessionsTitle')}</h2>
          {upcomingSessions.length === 0 ? (
            <p className="dz-small" style={{ margin: 0, textAlign: 'center' }}>{t('sessionsEmpty')}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/mentora/dashboard/sessions/${s.id}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'rgba(36,50,95,0.04)',
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{fmtDateTime(s.scheduledAt)}</span>
                    <span className="dz-small">
                      {t('sessionWith', { name: displayName(s.mentorship.menteeProfile.user) })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/mentora/dashboard/sessions" className="dz-btn dz-btn-ghost dz-btn-sm" style={{ alignSelf: 'center' }}>
            {t('sessionsCta')}
          </Link>
        </section>

        <GoFurtherTiles role="mentor" />
        <LatestMessages userId={user.id} role="mentor" profileId={mentor.id} />
        <TrainingsPanel userId={user.id} role="mentor" variant="compact" />
      </div>
    </div>
  );
}
