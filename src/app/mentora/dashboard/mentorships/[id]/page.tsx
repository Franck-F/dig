import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '../../_components/StatusPill';
import SessionsTab from './_tabs/SessionsTab';
import MessagesTab from './_tabs/MessagesTab';
import GoalsTab from './_tabs/GoalsTab';
import NotesTab from './_tabs/NotesTab';
import MentorshipLifecycleActions from './_tabs/MentorshipLifecycleActions';

type TabKey = 'sessions' | 'messages' | 'goals' | 'notes';

/**
 * Mentorship detail.
 *
 * Auth check: caller MUST be the mentor or the mentee on this mentorship,
 * else `notFound()` (we prefer not to leak existence with a 403).
 *
 * Tabs are driven by the `?tab=` query param. Each tab is rendered server-side
 * with its own data fetch (cheaper than fetching everything for tabs the user
 * never opens), except `MessagesTab` which is a client island (it owns the
 * input and does optimistic-ish refresh).
 */
export default async function MentorshipDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/mentorships');

  const { id } = await params;
  const sp = await searchParams;
  const tab: TabKey =
    sp.tab === 'messages' || sp.tab === 'goals' || sp.tab === 'notes'
      ? sp.tab
      : 'sessions';

  const mentorship = await prisma.mentorship.findUnique({
    where: { id },
    include: {
      mentorProfile: { include: { user: true } },
      menteeProfile: { include: { user: true } },
    },
  });

  if (!mentorship) notFound();

  const userId = session.user.id;
  const iAmMentor = mentorship.mentorProfile.userId === userId;
  const iAmMentee = mentorship.menteeProfile.userId === userId;
  if (!iAmMentor && !iAmMentee) notFound();

  const t = await getTranslations('mentora.mentorships');

  const otherUser = iAmMentor ? mentorship.menteeProfile.user : mentorship.mentorProfile.user;
  const otherName =
    otherUser.name ??
    ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
      otherUser.email);
  const statusKey = mentorship.status.toLowerCase() as
    | 'active'
    | 'paused'
    | 'completed'
    | 'terminated';
  const isLocked =
    mentorship.status === 'TERMINATED' || mentorship.status === 'COMPLETED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="dz-h2" style={{ fontSize: 24 }}>
            {t('detail.title', { name: otherName })}
          </h1>
          <StatusPill status={mentorship.status} label={t(`statusLabels.${statusKey}`)} />
          <span style={{ flex: 1 }} />
          <MentorshipLifecycleActions
            mentorshipId={mentorship.id}
            status={mentorship.status}
            iAmMentor={iAmMentor}
          />
        </header>
      </div>

      {/* Tabs */}
      <div className="dz-seg" style={{ alignSelf: 'flex-start' }}>
        <Link
          href={`/mentora/dashboard/mentorships/${id}?tab=sessions`}
          className={tab === 'sessions' ? '--on' : ''}
        >
          {t('detail.tabs.sessions')}
        </Link>
        <Link
          href={`/mentora/dashboard/mentorships/${id}?tab=messages`}
          className={tab === 'messages' ? '--on' : ''}
        >
          {t('detail.tabs.messages')}
        </Link>
        <Link
          href={`/mentora/dashboard/mentorships/${id}?tab=goals`}
          className={tab === 'goals' ? '--on' : ''}
        >
          {t('detail.tabs.goals')}
        </Link>
        <Link
          href={`/mentora/dashboard/mentorships/${id}?tab=notes`}
          className={tab === 'notes' ? '--on' : ''}
        >
          {t('detail.tabs.notes')}
        </Link>
      </div>

      {tab === 'sessions' && <SessionsTab mentorshipId={mentorship.id} isLocked={isLocked} />}
      {tab === 'messages' && (
        <MessagesTab mentorshipId={mentorship.id} myUserId={userId} isLocked={mentorship.status === 'TERMINATED'} />
      )}
      {tab === 'goals' && <GoalsTab mentorshipId={mentorship.id} isLocked={isLocked} />}
      {tab === 'notes' && (
        <NotesTab mentorshipId={mentorship.id} iAmMentor={iAmMentor} isLocked={isLocked} />
      )}
    </div>
  );
}
