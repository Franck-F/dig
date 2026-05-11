import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { recommendMentorsForMe } from '@/lib/actions/mentora/discover';
import { getProductAccess } from '@/lib/access/product-access';
import StatusPill from './StatusPill';
import { fmtDateTime } from './format';
import JoinCommunityCta from './JoinCommunityCta';

type CurrentMentee = {
  kind: 'mentee';
  user: { id: string; name: string | null; firstName: string | null; lastName: string | null; email: string };
  profile: {
    id: string;
    goals: string;
    languages: string[];
    timezone: string;
    location: string | null;
    currentChallenges: string | null;
    goalSkills: { skillId: string }[];
  };
};

type RecoItem = {
  userId: string;
  name?: string | null;
  headline?: string | null;
  photoUrl?: string | null;
  score?: number;
};

type RecentMessage = {
  id: string;
  body: string;
  sentAt: Date;
  mentorshipId: string;
  senderName: string;
  senderInitials: string;
  isUnread: boolean;
};

const ACCENTS = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

/**
 * MenteeOverview — first-screen surface for a mentee.
 *
 * New layout:
 *   1. KPI strip (4 stat cards) — sessions, hours, goals, level placeholder.
 *   2. Two-column grid (2fr 1fr).
 *      LEFT: upcoming sessions, my mentors (3-col grid), my journey (goals).
 *      RIGHT: gradient recommendations card, recent messages, shared resources.
 */
