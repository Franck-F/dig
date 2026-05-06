import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import StatusPill from '../_components/StatusPill';
import { fmtDateTime } from '../_components/format';
import RequestActions from './RequestActions';

type Tab = 'received' | 'sent';

/**
 * Requests dashboard.
 *
 * - Mentor sees received requests (mentees → me).
 * - Mentee sees sent requests (me → mentors).
 * - Users with both profiles get a tab switcher; default tab follows their
 *   primary kind (mentor first since accepting/declining is more urgent).
 */
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/requests');

  const profile = await getCurrentRoleProfile(session.user.id);
  const t = await getTranslations('mentora.requests');
  const tShared = await getTranslations('mentora.dashboard.shared');

  const isMentor = profile.kind === 'mentor';
  const isMentee = profile.kind === 'mentee';

  // Profile rows for mentor + mentee may both exist; fetch directly to avoid
  // assumptions about which one `getCurrentRoleProfile` resolved.
  const [mentorRow, menteeRow] = await Promise.all([
    prisma.mentorProfile.findUnique({ where: { userId: session.user.id } }),
    prisma.menteeProfile.findUnique({ where: { userId: session.user.id } }),
  ]);
  const hasReceived = !!mentorRow;
  const hasSent = !!menteeRow;

  const sp = await searchParams;
  const requestedTab = sp.tab === 'received' || sp.tab === 'sent' ? sp.tab : null;
  const tab: Tab = requestedTab ?? (isMentor ? 'received' : 'sent');

  const [received, sent] = await Promise.all([
    hasReceived
      ? prisma.mentorshipRequest.findMany({
          where: { toMentorId: mentorRow!.id },
          include: {
            fromMentee: { include: { user: true } },
            topics: { include: { skill: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([]),
    hasSent
      ? prisma.mentorshipRequest.findMany({
          where: { fromMenteeId: menteeRow!.id },
          include: {
            toMentor: { include: { user: true } },
            topics: { include: { skill: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <h1 className="dz-h2" style={{ fontSize: 24 }}>{t('title')}</h1>
        <p className="dz-body" style={{ marginTop: 6 }}>{t('subtitle')}</p>
      </div>

      {hasReceived && hasSent && (
        <div className="dz-seg" style={{ alignSelf: 'flex-start' }}>
          <Link
            href="/mentora/dashboard/requests?tab=received"
            className={tab === 'received' ? '--on' : ''}
          >
            {t('tabs.received')}
          </Link>
          <Link
            href="/mentora/dashboard/requests?tab=sent"
            className={tab === 'sent' ? '--on' : ''}
          >
            {t('tabs.sent')}
          </Link>
        </div>
      )}

      {tab === 'received' && hasReceived ? (
        <RequestList items={received} side="received" />
      ) : tab === 'sent' && hasSent ? (
        <RequestList items={sent} side="sent" />
      ) : (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body">{tShared('empty')}</p>
        </div>
      )}

      {/* Cross-link if user is mentor + only viewing one tab → show CTA below */}
      {!hasReceived && !hasSent && (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body" style={{ marginBottom: 8 }}>{t('empty.sent')}</p>
          <Link href="/mentora/discover" className="dz-btn dz-btn-primary dz-btn-sm">
            {t('empty.discoverCta')}
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------- Inline list component (server) ---------- */

type ReceivedItem = {
  id: string;
  status: string;
  message: string;
  proposedFrequency: string;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
  declineReason: string | null;
  fromMentee: { user: { id: string; name: string | null; firstName: string | null; lastName: string | null; email: string } };
  topics: { skill: { name: string } }[];
};
type SentItem = Omit<ReceivedItem, 'fromMentee'> & {
  toMentor: { userId: string; user: ReceivedItem['fromMentee']['user'] };
};

async function RequestList({
  items,
  side,
}: {
  items: ReceivedItem[] | SentItem[];
  side: 'received' | 'sent';
}) {
  const t = await getTranslations('mentora.requests');

  if (items.length === 0) {
    return (
      <div className="dz-card" style={{ padding: 24 }}>
        <p className="dz-body" style={{ marginBottom: 12 }}>
          {side === 'received' ? t('empty.received') : t('empty.sent')}
        </p>
        {side === 'sent' && (
          <Link href="/mentora/discover" className="dz-btn dz-btn-primary dz-btn-sm">
            {t('empty.discoverCta')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((r) => {
        const otherUser = side === 'received'
          ? (r as ReceivedItem).fromMentee.user
          : (r as SentItem).toMentor.user;
        const name =
          otherUser.name ??
          ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
            otherUser.email);
        const statusKey = r.status.toLowerCase() as 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
        return (
          <article key={r.id} className="dz-card" style={{ padding: 20 }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <strong>
                {side === 'received'
                  ? t('card.from', { name })
                  : t('card.to', { name })}
              </strong>
              <StatusPill status={r.status} label={t(`statusLabels.${statusKey}`)} />
              <span style={{ flex: 1 }} />
              <span className="dz-small">{t('card.sentAt', { date: fmtDateTime(r.createdAt) })}</span>
            </header>

            <div className="dz-small" style={{ marginTop: 8 }}>
              {t('card.frequency', {
                value: t(`frequency.${r.proposedFrequency}`),
              })}
              {r.status === 'PENDING' && (
                <>
                  {' · '}
                  {t('card.expiresAt', { date: fmtDateTime(r.expiresAt) })}
                </>
              )}
            </div>

            {r.topics.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span className="dz-small" style={{ fontWeight: 600 }}>{t('card.topics')} :</span>
                {r.topics.map((tp, i) => (
                  <span key={i} className="dz-chip">{tp.skill.name}</span>
                ))}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div className="dz-small" style={{ fontWeight: 600 }}>{t('card.messageLabel')}</div>
              <p className="dz-body" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.message}</p>
            </div>

            {r.status === 'DECLINED' && r.declineReason && (
              <div style={{ marginTop: 8 }}>
                <div className="dz-small" style={{ fontWeight: 600 }}>{t('declineDialog.reasonLabel')}</div>
                <p className="dz-body" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.declineReason}</p>
              </div>
            )}

            {r.status === 'PENDING' && (
              <div style={{ marginTop: 14 }}>
                <RequestActions requestId={r.id} side={side} />
              </div>
            )}

            {side === 'sent' && (r as SentItem).toMentor && (
              <div style={{ marginTop: 12 }}>
                <Link
                  href={`/mentora/${(r as SentItem).toMentor.userId}`}
                  className="dz-small"
                  style={{ color: '#7301FF', fontWeight: 600 }}
                >
                  {t('card.viewProfile')}
                </Link>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
