import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import StatusPill from '../../../_components/StatusPill';
import { fmtDateTime } from '../../../_components/format';

/**
 * Sessions tab — list scoped to a single mentorship.
 *
 * Upcoming sessions appear first (most recent → ASC), then past sessions
 * (DESC). Status pills cover SCHEDULED / IN_PROGRESS / COMPLETED / CANCELLED /
 * NO_SHOW.
 */
export default async function SessionsTab({
  mentorshipId,
  isLocked,
}: {
  mentorshipId: string;
  isLocked: boolean;
}) {
  const t = await getTranslations('mentora.mentorships.detail');
  const tSessions = await getTranslations('mentora.sessions');

  const sessions = await prisma.session.findMany({
    where: { mentorshipId },
    orderBy: { scheduledAt: 'desc' },
    take: 50,
  });

  return (
    <div className="dz-card" style={{ padding: 24 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <h2 className="dz-h2" style={{ fontSize: 18 }}>{t('sessionsTitle')}</h2>
        {!isLocked && (
          <Link
            href={`/mentora/dashboard/sessions/new?mentorshipId=${mentorshipId}`}
            className="dz-btn dz-btn-primary dz-btn-sm"
          >
            {t('newSessionCta')}
          </Link>
        )}
      </header>

      {sessions.length === 0 ? (
        <p className="dz-body">{t('sessionsEmpty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((s) => {
            const statusKey = mapSessionStatusKey(s.status);
            const formatLabelKey = mapFormatKey(s.format);
            return (
              <li key={s.id}>
                <Link
                  href={`/mentora/dashboard/sessions/${s.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid rgba(115,1,255,0.10)',
                    textDecoration: 'none',
                    color: 'inherit',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 600, minWidth: 180 }}>{fmtDateTime(s.scheduledAt)}</span>
                  <span className="dz-small">
                    {tSessions('card.duration', { minutes: s.durationMinutes })} ·{' '}
                    {tSessions(`formatLabels.${formatLabelKey}`)}
                  </span>
                  <span style={{ flex: 1 }} />
                  <StatusPill status={s.status} label={tSessions(`statusLabels.${statusKey}`)} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function mapSessionStatusKey(s: string) {
  switch (s) {
    case 'SCHEDULED': return 'scheduled';
    case 'IN_PROGRESS': return 'inProgress';
    case 'COMPLETED': return 'completed';
    case 'CANCELLED': return 'cancelled';
    case 'NO_SHOW': return 'noShow';
    default: return 'scheduled';
  }
}

function mapFormatKey(f: string) {
  switch (f) {
    case 'REMOTE_VIDEO': return 'remoteVideo';
    case 'IN_PERSON': return 'inPerson';
    case 'PHONE': return 'phone';
    default: return 'remoteVideo';
  }
}
