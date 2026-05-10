import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import MessagePane from './MessagePane';

export const dynamic = 'force-dynamic';

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned.slice(0, 2).toUpperCase();
}

function relativeTime(d: Date): string {
  const now = Date.now();
  const diffMin = Math.round((now - d.getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `${diffD} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/**
 * Two-pane messaging inbox — designed against the
 * `mentora-mentee-tabs.jsx#Messages` mockup.
 *
 *   - LEFT (320 px): Conversations card with a header (title + total
 *     unread badge), a search-style input (UI-only — no client filter
 *     yet), then a scrollable list of conversation rows. Each row is
 *     an avatar + name + last-message excerpt + relative timestamp +
 *     coloured left border on the active conversation, plus a small
 *     unread dot when there are pending replies.
 *   - RIGHT (1 fr): Active thread card with a header (avatar + name
 *     + on-line dot + "Ouvrir le mentorat" link) and the existing
 *     `MessagesTab` chat island below. When no conversation is
 *     selected, an empty-state pane invites the user to pick one.
 *
 * The active conversation is driven by `?c=<mentorshipId>`. We also
 * default to the most-recent conversation on first load so the user
 * always lands on something clickable.
 */
export default async function MessagesInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/messages');

  const userId = session.user.id;
  const t = await getTranslations('mentora.messages');
  const sp = await searchParams;
  const requestedThreadId = sp.c ?? null;

  const mentorships = await prisma.mentorship.findMany({
    where: {
      OR: [{ mentorProfile: { userId } }, { menteeProfile: { userId } }],
    },
    include: {
      mentorProfile: { include: { user: true } },
      menteeProfile: { include: { user: true } },
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
    },
  });

  // Per-mentorship unread count + sort by most recent activity.
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
  enriched.sort((a, b) => {
    const aT = a.mentorship.messages[0]?.sentAt.getTime() ?? a.mentorship.startedAt.getTime();
    const bT = b.mentorship.messages[0]?.sentAt.getTime() ?? b.mentorship.startedAt.getTime();
    return bT - aT;
  });

  const totalUnread = enriched.reduce((acc, e) => acc + e.unread, 0);

  // Pick the active conversation. If the URL points at a valid one,
  // honour it. Otherwise default to the first row so the right pane
  // is never empty when conversations exist.
  const activeRow =
    enriched.find((e) => e.mentorship.id === requestedThreadId) ?? enriched[0] ?? null;
  const activeMentorship = activeRow?.mentorship ?? null;

  // Compute the "other party" for the active conversation header.
  let activeOther: {
    name: string;
    initials: string;
    accent: string;
  } | null = null;
  let activeIsLocked = false;
  if (activeMentorship) {
    const iAmMentor = activeMentorship.mentorProfile.userId === userId;
    const u = iAmMentor
      ? activeMentorship.menteeProfile.user
      : activeMentorship.mentorProfile.user;
    const name =
      u.name ??
      ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
    const idx = enriched.findIndex((e) => e.mentorship.id === activeMentorship.id);
    activeOther = {
      name,
      initials: initialsFor(name),
      accent: ACCENT_PALETTE[Math.max(0, idx) % ACCENT_PALETTE.length],
    };
    activeIsLocked = activeMentorship.status === 'TERMINATED';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Page header */}
      <div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: '#7301FF',
          }}
        >
          MENTORA
        </span>
        <h1 className="dz-h2" style={{ fontSize: 26, margin: '6px 0 0' }}>
          {t('title')}
        </h1>
      </div>

      {enriched.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body" style={{ margin: 0 }}>
            {t('empty')}
          </p>
        </div>
      ) : (
        <div
          className="dz-messages-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '320px minmax(0, 1fr)',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          {/* LEFT — conversations list */}
          <aside
            className="dz-card"
            style={{
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 560,
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                {t('conversationsTitle')}
              </h2>
              {totalUnread > 0 && (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: '#F46FB1',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {t('totalUnread', { count: totalUnread })}
                </span>
              )}
            </header>
            {/* Search input — UI only for now (no client filtering). */}
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              disabled
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(115,1,255,0.10)',
                background: '#faf7ff',
                fontSize: 13,
                color: '#545b7a',
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                overflowY: 'auto',
                margin: '0 -6px',
                padding: '0 6px',
              }}
            >
              {enriched.map(({ mentorship, unread }, idx) => {
                const iAmMentor = mentorship.mentorProfile.userId === userId;
                const otherUser = iAmMentor
                  ? mentorship.menteeProfile.user
                  : mentorship.mentorProfile.user;
                const otherName =
                  otherUser.name ??
                  ([otherUser.firstName, otherUser.lastName]
                    .filter(Boolean)
                    .join(' ')
                    .trim() || otherUser.email);
                const initials = initialsFor(otherName);
                const accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
                const last = mentorship.messages[0];
                const isActive = activeMentorship?.id === mentorship.id;

                return (
                  <Link
                    key={mentorship.id}
                    href={`/mentora/dashboard/messages?c=${mentorship.id}`}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: 12,
                      borderRadius: 12,
                      borderLeft: isActive ? `3px solid ${accent}` : '3px solid transparent',
                      background: isActive ? 'rgba(115,1,255,0.06)' : 'transparent',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background 120ms ease',
                    }}
                  >
                    <div
                      aria-hidden
                      translate="no"
                      title={otherName}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                        color: 'white',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: unread > 0 ? 700 : 600,
                            color: '#1a1f3a',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {otherName}
                        </span>
                        <span style={{ fontSize: 11, color: '#8b91ad', flexShrink: 0 }}>
                          {last ? relativeTime(last.sentAt) : ''}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: unread > 0 ? '#1a1f3a' : '#8b91ad',
                          fontWeight: unread > 0 ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}
                      >
                        {last ? last.body : t('threadEmpty')}
                      </div>
                    </div>
                    {unread > 0 && (
                      <span
                        aria-label={t('unread', { count: unread })}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#F46FB1',
                          alignSelf: 'center',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </aside>

          {/* RIGHT — active thread or empty state */}
          <section
            className="dz-card"
            style={{
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 560,
              overflow: 'hidden',
            }}
          >
            {activeMentorship && activeOther ? (
              <>
                <header
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '16px 22px',
                    borderBottom: '1px solid rgba(115,1,255,0.08)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    aria-hidden
                    translate="no"
                    title={activeOther.name}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${activeOther.accent}, ${activeOther.accent}cc)`,
                      color: 'white',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {activeOther.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1f3a' }}>
                      {activeOther.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#23c55e',
                        fontWeight: 600,
                        marginTop: 2,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#23c55e',
                        }}
                      />
                      {t('headerOnline')}
                    </div>
                  </div>
                  <Link
                    href={`/mentora/dashboard/mentorships/${activeMentorship.id}`}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 9,
                      border: '1px solid rgba(115,1,255,0.20)',
                      background: 'transparent',
                      color: '#7301FF',
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    {t('openMentorshipCta')}
                  </Link>
                </header>
                <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column' }}>
                  <MessagePane
                    mentorshipId={activeMentorship.id}
                    myUserId={userId}
                    isLocked={activeIsLocked}
                  />
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 40,
                  textAlign: 'center',
                  color: '#8b91ad',
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background:
                      'linear-gradient(135deg, rgba(115,1,255,0.12), rgba(244,111,177,0.12))',
                    color: '#7301FF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                    marginBottom: 14,
                  }}
                >
                  ✦
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
                  {t('selectThreadTitle')}
                </div>
                <div style={{ fontSize: 13, marginTop: 6, maxWidth: 360 }}>
                  {t('selectThreadBody')}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Mobile fallback — stack columns under 900px so the chat takes
          the full viewport width when active. */}
      <style>{`
        @media (max-width: 900px) {
          .dz-messages-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