export default async function MenteeOverview({ profile }: { profile: CurrentMentee }) {
  const t = await getTranslations('mentora.dashboard.overviewMentee');
  const tShared = await getTranslations('mentora.dashboard.shared');
  const tMentorships = await getTranslations('mentora.mentorships');
  const tSessions = await getTranslations('mentora.sessions');
  // tRequests kept for parity with prior version (used inside StatusPill labels for sessions)
  void (await getTranslations('mentora.requests'));

  // Read product access so we can offer a "join the community" CTA to
  // mentees who signed up Mentorat-only.
  const access = await getProductAccess();

  const menteeProfileId = profile.profile.id;
  const userId = profile.user.id;

  const [
    activeMentorships,
    upcomingSessions,
    pendingRequests,
    recommendations,
    sessionsTotal,
    completedSessionsAgg,
    completedSessionsThisMonth,
    goals,
    recentMessages,
  ] = await Promise.all([
    prisma.mentorship.findMany({
      where: { menteeProfileId, status: 'ACTIVE' },
      include: { mentorProfile: { include: { user: true } } },
      orderBy: { startedAt: 'desc' },
      take: 6,
    }),
    prisma.session.findMany({
      where: {
        mentorship: { menteeProfileId },
        status: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      include: {
        mentorship: { include: { mentorProfile: { include: { user: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 3,
    }),
    prisma.mentorshipRequest.count({
      where: { fromMenteeId: menteeProfileId, status: 'PENDING' },
    }),
    safeRecommend(userId),
    prisma.session.count({
      where: { mentorship: { menteeProfileId }, status: 'COMPLETED' },
    }),
    prisma.session.aggregate({
      where: { mentorship: { menteeProfileId }, status: 'COMPLETED' },
      _sum: { durationMinutes: true },
    }),
    prisma.session.count({
      where: {
        mentorship: { menteeProfileId },
        status: 'COMPLETED',
        scheduledAt: { gte: startOfMonth() },
      },
    }),
    safeFindGoals(menteeProfileId),
    safeRecentMessages(menteeProfileId, userId),
  ]);

  const completionPct = computeCompletion(profile.profile);

  const totalMinutes = completedSessionsAgg._sum.durationMinutes ?? 0;
  const hoursOfMentoring = Math.round((totalMinutes / 60) * 10) / 10;
  const totalGoals = goals.length;
  const achievedGoals = goals.filter((g) => g.isAchieved).length;
  const goalsRatio = totalGoals === 0 ? '0/0' : `${achievedGoals}/${totalGoals}`;
  const goalsProgress =
    totalGoals === 0 ? 0 : Math.round((achievedGoals / totalGoals) * 100);
  const activeCount = activeMentorships.length;

  const stats = [
    {
      label: 'Sessions cumulées',
      value: String(sessionsTotal),
      detail:
        completedSessionsThisMonth > 0
          ? `+${completedSessionsThisMonth} ce mois`
          : 'Aucune ce mois',
      color: '#7301FF',
      icon: '◌',
    },
    {
      label: 'Heures de mentorat',
      value: `${hoursOfMentoring}h`,
      detail: `${activeCount} mentor${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`,
      color: '#A34BF5',
      icon: '◉',
    },
    {
      label: 'Objectifs atteints',
      value: goalsRatio,
      detail: `Progression ${goalsProgress}%`,
      color: '#F46FB1',
      icon: '◈',
    },
    {
      label: 'Profil',
      value: `${completionPct}%`,
      detail:
        pendingRequests > 0
          ? `${pendingRequests} demande${pendingRequests > 1 ? 's' : ''} en attente`
          : t('profileCompletionTitle'),
      color: '#3B7BFF',
      icon: '✦',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* The greeting (Bonjour {name}) is rendered by the AppShell topbar —
          no need to duplicate it here. The subtitle below it lives in the
          shell as well, so the page jumps straight to the KPI strip. */}

      {/* Cross-product nudge — only renders for mentees who haven't yet
          opted into the Community space. Disappears as soon as the
          flag flips, no manual dismiss needed. */}
      {!access.community && <JoinCommunityCta />}

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 18,
              padding: 20,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${s.color}22, transparent 70%)`,
              }}
            />
            <div
              aria-hidden
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
                color: '#545b7a',
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
                color: '#1a1f3a',
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 4 }}>
              {s.detail}
            </div>
          </div>
        ))}
      </div>

      {/* Main 2-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 20,
        }}
      >
        {/* LEFT col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Upcoming sessions */}
          <section
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1f3a' }}>
                {t('upcomingSessionsTitle')}
              </h2>
              <Link
                href="/mentora/dashboard/sessions"
                style={{
                  fontSize: 12,
                  color: '#7301FF',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {tShared('viewAll')} →
              </Link>
            </header>
            {upcomingSessions.length === 0 ? (
              <div>
                <p className="dz-body" style={{ marginTop: 0, marginBottom: 12 }}>
                  {t('upcomingSessionsEmpty')}
                </p>
                <Link
                  href="/mentora/dashboard/sessions/new"
                  className="dz-btn dz-btn-primary dz-btn-sm"
                >
                  {t('upcomingSessionsCta')}
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcomingSessions.map((s, idx) => {
                  const u = s.mentorship.mentorProfile.user;
                  const name = formatName(u);
                  const color = ACCENTS[idx % ACCENTS.length];
                  return (
                    <Link
                      key={s.id}
                      href={`/mentora/dashboard/sessions/${s.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: 14,
                        borderRadius: 14,
                        background: '#faf7ff',
                        border: '1px solid rgba(115,1,255,0.06)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: `linear-gradient(135deg, ${color}, ${color}99)`,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {initialsFor(name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a' }}>
                          {s.agenda?.trim() || tSessions('card.with', { name })}
                        </div>
                        <div style={{ fontSize: 12, color: '#545b7a', marginTop: 2 }}>
                          avec {name} ·{' '}
                          {tSessions('card.duration', { minutes: s.durationMinutes })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color }}>
                          {fmtDateTime(s.scheduledAt)}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <StatusPill
                            status={s.status}
                            label={tSessions(`statusLabels.${statusKey(s.status)}`)}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* My mentors */}
          <section
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1f3a' }}>
                {t('myMentorsTitle')}
              </h2>
              <Link
                href="/mentora/discover"
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(115,1,255,0.2)',
                  background: 'transparent',
                  color: '#7301FF',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                + {t('myMentorsCta')}
              </Link>
            </header>
            {activeMentorships.length === 0 ? (
              <p className="dz-body" style={{ margin: 0 }}>
                {t('myMentorsEmpty')}
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                {activeMentorships.slice(0, 6).map((m, idx) => {
                  const u = m.mentorProfile.user;
                  const name = formatName(u);
                  const color = ACCENTS[idx % ACCENTS.length];
                  return (
                    <Link
                      key={m.id}
                      href={`/mentora/dashboard/mentorships/${m.id}`}
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        background: '#faf7ff',
                        border: '1px solid rgba(115,1,255,0.08)',
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'block',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <Avatar
                          name={name}
                          photo={m.mentorProfile.photoUrl}
                          color={color}
                          size={44}
                          shape="circle"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#1a1f3a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: '#545b7a',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.mentorProfile.headline}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 12,
                          fontSize: 11,
                        }}
                      >
                        <StatusPill
                          status={m.status}
                          label={tMentorships(`statusLabels.${m.status.toLowerCase()}`)}
                        />
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 7,
                            background: 'rgba(115,1,255,0.10)',
                            color: '#7301FF',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Ouvrir
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Journey / goals */}
          <section
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 20,
              padding: 24,
            }}
          >
            <h2
              style={{
                margin: '0 0 16px',
                fontSize: 17,
                fontWeight: 700,
                color: '#1a1f3a',
              }}
            >
              Mon parcours
            </h2>
            {goals.length === 0 ? (
              <p className="dz-body" style={{ margin: 0 }}>
                {profile.profile.goals?.trim()
                  ? profile.profile.goals
                  : 'Aucun objectif défini pour le moment.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {goals.slice(0, 6).map((g, idx) => {
                  const color = ACCENTS[idx % ACCENTS.length];
                  const pct = g.isAchieved ? 100 : approxGoalProgress(idx, goals.length);
                  return (
                    <div key={g.id}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 13,
                          marginBottom: 6,
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            color: '#1a1f3a',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {g.description}
                        </span>
                        <span style={{ color, fontWeight: 700, flexShrink: 0 }}>
                          {pct}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: 'rgba(115,1,255,0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Recommendations gradient card */}
          <div
            style={{
              background: 'linear-gradient(160deg, #7301FF 0%, #A34BF5 100%)',
              borderRadius: 20,
              padding: 22,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                filter: 'blur(20px)',
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
              Recommandé pour toi
            </span>
            <h4 style={{ margin: '12px 0 6px', fontSize: 18, fontWeight: 700 }}>
              {recommendations.length > 0
                ? `${recommendations.length} ${recommendations.length > 1 ? 'nouveaux mentors' : 'nouveau mentor'} selon tes objectifs`
                : t('recommendationsTitle')}
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.5,
              }}
            >
              {recommendations.length > 0
                ? t('recommendationsHint')
                : t('recommendationsEmpty')}
            </p>
            <Link
              href="/mentora/discover"
              className="dz-btn"
              style={{
                display: 'inline-block',
                marginTop: 14,
                padding: '10px 16px',
                borderRadius: 10,
                background: 'white',
                color: '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              {t('ctaDiscover')} →
            </Link>
            {recommendations.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {recommendations.slice(0, 3).map((reco) => (
                  <Link
                    key={reco.userId}
                    href={`/mentora/${reco.userId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.12)',
                      textDecoration: 'none',
                      color: 'white',
                    }}
                  >
                    <Avatar
                      name={reco.name ?? '?'}
                      photo={reco.photoUrl ?? null}
                      color="rgba(255,255,255,0.4)"
                      size={32}
                      shape="circle"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {reco.name ?? '—'}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.8)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {reco.headline ?? ''}
                      </div>
                    </div>
                    {typeof reco.score === 'number' && (
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        {Math.round(reco.score)}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent messages */}
          <section
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 20,
              padding: 22,
            }}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a1f3a' }}>
                Messages récents
              </h3>
              {recentMessages.filter((m) => m.isUnread).length > 0 && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#F46FB1',
                    color: 'white',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {recentMessages.filter((m) => m.isUnread).length}
                </span>
              )}
            </header>
            {recentMessages.length === 0 ? (
              <p className="dz-body" style={{ margin: 0, fontSize: 13 }}>
                Aucun message récent.
              </p>
            ) : (
              <div>
                {recentMessages.map((m, i) => {
                  const color = ACCENTS[i % ACCENTS.length];
                  return (
                    <Link
                      key={m.id}
                      href={`/mentora/dashboard/mentorships/${m.mentorshipId}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 0',
                        borderBottom:
                          i < recentMessages.length - 1
                            ? '1px solid rgba(115,1,255,0.06)'
                            : 'none',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: color,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        {m.senderInitials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#1a1f3a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {m.senderName}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: '#545b7a',
                              flexShrink: 0,
                            }}
                          >
                            {fmtRelative(m.sentAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: '#545b7a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {m.body}
                        </div>
                      </div>
                      {m.isUnread && (
                        <div
                          aria-hidden
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#F46FB1',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Shared resources placeholder */}
          <section
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 20,
              padding: 22,
            }}
          >
            <h3
              style={{
                margin: '0 0 14px',
                fontSize: 15,
                fontWeight: 700,
                color: '#1a1f3a',
              }}
            >
              Ressources partagées
            </h3>
            <p
              className="dz-small"
              style={{ margin: 0, color: '#545b7a', fontSize: 12 }}
            >
              Les ressources partagées par tes mentors apparaîtront ici.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

function formatName(u: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  return (
    u.name ??
    ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email)
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function statusKey(s: string): string {
  switch (s) {
    case 'SCHEDULED':
      return 'scheduled';
    case 'IN_PROGRESS':
      return 'inProgress';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    case 'NO_SHOW':
      return 'noShow';
    default:
      return s.toLowerCase();
  }
}

function approxGoalProgress(idx: number, total: number): number {
  // Visually pleasing fallback when no per-goal progress signal is stored.
  // Steps from ~10% to ~80% across the visible list.
  if (total <= 1) return 40;
  const step = Math.max(1, Math.floor(70 / Math.max(1, total - 1)));
  return Math.min(80, 10 + idx * step);
}

function fmtRelative(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

async function safeRecommend(_userId: string): Promise<RecoItem[]> {
  // The matching engine returns an `ActionResult<MentorCardData[]>`
  // (`{ status: 'success', data: [...] }`), not a raw array. The previous
  // implementation `Array.isArray(result)` always returned false, which is
  // why the recommendations panel stayed empty even when matches existed.
  try {
    const result = await recommendMentorsForMe();
    if (result.status !== 'success' || !Array.isArray(result.data)) return [];
    return result.data.map((m) => ({
      userId: m.userId,
      name: m.name,
      headline: m.headline,
      photoUrl: m.photoUrl,
      score: m.match?.total,
    }));
  } catch {
    return [];
  }
}

async function safeFindGoals(menteeProfileId: string) {
  try {
    return await prisma.mentorshipGoal.findMany({
      where: { mentorship: { menteeProfileId } },
      orderBy: [{ isAchieved: 'asc' }, { createdAt: 'desc' }],
      take: 8,
    });
  } catch {
    return [] as Array<{
      id: string;
      description: string;
      isAchieved: boolean;
    }>;
  }
}

async function safeRecentMessages(
  menteeProfileId: string,
  currentUserId: string,
): Promise<RecentMessage[]> {
  try {
    const rows = await prisma.mentorshipMessage.findMany({
      where: { mentorship: { menteeProfileId } },
      orderBy: { sentAt: 'desc' },
      take: 3,
      include: {
        sender: true,
        mentorship: { include: { mentorProfile: { include: { user: true } } } },
      },
    });
    return rows.map((row) => {
      const senderName = formatName({
        name: row.sender.name,
        firstName: row.sender.firstName,
        lastName: row.sender.lastName,
        email: row.sender.email,
      });
      return {
        id: row.id,
        body: row.body,
        sentAt: row.sentAt,
        mentorshipId: row.mentorshipId,
        senderName,
        senderInitials: initialsFor(senderName),
        isUnread:
          row.senderUserId !== currentUserId && row.readByOtherAt === null,
      } satisfies RecentMessage;
    });
  } catch {
    return [];
  }
}

function computeCompletion(p: CurrentMentee['profile']): number {
  let filled = 0;
  const total = 5;
  if (p.goals && p.goals.length >= 20) filled++;
  if (p.languages && p.languages.length > 0) filled++;
  if (p.timezone) filled++;
  if (p.goalSkills.length > 0) filled++;
  if (p.location || p.currentChallenges) filled++;
  return Math.round((filled / total) * 100);
}

function Avatar({
  name,
  photo,
  color = '#7301FF',
  size = 40,
  shape = 'circle',
}: {
  name: string;
  photo?: string | null;
  color?: string;
  size?: number;
  shape?: 'circle' | 'rounded';
}) {
  const radius = shape === 'circle' ? 999 : 12;
  if (photo) {
     
    return (
      <img
        src={photo}
        alt={name}
        width={size}
        height={size}
        style={{
          borderRadius: radius,
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(135deg, ${color}, ${color}99)`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 700,
        fontSize: Math.round(size * 0.36),
        flexShrink: 0,
      }}
    >
      {initialsFor(name)}
    </div>
  );
}
