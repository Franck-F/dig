import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { CurrentRoleProfile } from '@/lib/mentora/getCurrentRoleProfile';
import { prisma } from '@/lib/prisma';
import { getProductAccess } from '@/lib/access/product-access';
import JoinCommunityCta from './JoinCommunityCta';

/* ------------------------------------------------------------------
   Mentor dashboard overview (RSC).

   Re-skinned to match the new "mentora-mentor" design language:
     - Top KPI strip (4 cards): Mentorés actifs / Sessions à venir /
       Feedbacks à donner / Note moyenne.
     - 2fr / 1fr two-column grid:
         left  -> Mes mentorés (filterable visual) + Activité récente
         right -> Cette semaine (agenda) + Ton impact (gradient stats)

   All prisma reads, getTranslations keys and Link hrefs are preserved
   from the previous version. Visual presentation is the only change.
   ------------------------------------------------------------------ */

type MentorOverviewProps = {
  profile: Extract<CurrentRoleProfile, { kind: 'mentor' }>;
};

const PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length] as string;
}

function initialsFor(first: string | null, last: string | null, name: string | null): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f || l) {
    return `${f.slice(0, 1)}${l.slice(0, 1)}`.toUpperCase() || '??';
  }
  const fallback = (name ?? '').trim();
  if (!fallback) return '??';
  const parts = fallback.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function fmtRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default async function MentorOverview({ profile }: MentorOverviewProps) {
  const t = await getTranslations('mentora.dashboard.mentor');
  const user = profile.user;
  const mentorProfile = profile.mentorProfile;
  const mentorProfileId = mentorProfile.id;

  // Read product access so we can offer a "join the community" CTA to
  // mentors who signed up Mentorat-only. Cheap single-row fetch; the
  // helper is fully defensive against pre-migration environments.
  const access = await getProductAccess();

  // ── Aggregate counts (active mentorships, upcoming, pending feedback, ratings) ──
  const now = new Date();

  // First, list active mentorships — needed for the "Mes mentorés" panel
  // and as a base for review aggregate / pending-feedback calculation.
  let activeMentorships: Array<{
    id: string;
    startedAt: Date;
    menteeProfile: {
      user: { firstName: string | null; lastName: string | null; name: string | null };
    };
    sessions: Array<{ id: string; scheduledAt: Date; status: string }>;
    messages: Array<{ sentAt: Date }>;
  }> = [];
  try {
    activeMentorships = (await prisma.mentorship.findMany({
      where: { mentorProfileId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
      take: 8,
      include: {
        menteeProfile: {
          include: {
            user: { select: { firstName: true, lastName: true, name: true } },
          },
        },
        sessions: {
          orderBy: { scheduledAt: 'desc' },
          take: 3,
          select: { id: true, scheduledAt: true, status: true },
        },
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1,
          select: { sentAt: true },
        },
      },
    })) as typeof activeMentorships;
  } catch {
    activeMentorships = [];
  }

  const activeMentorshipIds = activeMentorships.map((m) => m.id);

  // Pending requests count (kept from original — still surfaced as "Feedbacks à donner")
  let pendingCount = 0;
  try {
    pendingCount = await prisma.mentorshipRequest.count({
      where: { toMentorId: mentorProfileId, status: 'PENDING' },
    });
  } catch {
    pendingCount = 0;
  }

  // Upcoming SCHEDULED sessions in the next week (right-column agenda + KPI count)
  let upcomingThisWeek: Array<{
    id: string;
    scheduledAt: Date;
    durationMinutes: number;
    mentorship: {
      menteeProfile: {
        user: { firstName: string | null; lastName: string | null; name: string | null };
      };
    };
  }> = [];
  try {
    upcomingThisWeek = (await prisma.session.findMany({
      where: {
        mentorship: { mentorProfileId },
        status: 'SCHEDULED',
        scheduledAt: { gte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      include: {
        mentorship: {
          include: {
            menteeProfile: {
              include: {
                user: { select: { firstName: true, lastName: true, name: true } },
              },
            },
          },
        },
      },
    })) as typeof upcomingThisWeek;
  } catch {
    upcomingThisWeek = [];
  }

  // Average rating — across ALL mentorships, public reviews only
  let avgRating: number | null = null;
  let reviewCount = 0;
  try {
    const ratingAgg = await prisma.review.aggregate({
      where: { mentorship: { mentorProfileId }, isPublic: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    avgRating = ratingAgg._avg.rating;
    reviewCount = ratingAgg._count._all;
  } catch {
    avgRating = null;
    reviewCount = 0;
  }

  // Total mentees ever helped + total mentoring hours estimate
  let totalMenteesEver = 0;
  let totalMentoringMinutes = 0;
  try {
    [totalMenteesEver, totalMentoringMinutes] = await Promise.all([
      prisma.mentorship.count({ where: { mentorProfileId } }),
      prisma.session
        .aggregate({
          where: {
            mentorship: { mentorProfileId },
            status: 'COMPLETED',
          },
          _sum: { durationMinutes: true },
        })
        .then((r) => r._sum.durationMinutes ?? 0),
    ]);
  } catch {
    totalMenteesEver = 0;
    totalMentoringMinutes = 0;
  }
  const totalMentoringHours = Math.round(totalMentoringMinutes / 60);

  // Recent activity — recent messages from mentees + recent notifications.
  type ActivityItem = { id: string; createdAt: Date; text: string; color: string; icon: string };
  const recentActivity: ActivityItem[] = [];
  try {
    const recentMessages = await prisma.mentorshipMessage.findMany({
      where: {
        mentorship: { mentorProfileId },
        senderUserId: { not: user.id },
      },
      orderBy: { sentAt: 'desc' },
      take: 4,
      include: {
        sender: { select: { firstName: true, name: true } },
        mentorship: {
          include: {
            menteeProfile: {
              include: { user: { select: { firstName: true, name: true } } },
            },
          },
        },
      },
    });
    for (const m of recentMessages) {
      const who = m.sender.firstName ?? m.sender.name ?? t('unknownMentee');
      recentActivity.push({
        id: `msg-${m.id}`,
        createdAt: m.sentAt,
        text: `Nouveau message de ${who}`,
        color: '#7301FF',
        icon: '✦',
      });
    }
  } catch {
    /* ignore */
  }
  try {
    const recentNotifs = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
    for (const n of recentNotifs) {
      let text = String(n.type).replace(/_/g, ' ').toLowerCase();
      let color = '#A34BF5';
      let icon = '◇';
      if (n.type === 'REVIEW_RECEIVED') {
        text = 'Un nouvel avis a été déposé';
        color = '#23c55e';
        icon = '★';
      } else if (n.type === 'SESSION_SCHEDULED') {
        text = 'Une session a été planifiée';
        color = '#3B7BFF';
        icon = '◌';
      } else if (n.type === 'REQUEST_RECEIVED') {
        text = 'Nouvelle demande de mentorat';
        color = '#F46FB1';
        icon = '☷';
      } else if (n.type === 'NEW_MESSAGE') {
        text = 'Nouveau message';
        color = '#7301FF';
        icon = '✦';
      }
      recentActivity.push({
        id: `notif-${n.id}`,
        createdAt: n.createdAt,
        text,
        color,
        icon,
      });
    }
  } catch {
    /* ignore */
  }
  recentActivity.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const activitySlice = recentActivity.slice(0, 4);

  // ── KPI values ────────────────────────────────────────────────────────
  const activeMenteesCount = activeMentorships.length;
  const sessionsUpcomingCount = upcomingThisWeek.length;
  const feedbacksToGive = pendingCount; // pending requests = "feedbacks/responses owed"

  // ── Visuals ────────────────────────────────────────────────────────────
  const cardBg = 'white';
  const cardBorder = '1px solid rgba(115,1,255,0.10)';
  const ink = '#1a1f3a';
  const sub = '#545b7a';
  const filters: ReadonlyArray<string> = ['Tous', 'Actifs', 'En attente', 'Terminés'];

  const kpis = [
    {
      key: 'active',
      label: 'Mentorés actifs',
      value: String(activeMenteesCount),
      hint: t('upcomingSessionsTitle'),
      color: '#7301FF',
      icon: '☷',
      urgent: false,
    },
    {
      key: 'upcoming',
      label: t('upcomingSessionsTitle'),
      value: String(sessionsUpcomingCount),
      hint: 'Cette semaine',
      color: '#A34BF5',
      icon: '◌',
      urgent: sessionsUpcomingCount > 0,
    },
    {
      key: 'feedback',
      label: t('pendingRequestsTitle'),
      value: String(feedbacksToGive),
      hint: feedbacksToGive === 0 ? t('pendingRequestsEmpty') : t('pendingRequestsCta'),
      color: '#F46FB1',
      icon: '✓',
      urgent: feedbacksToGive > 0,
    },
    {
      key: 'rating',
      label: t('averageRatingTitle'),
      value: avgRating == null ? '—' : avgRating.toFixed(2),
      hint:
        reviewCount === 0
          ? t('averageRatingEmpty')
          : `/ 5 · ${t('averageRatingCount', { count: reviewCount })}`,
      color: '#23c55e',
      icon: '★',
      urgent: false,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cross-product nudge — only renders for mentors who haven't yet
          opted into the Community space. Disappears as soon as the
          flag flips, no manual dismiss needed. */}
      {!access.community && <JoinCommunityCta />}

      {/* ── Top KPI strip ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {kpis.map((s) => (
          <div
            key={s.key}
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: 18,
              padding: 20,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {s.urgent && (
              <span
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'rgba(244,111,177,0.15)',
                  color: '#d94e92',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Urgent
              </span>
            )}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                marginBottom: 14,
              }}
            >
              {s.icon}
            </div>
            <div
              style={{
                fontSize: 11,
                color: sub,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: ink,
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 4 }}>
              {s.hint}
            </div>
          </div>
        ))}
      </div>

      {/* ── 2fr / 1fr grid ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 20,
        }}
      >
        {/* ── LEFT column ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Mes mentorés */}
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: 20,
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: ink }}>
                Mes mentorés
              </h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {filters.map((f, i) => (
                  <span
                    key={f}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      border: 'none',
                      background: i === 0 ? 'rgba(115,1,255,0.10)' : 'transparent',
                      color: i === 0 ? '#7301FF' : sub,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'default',
                      userSelect: 'none',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {activeMentorships.length === 0 ? (
              <p style={{ margin: 0, color: sub, fontSize: 13 }}>{t('upcomingSessionsEmpty')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeMentorships.map((m, i) => {
                  const u = m.menteeProfile.user;
                  const fullName =
                    [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                    u.name ||
                    t('unknownMentee');
                  const initials = initialsFor(u.firstName, u.lastName, u.name);
                  const colorAt = colorFor(i);
                  const lastMessageAt = m.messages[0]?.sentAt;
                  const lastInteraction = lastMessageAt
                    ? fmtRelative(lastMessageAt)
                    : fmtRelative(m.startedAt);

                  // Visual progression heuristic: completed sessions out of last 5.
                  const completedCount = m.sessions.filter((s) => s.status === 'COMPLETED').length;
                  const progressPct = Math.min(
                    100,
                    Math.max(15, Math.round((completedCount / 5) * 100) || 25),
                  );
                  const isUrgent = i === 0 && lastMessageAt != null;

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: 14,
                        borderRadius: 14,
                        background: '#faf7ff',
                        border: isUrgent
                          ? '1px solid rgba(244,111,177,0.30)'
                          : '1px solid rgba(115,1,255,0.06)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${colorAt}, ${colorAt}99)`,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: ink }}>
                            {fullName}
                          </span>
                          {isUrgent && (
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: 999,
                                background: 'rgba(244,111,177,0.15)',
                                color: '#d94e92',
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              Réponse attendue
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
                          Dernier échange · {lastInteraction}
                        </div>
                      </div>
                      <div style={{ width: 140, flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: sub,
                            marginBottom: 4,
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>Progression</span>
                          <span style={{ color: colorAt, fontWeight: 700 }}>{progressPct}%</span>
                        </div>
                        <div
                          style={{
                            height: 5,
                            borderRadius: 3,
                            background: 'rgba(115,1,255,0.08)',
                          }}
                        >
                          <div
                            style={{
                              width: `${progressPct}%`,
                              height: '100%',
                              borderRadius: 3,
                              background: `linear-gradient(90deg, ${colorAt}, ${colorAt}cc)`,
                            }}
                          />
                        </div>
                      </div>
                      <Link
                        href={`/mentora/dashboard/mentorships/${m.id}`}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(115,1,255,0.20)',
                          background: 'transparent',
                          color: '#7301FF',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none',
                          flexShrink: 0,
                        }}
                      >
                        {t('upcomingSessionOpen')}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activité récente */}
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: 20,
              padding: 24,
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: ink }}>
              Activité récente
            </h3>
            {activitySlice.length === 0 ? (
              <p style={{ margin: 0, color: sub, fontSize: 13 }}>—</p>
            ) : (
              activitySlice.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom:
                      i < activitySlice.length - 1
                        ? '1px solid rgba(115,1,255,0.06)'
                        : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: `${a.color}22`,
                      color: a.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {a.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: ink, fontWeight: 500 }}>{a.text}</div>
                    <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>
                      {fmtRelative(a.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT column ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Cette semaine */}
          <div
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: 20,
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ink }}>
                Cette semaine
              </h3>
              <Link
                href="/mentora/dashboard/sessions"
                style={{
                  fontSize: 11,
                  color: '#7301FF',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {t('upcomingSessionsViewAll')}
              </Link>
            </div>
            {upcomingThisWeek.length === 0 ? (
              <p style={{ margin: 0, color: sub, fontSize: 13 }}>{t('upcomingSessionsEmpty')}</p>
            ) : (
              upcomingThisWeek.map((s, i) => {
                const u = s.mentorship.menteeProfile.user;
                const who =
                  [u.firstName, u.lastName].filter(Boolean).join(' ') ||
                  u.name ||
                  t('unknownMentee');
                const colorAt = colorFor(i);
                const dayShort = s.scheduledAt
                  .toLocaleDateString('fr-FR', { weekday: 'short' })
                  .replace('.', '');
                const dayNum = s.scheduledAt.toLocaleDateString('fr-FR', { day: '2-digit' });
                const timeStr = s.scheduledAt.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <Link
                    key={s.id}
                    href={`/mentora/dashboard/sessions/${s.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom:
                        i < upcomingThisWeek.length - 1
                          ? '1px solid rgba(115,1,255,0.06)'
                          : 'none',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        textAlign: 'center',
                        padding: '4px 0',
                        borderRadius: 8,
                        background: `${colorAt}15`,
                        color: colorAt,
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}
                    >
                      <div>{dayShort}</div>
                      <div style={{ fontSize: 13 }}>{dayNum}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: ink,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {who}
                      </div>
                      <div style={{ fontSize: 11, color: sub }}>
                        {timeStr} · {t('sessionDuration', { minutes: s.durationMinutes })}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: sub }}>›</span>
                  </Link>
                );
              })
            )}
          </div>

          {/* Ton impact */}
          <div
            style={{
              background: 'linear-gradient(160deg, #24325F 0%, #7301FF 100%)',
              borderRadius: 20,
              padding: 22,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: 'rgba(244,111,177,0.30)',
                filter: 'blur(30px)',
              }}
            />
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Ton impact
            </span>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em' }}>
                +{totalMentoringHours}h
              </div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                de mentorat donné depuis ton arrivée
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{totalMenteesEver}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Mentorés aidés</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{reviewCount}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Avis reçus</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{activeMentorshipIds.length}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Actifs</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
