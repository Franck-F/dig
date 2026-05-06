import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { fmtDateTime } from '../_components/format';

/**
 * Combined message inbox.
 *
 * Lists every Mentorship the current user belongs to, ordered by the timestamp
 * of its latest message (or the mentorship.startedAt as a fallback). Each row
 * shows the other party, the latest message excerpt, and an "unread" badge
 * counting messages where `senderUserId !== me` and `readByOtherAt IS NULL`.
 *
 * Clicking a row deep-links to the mentorship detail with `?tab=messages` so
 * the chat thread surfaces inside its mentorship context.
 */
export default async function MessagesInboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/messages');

  const userId = session.user.id;
  const t = await getTranslations('mentora.messages');

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
      messages: {
        orderBy: { sentAt: 'desc' },
        take: 1,
      },
    },
  });

  // Hydrate per-mentorship unread counts in parallel. Doing this one-shot keeps
  // it readable; if the inbox grows past ~50 rows we can switch to a single
  // groupBy query.
  const enriched = await Promise.all(
    mentorships.map(async (m) => {
      const unread = await prisma.mentorshipMessage.count({
        where: {
          mentorshipId: m.id,
          senderUserId: { not: userId },
          readByOtherAt: null,
        },
      });
      return { mentorship: m, unread };
    }),
  );

  // Sort by most recent activity desc.
  enriched.sort((a, b) => {
    const aT = a.mentorship.messages[0]?.sentAt.getTime() ?? a.mentorship.startedAt.getTime();
    const bT = b.mentorship.messages[0]?.sentAt.getTime() ?? b.mentorship.startedAt.getTime();
    return bT - aT;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <h1 className="dz-h2" style={{ fontSize: 24 }}>{t('title')}</h1>
        <p className="dz-body" style={{ marginTop: 6 }}>{t('subtitle')}</p>
      </div>

      {enriched.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body">{t('empty')}</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {enriched.map(({ mentorship, unread }) => {
            const iAmMentor = mentorship.mentorProfile.userId === userId;
            const otherUser = iAmMentor ? mentorship.menteeProfile.user : mentorship.mentorProfile.user;
            const otherName =
              otherUser.name ??
              ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
                otherUser.email);
            const last = mentorship.messages[0];
            return (
              <li key={mentorship.id}>
                <Link
                  href={`/mentora/dashboard/mentorships/${mentorship.id}?tab=messages`}
                  className="dz-card"
                  style={{
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 15 }}>{otherName}</strong>
                      {unread > 0 && (
                        <span
                          style={{
                            background: '#7301FF',
                            color: 'white',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 999,
                          }}
                        >
                          {t('unread', { count: unread })}
                        </span>
                      )}
                    </div>
                    <div className="dz-small" style={{ marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {last ? last.body : t('threadEmpty')}
                    </div>
                  </div>
                  <span className="dz-small" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {last ? fmtDateTime(last.sentAt) : ''}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
