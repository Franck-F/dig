import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '../_components/StatusPill';
import { fmtDateTime } from '../_components/format';

type Tab = 'upcoming' | 'past';

/**
 * Cross-mentorship sessions listing.
 *
 * Tabs: upcoming (status=SCHEDULED & scheduledAt >= now) | past (everything
 * else). Card shows date, the other party, status pill and a deep link to the
 * session detail page.
 */
export default async function SessionsListingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/sessions');

  const sp = await searchParams;
  const tab: Tab = sp.tab === 'past' ? 'past' : 'upcoming';
  const t = await getTranslations('mentora.sessions');
  const userId = session.user.id;
  const now = new Date();

  // Use the generated Prisma types so the conditional `where` tree stays
  // strongly typed without us hand-rolling literal unions.
  const sessions = await prisma.session.findMany({
    where:
      tab === 'upcoming'
        ? {
            mentorship: {
              OR: [
                { mentorProfile: { userId } },
                { menteeProfile: { userId } },
              ],
            },
            status: 'SCHEDULED',
            scheduledAt: { gte: now },
          }
        : {
            mentorship: {
              OR: [
                { mentorProfile: { userId } },
                { menteeProfile: { userId } },
              ],
            },
            OR: [
              { status: { in: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
              { scheduledAt: { lt: now } },
            ],
          },
    include: {
      mentorship: {
        include: {
          mentorProfile: { include: { user: true } },
          menteeProfile: { include: { user: true } },
        },
      },
    },
    orderBy: { scheduledAt: tab === 'upcoming' ? 'asc' : 'desc' },
    take: 60,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <h1 className="dz-h2" style={{ fontSize: 24 }}>{t('title')}</h1>
        <p className="dz-body" style={{ marginTop: 6 }}>{t('subtitle')}</p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div className="dz-seg">
          <Link
            href="/mentora/dashboard/sessions?tab=upcoming"
            className={tab === 'upcoming' ? '--on' : ''}
          >
            {t('tabs.upcoming')}
          </Link>
          <Link
            href="/mentora/dashboard/sessions?tab=past"
            className={tab === 'past' ? '--on' : ''}
          >
            {t('tabs.past')}
          </Link>
        </div>
        <span style={{ flex: 1 }} />
        <Link href="/mentora/dashboard/sessions/new" className="dz-btn dz-btn-primary dz-btn-sm">
          {t('empty.newCta')}
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body">
            {tab === 'upcoming' ? t('empty.upcoming') : t('empty.past')}
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((s) => {
            const iAmMentor = s.mentorship.mentorProfile.userId === userId;
            const otherUser = iAmMentor
              ? s.mentorship.menteeProfile.user
              : s.mentorship.mentorProfile.user;
            const otherName =
              otherUser.name ??
              ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
                otherUser.email);
            const statusKey = mapKey(s.status);
            const formatKey = mapFormat(s.format);
            return (
              <li key={s.id}>
                <Link
                  href={`/mentora/dashboard/sessions/${s.id}`}
                  className="dz-card"
                  style={{
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textDecoration: 'none',
                    color: 'inherit',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 600, minWidth: 200 }}>{fmtDateTime(s.scheduledAt)}</span>
                  <span className="dz-small">{t('card.with', { name: otherName })}</span>
                  <span className="dz-small">
                    {t('card.duration', { minutes: s.durationMinutes })} ·{' '}
                    {t(`formatLabels.${formatKey}`)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <StatusPill status={s.status} label={t(`statusLabels.${statusKey}`)} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function mapKey(s: string) {
  switch (s) {
    case 'SCHEDULED': return 'scheduled';
    case 'IN_PROGRESS': return 'inProgress';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED': return 'cancelled';
    case 'NO_SHOW': return 'noShow';
    default: return 'scheduled';
  }
}
function mapFormat(f: string) {
  switch (f) {
    case 'REMOTE_VIDEO': return 'remoteVideo';
    case 'IN_PERSON': return 'inPerson';
    case 'PHONE': return 'phone';
    default: return 'remoteVideo';
  }
}
