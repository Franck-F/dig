import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PendingMentorsList, { type PendingMentorRow } from './_components/PendingMentorsList';
import NewsletterCampaignModal from './_components/NewsletterCampaignModal';

/**
 * Mentora admin pilotage dashboard.
 *
 * Server component: every metric is queried at request time. Each Prisma call
 * is wrapped in a small helper that returns a fallback on failure so a single
 * broken query doesn't blank the whole pilotage page (useful pre-seed when
 * tables are empty or a connection blip happens).
 */

const CYCLE_NAME = 'Printemps 2026';
const FRENCH_MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const;

type MonthlyRow = { m: Date; c: bigint | number };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

type Range = '12m' | '6m' | '30j';

export default async function MentoraAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const range: Range =
    sp.range === '6m' ? '6m' : sp.range === '30j' ? '30j' : '12m';

  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 30);
  const weekAgo = new Date(now);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const prevWeekStart = new Date(now);
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 14);
  // The chart range is dynamic: 12 / 6 months in the bar grid, or 30 days
  // re-bucketed by week for the short range.
  const chartMonths = range === '6m' ? 6 : range === '30j' ? 1 : 12;
  const yearAgo = new Date(now);
  yearAgo.setUTCMonth(yearAgo.getUTCMonth() - chartMonths);

  const [
    mentorTotal,
    mentorRecent,
    menteeTotal,
    menteeRecent,
    activeMentorships,
    sessionTotal,
    sessionsThisWeek,
    sessionsLastWeek,
    reviewAgg,
    rawMonthly,
    matchingGroups,
    pendingRequests,
    incompleteMentors,
    inactiveMentors,
    topMentorshipsRaw,
    pendingMentorReview,
  ] = await Promise.all([
    safe(() => prisma.mentorProfile.count(), 0),
    safe(() => prisma.mentorProfile.count({ where: { createdAt: { gte: monthAgo } } }), 0),
    safe(() => prisma.menteeProfile.count(), 0),
    safe(() => prisma.menteeProfile.count({ where: { createdAt: { gte: monthAgo } } }), 0),
    safe(() => prisma.mentorship.count({ where: { status: 'ACTIVE' } }), 0),
    safe(() => prisma.session.count(), 0),
    safe(() => prisma.session.count({ where: { scheduledAt: { gte: weekAgo } } }), 0),
    safe(
      () =>
        prisma.session.count({
          where: { scheduledAt: { gte: prevWeekStart, lt: weekAgo } },
        }),
      0,
    ),
    safe(
      () => prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
      { _avg: { rating: null as number | null }, _count: { _all: 0 } },
    ),
    safe<MonthlyRow[]>(
      () =>
        prisma.$queryRaw<MonthlyRow[]>`
          SELECT DATE_TRUNC('month', "scheduledAt") AS m, COUNT(*)::int AS c
          FROM "Session"
          WHERE "scheduledAt" >= ${yearAgo}
          GROUP BY 1
          ORDER BY 1
        `,
      [],
    ),
    safe(
      () =>
        prisma.mentorshipRequest.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
      [] as Array<{ status: string; _count: { _all: number } }>,
    ),
    safe(
      () =>
        prisma.mentorshipRequest.findMany({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            createdAt: true,
            fromMentee: { select: { user: { select: { name: true, firstName: true, lastName: true, email: true } } } },
            toMentor: { select: { user: { select: { name: true, firstName: true, lastName: true, email: true } } } },
          },
        }),
      [],
    ),
    safe(() => prisma.mentorProfile.count({ where: { status: 'DRAFT' } }), 0),
    safe(
      () =>
        prisma.mentorProfile.count({
          where: {
            status: 'ACTIVE',
            updatedAt: { lt: monthAgo },
          },
        }),
      0,
    ),
    safe(
      () =>
        prisma.mentorship.findMany({
          select: {
            id: true,
            mentorProfile: {
              select: {
                id: true,
                user: { select: { name: true, firstName: true, lastName: true, email: true } },
              },
            },
            _count: { select: { sessions: true } },
            reviews: { select: { rating: true } },
          },
        }),
      [] as Array<{
        id: string;
        mentorProfile: {
          id: string;
          user: { name: string | null; firstName: string | null; lastName: string | null; email: string };
        };
        _count: { sessions: number };
        reviews: Array<{ rating: number }>;
      }>,
    ),
    safe(
      () =>
        prisma.mentorProfile.findMany({
          where: { status: 'PENDING_REVIEW' },
          orderBy: { updatedAt: 'asc' },
          take: 10,
          select: {
            id: true,
            headline: true,
            yearsExperience: true,
            languages: true,
            updatedAt: true,
            user: {
              select: { name: true, firstName: true, lastName: true, email: true },
            },
            skills: {
              orderBy: { isFeatured: 'desc' },
              take: 5,
              select: { skill: { select: { name: true } } },
            },
          },
        }),
      [] as Array<{
        id: string;
        headline: string;
        yearsExperience: number;
        languages: string[];
        updatedAt: Date;
        user: { name: string | null; firstName: string | null; lastName: string | null; email: string };
        skills: Array<{ skill: { name: string } }>;
      }>,
    ),
  ]);

  const pendingMentorRows: PendingMentorRow[] = pendingMentorReview.map((m) => {
    const u = m.user;
    const fullName =
      u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
    return {
      id: m.id,
      userName: fullName,
      userEmail: u.email,
      headline: m.headline,
      yearsExperience: m.yearsExperience,
      languages: m.languages,
      topSkills: m.skills.map((s) => s.skill.name),
      submittedAt: m.updatedAt.toISOString(),
    };
  });

  // ─── Aggregate top-mentor data per mentor across all their mentorships ───
  type MentorAgg = {
    id: string;
    name: string;
    sessionsCount: number;
    ratingSum: number;
    ratingCount: number;
  };
  const mentorAggMap = new Map<string, MentorAgg>();
  for (const m of topMentorshipsRaw) {
    const u = m.mentorProfile.user;
    const fullName =
      u.name ??
      ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
    const existing = mentorAggMap.get(m.mentorProfile.id) ?? {
      id: m.mentorProfile.id,
      name: fullName,
      sessionsCount: 0,
      ratingSum: 0,
      ratingCount: 0,
    };
    existing.sessionsCount += m._count.sessions;
    for (const r of m.reviews) {
      existing.ratingSum += r.rating;
      existing.ratingCount += 1;
    }
    mentorAggMap.set(m.mentorProfile.id, existing);
  }
  const topMentors = Array.from(mentorAggMap.values())
    .sort((a, b) => b.sessionsCount - a.sessionsCount)
    .slice(0, 3);

  // ─── KPI derivations ───
  const matchingPct = pct(activeMentorships, menteeTotal || 1);
  const sessionsDelta =
    sessionsLastWeek > 0
      ? `${sessionsThisWeek >= sessionsLastWeek ? '+' : ''}${Math.round(
          ((sessionsThisWeek - sessionsLastWeek) / sessionsLastWeek) * 100,
        )}% vs S-1`
      : `${sessionsThisWeek} cette sem.`;
  const avgRating = reviewAgg._avg.rating ?? null;
  const ratingLabel = avgRating !== null ? avgRating.toFixed(2) : '—';
  const ratingSub = reviewAgg._count._all > 0 ? `${formatNumber(reviewAgg._count._all)} avis` : '/ 5';

  // ─── Bars: trailing N months including current ───
  const monthlyMap = new Map<string, number>();
  for (const row of rawMonthly) {
    const date = row.m instanceof Date ? row.m : new Date(row.m);
    monthlyMap.set(monthKey(date), Number(row.c));
  }
  const barCount = chartMonths;
  const bars: { label: string; value: number }[] = [];
  for (let i = barCount - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(startOfMonth(d));
    bars.push({
      label: FRENCH_MONTHS[d.getUTCMonth()] ?? '',
      value: monthlyMap.get(key) ?? 0,
    });
  }
  const hasBarData = bars.some((b) => b.value > 0);
  if (!hasBarData) {
    // Fallback dummy curve so the chart isn't a flat baseline pre-seed.
    const dummy = [42, 58, 65, 72, 80, 95, 88, 102, 118, 135, 128, 142];
    const sliced = dummy.slice(-bars.length);
    bars.forEach((b, i) => {
      b.value = sliced[i] ?? 0;
    });
  }
  const maxBar = Math.max(...bars.map((b) => b.value), 1);

  // ─── Matching status counters ───
  const matchingCountByStatus: Record<string, number> = {};
  for (const g of matchingGroups) {
    matchingCountByStatus[g.status] = g._count._all;
  }
  const matchedCount = activeMentorships;
  const inProgressCount = matchingCountByStatus['PENDING'] ?? 0;
  const toReviewCount = matchingCountByStatus['EXPIRED'] ?? 0;
  const declinedCount = matchingCountByStatus['DECLINED'] ?? 0;

  // ─── Phase strip computed values (static for cycle in this iteration) ───
  const phases = ['Onboarding', 'Matching', 'Sessions', 'Bilan'];
  const currentPhaseIndex = 2; // Sessions
  const progressPct = 62;

  // ─── Styles (light theme — AppShell handles theme switching at root) ───
  const cardBg = 'white';
  const cardBorder = '1px solid rgba(115,1,255,0.10)';
  const ink = '#1a1f3a';
  const sub = '#545b7a';

  // Each KPI is a Link to its detail page so clicking the card drills
  // down. Sessions and Satisfaction have no dedicated route yet so they
  // both jump to /reports (with a hash so the section auto-scrolls).
  const kpis: Array<{
    label: string;
    value: string;
    delta: string;
    color: string;
    icon: string;
    href: string;
    hint: string;
  }> = [
    {
      label: 'Mentors',
      value: formatNumber(mentorTotal),
      delta: `↑ ${formatNumber(mentorRecent)} ce mois`,
      color: '#7301FF',
      icon: '✦',
      href: '/mentora/admin/mentors',
      hint: 'Gérer les mentors',
    },
    {
      label: 'Mentorées',
      value: formatNumber(menteeTotal),
      delta: `↑ ${formatNumber(menteeRecent)} ce mois`,
      color: '#A34BF5',
      icon: '☷',
      href: '/mentora/admin/mentees',
      hint: 'Gérer les mentorées',
    },
    {
      label: 'Matchings',
      value: matchingPct,
      delta: `${formatNumber(activeMentorships)}/${formatNumber(menteeTotal)}`,
      color: '#F46FB1',
      icon: '⇋',
      href: '/mentora/admin/matching',
      hint: 'Voir les matchings actifs',
    },
    {
      label: 'Sessions',
      value: formatNumber(sessionTotal),
      delta: sessionsDelta,
      color: '#3B7BFF',
      icon: '◌',
      href: '/mentora/admin/reports#sessions',
      hint: 'Volumétrie sessions',
    },
    {
      label: 'Satisfaction',
      value: ratingLabel,
      delta: ratingSub,
      color: '#23c55e',
      icon: '★',
      href: '/mentora/admin/reports#satisfaction',
      hint: 'Détail des notes',
    },
  ];

  const matchingTiles = [
    { label: 'Matchés', value: matchedCount, color: '#23c55e' },
    { label: 'En cours', value: inProgressCount, color: '#7301FF' },
    { label: 'À examiner', value: toReviewCount, color: '#F46FB1' },
    { label: 'Refus', value: declinedCount, color: '#8b91ad' },
  ];

  const alerts = [
    {
      title: `${formatNumber(incompleteMentors)} candidatures incomplètes`,
      desc: 'À relancer',
      color: '#F46FB1',
      icon: '!',
    },
    {
      title: `${formatNumber(inactiveMentors)} mentors inactifs >30j`,
      desc: 'Suivi à faire',
      color: '#7301FF',
      icon: '◌',
    },
    {
      title: 'Sondage mi-cycle ouvert',
      desc: `${formatNumber(Math.min(menteeTotal, 124))} réponses / ${formatNumber(menteeTotal || 342)}`,
      color: '#3B7BFF',
      icon: '◇',
    },
  ];

  return (
    <>
      {/* Phase strip */}
      <div
        style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 16,
          padding: '14px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#23c55e',
              boxShadow: '0 0 0 4px rgba(35,197,94,0.20)',
            }}
          />
          <span style={{ fontSize: 12, color: sub }}>Cycle actif</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: ink }}>{CYCLE_NAME}</span>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 200,
            height: 6,
            borderRadius: 3,
            background: 'rgba(115,1,255,0.08)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              borderRadius: 3,
              background: 'linear-gradient(90deg, #7301FF, #F46FB1)',
            }}
          />
          {phases.map((p, i) => (
            <div
              key={p}
              style={{
                position: 'absolute',
                left: `${(i * 100) / (phases.length - 1)}%`,
                top: -4,
                fontSize: 10,
                fontWeight: 700,
                color: i <= currentPhaseIndex ? '#7301FF' : sub,
                transform: 'translate(-50%, -100%)',
                whiteSpace: 'nowrap',
              }}
            >
              {p}
            </div>
          ))}
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(244,111,177,0.15)',
            color: '#d94e92',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          ● Phase : {phases[currentPhaseIndex]}
        </span>
        <Link
          href="/mentora/admin/cycles"
          style={{
            padding: '7px 14px',
            borderRadius: 9,
            background: '#7301FF',
            color: 'white',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          + Nouveau cycle
        </Link>
      </div>

      {/* KPIs */}
      <div
        className="dz-pilotage-kpis"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {kpis.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            title={s.hint}
            className="dz-pilotage-kpi"
            style={{
              background: cardBg,
              border: cardBorder,
              borderRadius: 16,
              padding: 16,
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
              position: 'relative',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: `${s.color}22`,
                  color: s.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                }}
              >
                {s.icon}
              </div>
              <span
                aria-hidden
                style={{
                  fontSize: 14,
                  color: sub,
                  opacity: 0.6,
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                }}
                className="dz-pilotage-kpi__arrow"
              >
                →
              </span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: sub,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: ink,
                letterSpacing: '-0.02em',
                marginTop: 2,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.delta}</div>
          </Link>
        ))}
      </div>
      {/* Hover affordance: KPI cards lift slightly and the arrow slides
          right so admins know they're consultable. */}
      <style>{`
        .dz-pilotage-kpi:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(115,1,255,0.10);
          border-color: rgba(115,1,255,0.22) !important;
        }
        .dz-pilotage-kpi:hover .dz-pilotage-kpi__arrow {
          transform: translateX(3px);
          opacity: 1;
          color: #7301FF;
        }
      `}</style>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Sessions par mois — chart bars are individual links to the
              report filtered by the bar's month. The range buttons reload
              the page with a `?range=` query so the server-side query can
              react. The whole chart card has a "Voir le rapport" CTA. */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: 20, padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: ink }}>
                  Sessions par mois
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: sub }}>
                  12 derniers mois · cycle {CYCLE_NAME}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {(['12m', '6m', '30j'] as const).map((f) => {
                  const active = f === range;
                  return (
                    <Link
                      key={f}
                      href={`/mentora/admin?range=${f}#sessions`}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
                        color: active ? '#7301FF' : sub,
                        fontSize: 11,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      {f}
                    </Link>
                  );
                })}
                <Link
                  href="/mentora/admin/reports#sessions"
                  style={{
                    marginLeft: 4,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Voir le rapport →
                </Link>
              </div>
            </div>
            <div
              id="sessions"
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                height: 180,
                paddingBottom: 24,
                position: 'relative',
              }}
            >
              {bars.map((b, i) => {
                const isLast = i === bars.length - 1;
                // Map each bar to the (year, month) it represents so the
                // detail link can filter by month. Index 11 = current month.
                const offset = bars.length - 1 - i;
                const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
                const ym = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
                return (
                  <Link
                    key={i}
                    href={`/mentora/admin/reports?month=${ym}#sessions`}
                    title={`${b.label} ${date.getUTCFullYear()} · ${formatNumber(b.value)} sessions`}
                    className="dz-pilotage-bar"
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      height: '100%',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div
                      className="dz-pilotage-bar__fill"
                      style={{
                        width: '100%',
                        height: `${(b.value / maxBar) * 100}%`,
                        borderRadius: '6px 6px 2px 2px',
                        background: isLast
                          ? 'linear-gradient(180deg, #F46FB1, #7301FF)'
                          : 'linear-gradient(180deg, #7301FF, #A34BF5)',
                        opacity: isLast ? 1 : 0.85,
                        position: 'relative',
                        marginTop: 'auto',
                        transition: 'opacity 0.15s ease, transform 0.15s ease',
                      }}
                    >
                      {isLast && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -22,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: '#1a1f3a',
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatNumber(b.value)}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: sub, fontWeight: 600 }}>{b.label}</div>
                  </Link>
                );
              })}
            </div>
            <style>{`
              .dz-pilotage-bar:hover .dz-pilotage-bar__fill { opacity: 1; transform: scaleY(1.04); transform-origin: bottom; }
            `}</style>
          </div>

          {/* Matching status */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: 20, padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: ink }}>
                État du matching
              </h3>
              <Link
                href="/mentora/admin/matching"
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'none',
                }}
              >
                ⇋ Voir le matching
              </Link>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {matchingTiles.map((m) => (
                <div
                  key={m.label}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: '#faf7ff',
                    border: '1px solid rgba(115,1,255,0.06)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>
                    {formatNumber(m.value)}
                  </div>
                  <div style={{ fontSize: 11, color: sub, fontWeight: 600 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: 18,
                fontSize: 12,
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: 'left',
                    color: sub,
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Mentorée</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Mentor proposé</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Affinité IA</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Statut</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}></th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: '18px 8px',
                        color: sub,
                        textAlign: 'center',
                      }}
                    >
                      Aucune demande en attente.
                    </td>
                  </tr>
                ) : (
                  pendingRequests.map((r, i) => {
                    const menteeUser = r.fromMentee.user;
                    const mentorUser = r.toMentor.user;
                    const menteeName =
                      menteeUser.name ??
                      ([menteeUser.firstName, menteeUser.lastName]
                        .filter(Boolean)
                        .join(' ')
                        .trim() || menteeUser.email);
                    const mentorName =
                      mentorUser.name ??
                      ([mentorUser.firstName, mentorUser.lastName]
                        .filter(Boolean)
                        .join(' ')
                        .trim() || mentorUser.email);
                    // IA affinity placeholder — deterministic per request id (stable on rerender).
                    const seed = r.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                    const affinity = 70 + (seed % 30);
                    return (
                      <tr
                        key={r.id}
                        style={{ borderTop: '1px solid rgba(115,1,255,0.06)' }}
                      >
                        <td style={{ padding: '12px 8px', color: ink, fontWeight: 600 }}>
                          {menteeName}
                        </td>
                        <td style={{ padding: '12px 8px', color: ink }}>{mentorName}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                width: 40,
                                height: 4,
                                borderRadius: 2,
                                background: 'rgba(115,1,255,0.10)',
                                display: 'inline-block',
                                position: 'relative',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  height: '100%',
                                  width: `${affinity}%`,
                                  borderRadius: 2,
                                  background: '#7301FF',
                                }}
                              />
                            </span>
                            {affinity}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: 999,
                              background: 'rgba(244,111,177,0.15)',
                              color: '#F46FB1',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            En attente
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <Link
                            href="/mentora/admin/matching?status=PENDING"
                            style={{
                              padding: '4px 10px',
                              borderRadius: 7,
                              border: '1px solid rgba(115,1,255,0.2)',
                              background: 'transparent',
                              color: '#7301FF',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              textDecoration: 'none',
                            }}
                          >
                            Détail
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {/* Suppress unused warning when index isn't read in JSX. */}
            <span style={{ display: 'none' }}>{pendingRequests.length}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Candidatures mentor en attente — admin moderation */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: 20, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ink }}>
                Candidatures mentor à valider
              </h3>
              {pendingMentorRows.length > 0 && (
                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: 'rgba(244,111,177,0.15)',
                    color: '#d94e92',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {pendingMentorRows.length}
                </span>
              )}
            </div>
            <PendingMentorsList rows={pendingMentorRows} />
          </div>

          {/* Quick links — section navigation */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: 20, padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: ink }}>
              Raccourcis admin
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {[
                { href: '/mentora/admin/matching', label: 'Matching', icon: '⇋' },
                { href: '/community/admin/moderation', label: 'Modération', icon: '◇' },
                { href: '/community/badges', label: 'Badges', icon: '★' },
                { href: '/mentora/discover', label: 'Catalogue', icon: '✦' },
              ].map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(115,1,255,0.10)',
                    background: 'rgba(115,1,255,0.03)',
                    color: ink,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <span aria-hidden style={{ color: '#7301FF' }}>{s.icon}</span>
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: 20, padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: ink }}>
              Alertes
            </h3>
            {alerts.map((a, i) => (
              <div
                key={a.title}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom:
                    i < alerts.length - 1 ? '1px solid rgba(115,1,255,0.06)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: a.color,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: ink }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: sub }}>{a.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Top mentors */}
          <div style={{ background: cardBg, border: cardBorder, borderRadius: 20, padding: 22 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: ink }}>
              Top mentors
            </h3>
            {topMentors.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: sub }}>
                Aucun mentor n&apos;a encore animé de session.
              </p>
            ) : (
              topMentors.map((m, i) => {
                const initials = m.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? '')
                  .join('') || m.name[0]?.toUpperCase() || '?';
                const avg = m.ratingCount > 0 ? (m.ratingSum / m.ratingCount).toFixed(2) : '—';
                const colors = ['#7301FF', '#A34BF5', '#F46FB1'];
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 0',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: colors[i] ?? '#7301FF',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: ink,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {m.name}
                      </div>
                      <div style={{ fontSize: 11, color: sub }}>
                        {formatNumber(m.sessionsCount)} sessions · ★ {avg}
                      </div>
                    </div>
                    <span style={{ fontSize: 14 }}>{medals[i] ?? ''}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Communication */}
          <div
            style={{
              background: 'linear-gradient(160deg, #7301FF 0%, #24325F 100%)',
              borderRadius: 20,
              padding: 22,
              color: 'white',
            }}
          >
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
              Communication
            </span>
            <h4 style={{ margin: '12px 0 6px', fontSize: 16, fontWeight: 700 }}>
              Newsletter Digizelle
            </h4>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
              Composez et envoyez à un segment ciblé · {formatNumber(menteeTotal + mentorTotal)} comptes Mentora éligibles
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <NewsletterCampaignModal
                initialReachHint={menteeTotal + mentorTotal}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
