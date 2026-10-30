import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { pickLatestThreads, truncatePreview } from '@/lib/mentora/home';
import { fmtDate } from '../format';

type Thread = {
  mentorshipId: string;
  name: string;
  preview: string;
  at: Date;
  unread: boolean;
};

function displayName(u: { name: string | null; firstName: string | null; lastName: string | null }): string {
  return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || '—');
}

/** Newest message of each of the user's three most recently active conversations. */
async function loadThreads(userId: string, role: 'mentee' | 'mentor', profileId: string): Promise<Thread[]> {
  try {
    const rows = await prisma.mentorshipMessage.findMany({
      where: {
        mentorship: role === 'mentee' ? { menteeProfileId: profileId } : { mentorProfileId: profileId },
      },
      orderBy: { sentAt: 'desc' },
      take: 30,
      select: {
        mentorshipId: true,
        body: true,
        sentAt: true,
        senderUserId: true,
        readByOtherAt: true,
        mentorship: {
          select: {
            mentorProfile: { select: { user: { select: { name: true, firstName: true, lastName: true } } } },
            menteeProfile: { select: { user: { select: { name: true, firstName: true, lastName: true } } } },
          },
        },
      },
    });
    return pickLatestThreads(rows, 3).map((r) => ({
      mentorshipId: r.mentorshipId,
      // Show the other party, whoever sent the last message.
      name: displayName(role === 'mentee' ? r.mentorship.mentorProfile.user : r.mentorship.menteeProfile.user),
      preview: truncatePreview(r.body),
      at: r.sentAt,
      unread: r.senderUserId !== userId && r.readByOtherAt === null,
    }));
  } catch {
    return [];
  }
}

export default async function LatestMessages({
  userId,
  role,
  profileId,
}: {
  userId: string;
  role: 'mentee' | 'mentor';
  profileId: string;
}) {
  const [t, threads] = await Promise.all([
    getTranslations('mentora.dashboard.home'),
    loadThreads(userId, role, profileId),
  ]);

  return (
    <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 className="dz-h3" style={{ fontSize: 18, margin: 0, textAlign: 'center' }}>{t('messagesTitle')}</h2>
      {threads.length === 0 ? (
        <p className="dz-small" style={{ margin: 0, textAlign: 'center' }}>{t('messagesEmpty')}</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {threads.map((th) => (
            <li key={th.mentorshipId}>
              <Link
                href={`/mentora/dashboard/messages?c=${th.mentorshipId}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 160px) minmax(0, 1fr) auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: th.unread ? 'rgba(115,1,255,0.08)' : 'rgba(36,50,95,0.04)',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {th.name}
                </span>
                <span
                  className="dz-small"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {th.unread && <span className="dz-chip" style={{ fontSize: 10, marginRight: 6 }}>{t('unread')}</span>}
                  {th.preview}
                </span>
                <span className="dz-small" style={{ fontSize: 12 }}>{fmtDate(th.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/mentora/dashboard/messages" className="dz-btn dz-btn-primary dz-btn-sm" style={{ alignSelf: 'center' }}>
        {t('messagesCta')}
      </Link>
    </section>
  );
}
