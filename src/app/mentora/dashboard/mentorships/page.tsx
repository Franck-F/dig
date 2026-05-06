import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '../_components/StatusPill';
import { fmtDate } from '../_components/format';

/**
 * Mentorships listing — every mentorship the current user belongs to (mentor
 * side OR mentee side). Order: ACTIVE first, then PAUSED, then COMPLETED /
 * TERMINATED, most recent within each group.
 */
export default async function MentorshipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/mentorships');

  const t = await getTranslations('mentora.mentorships');

  const userId = session.user.id;

  const mentorships = await prisma.mentorship.findMany({
    where: {
      OR: [
        { mentorProfile: { userId } },
        { menteeProfile: { userId } },
      ],
    },
    include: {
      mentorProfile: { include: { user: true } },
      menteeProfile: { include: { user: true } },
    },
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <h1 className="dz-h2" style={{ fontSize: 24 }}>{t('title')}</h1>
        <p className="dz-body" style={{ marginTop: 6 }}>{t('subtitle')}</p>
      </div>

      {mentorships.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body">{t('empty')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {mentorships.map((m) => {
            const iAmMentor = m.mentorProfile.userId === userId;
            const otherUser = iAmMentor ? m.menteeProfile.user : m.mentorProfile.user;
            const otherName =
              otherUser.name ??
              ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
                otherUser.email);
            const statusKey = m.status.toLowerCase() as
              | 'active'
              | 'paused'
              | 'completed'
              | 'terminated';
            return (
              <Link
                key={m.id}
                href={`/mentora/dashboard/mentorships/${m.id}`}
                className="dz-card"
                style={{
                  padding: 20,
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'transform 120ms',
                }}
              >
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>
                    {iAmMentor
                      ? t('card.withMentee', { name: otherName })
                      : t('card.withMentor', { name: otherName })}
                  </strong>
                  <StatusPill status={m.status} label={t(`statusLabels.${statusKey}`)} />
                </header>
                <div className="dz-small">{t('card.startedAt', { date: fmtDate(m.startedAt) })}</div>
                {m.endedAt && (
                  <div className="dz-small">{t('card.endedAt', { date: fmtDate(m.endedAt) })}</div>
                )}
                <div className="dz-small">
                  {t('card.frequency', { value: m.agreedFrequency })} ·{' '}
                  {t('card.format', { value: t(`format.${m.agreedFormat}`) })}
                </div>
                <span className="dz-small" style={{ color: '#7301FF', fontWeight: 600, marginTop: 6 }}>
                  {t('card.openCta')}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
