import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '../../_components/StatusPill';
import { fmtDateTime } from '../../_components/format';
import SessionActions from './SessionActions';

/**
 * Session detail page.
 *
 * Auth check: caller must be the mentor or the mentee on the parent
 * mentorship — anything else → notFound().
 *
 * The page renders summary info + (when applicable) the join button, then
 * defers all mutating UI (cancel, reschedule, complete, notes, review CTA)
 * to the `SessionActions` client island.
 */
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/sessions');

  const { id } = await params;
  const userId = session.user.id;
  const t = await getTranslations('mentora.sessions.detail');
  const tShared = await getTranslations('mentora.sessions');

  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      mentorship: {
        include: {
          mentorProfile: { include: { user: true } },
          menteeProfile: { include: { user: true } },
        },
      },
    },
  });
  if (!s) notFound();

  const iAmMentor = s.mentorship.mentorProfile.userId === userId;
  const iAmMentee = s.mentorship.menteeProfile.userId === userId;
  if (!iAmMentor && !iAmMentee) notFound();

  // Has the mentee already left a review for this session?
  const myReview = iAmMentee
    ? await prisma.review.findFirst({
        where: { sessionId: s.id, authorUserId: userId },
        select: { id: true },
      })
    : null;

  const otherUser = iAmMentor ? s.mentorship.menteeProfile.user : s.mentorship.mentorProfile.user;
  const otherName =
    otherUser.name ??
    ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
      otherUser.email);
  const statusKey = mapStatus(s.status);
  const formatKey = mapFormat(s.format);
  const isPast = new Date(s.scheduledAt).getTime() < Date.now();
  const canMarkComplete = iAmMentor && s.status === 'SCHEDULED' && isPast;
  const canReview = iAmMentee && s.status === 'COMPLETED' && !myReview;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h1 className="dz-h2" style={{ fontSize: 24 }}>{t('title')}</h1>
          <StatusPill status={s.status} label={tShared(`statusLabels.${statusKey}`)} />
        </header>

        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            margin: 0,
            fontSize: 14,
          }}
        >
          <dt style={{ fontWeight: 600 }}>{t('whenLabel')}</dt>
          <dd style={{ margin: 0 }}>{fmtDateTime(s.scheduledAt)}</dd>

          <dt style={{ fontWeight: 600 }}>{t('durationLabel')}</dt>
          <dd style={{ margin: 0 }}>{s.durationMinutes} min</dd>

          <dt style={{ fontWeight: 600 }}>{t('formatLabel')}</dt>
          <dd style={{ margin: 0 }}>{tShared(`formatLabels.${formatKey}`)}</dd>

          <dt style={{ fontWeight: 600 }}>{t('withLabel')}</dt>
          <dd style={{ margin: 0 }}>{otherName}</dd>

          {s.meetingUrl && (
            <>
              <dt style={{ fontWeight: 600 }}>{t('meetingUrlLabel')}</dt>
              <dd style={{ margin: 0 }}>
                <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7301FF' }}>
                  {s.meetingUrl}
                </a>
              </dd>
            </>
          )}

          {s.location && (
            <>
              <dt style={{ fontWeight: 600 }}>{t('locationLabel')}</dt>
              <dd style={{ margin: 0 }}>{s.location}</dd>
            </>
          )}

          {s.agenda && (
            <>
              <dt style={{ fontWeight: 600 }}>{t('agendaLabel')}</dt>
              <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{s.agenda}</dd>
            </>
          )}
        </dl>

        {s.status === 'CANCELLED' && (
          <p className="dz-small" style={{ marginTop: 12 }}>{t('cancelledHint')}</p>
        )}
        {s.status === 'COMPLETED' && (
          <p className="dz-small" style={{ marginTop: 12 }}>{t('completedHint')}</p>
        )}
      </div>

      <SessionActions
        sessionId={s.id}
        status={s.status}
        isMentor={iAmMentor}
        isMentee={iAmMentee}
        canComplete={canMarkComplete}
        canReview={canReview}
        sharedNotes={s.sharedNotes ?? ''}
        privateNotes={s.mentorNotesPrivate ?? ''}
        meetingUrl={s.meetingUrl}
      />

      <div>
        <Link
          href={`/mentora/dashboard/mentorships/${s.mentorshipId}?tab=sessions`}
          className="dz-small"
          style={{ color: '#7301FF', fontWeight: 600 }}
        >
          ← {otherName}
        </Link>
      </div>
    </div>
  );
}

function mapStatus(s: string) {
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
