import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { fmtDate } from '../_components/format';

export const dynamic = 'force-dynamic';

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

/**
 * Mentee goals dashboard — designed against `mentora-mentee-tabs.jsx#Goals`.
 *
 * Surfaces every `MentorshipGoal` from the mentee's active mentorships
 * grouped by mentorship, plus a top-row of KPIs computed on the fly:
 *   - Active goals: count of mentorships that still have at least one
 *     non-achieved goal.
 *   - Steps completed: ratio "{achieved} / {total}" across all goals.
 *   - Avg time / step: mean (achievedAt − createdAt) for completed
 *     goals, displayed in days.
 *   - Next deadline: closest mentorship `endedAt` when present (used
 *     as a soft proxy for the cycle's end), else "—".
 *
 * The schema doesn't model per-step / sub-task breakdown today, so we
 * render a single "step" pill per goal and a per-mentorship progress
 * bar (achieved / total). The visual structure mirrors the design
 * even when the data is sparser than the mockup.
 */
export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/goals');

  const t = await getTranslations('mentora.dashboard.goalsPage');
  const userId = session.user.id;

  // Pull every goal across the mentee's mentorships, hydrated with the
  // mentor's name so we can show "Avec X" in the card subtitle.
  const mentorships = await prisma.mentorship.findMany({
    where: { menteeProfile: { userId } },
    include: {
      mentorProfile: { include: { user: true } },
      goals: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
  });

  // Flat list for KPI math — easier than re-summing inside the JSX.
  const allGoals = mentorships.flatMap((m) =>
    m.goals.map((g) => ({ ...g, mentorshipId: m.id })),
  );
  const totalGoals = allGoals.length;
  const achievedGoals = allGoals.filter((g) => g.isAchieved);
  const achievedCount = achievedGoals.length;

  // Mentorships with at least one open goal — closer to the design's
  // "Objectifs actifs · 3" reading than counting every goal row.
  const activeMentorshipsWithOpenGoals = mentorships.filter((m) =>
    m.goals.some((g) => !g.isAchieved),
  );
  const activeCount = activeMentorshipsWithOpenGoals.length;

  // Avg days per completed step.
  let avgDaysLabel = t('kpiAvgEmpty');
  if (achievedCount > 0) {
    const totalMs = achievedGoals.reduce((acc, g) => {
      if (!g.achievedAt) return acc;
      return acc + (g.achievedAt.getTime() - g.createdAt.getTime());
    }, 0);
    const days = Math.max(1, Math.round(totalMs / achievedCount / (24 * 60 * 60 * 1000)));
    avgDaysLabel = t('kpiAvgDays', { days });
  }

  // Next deadline: closest mentorship endedAt that's still in the
  // future, falling back to "—" when none.
  const now = new Date();
  const upcomingEnds = mentorships
    .map((m) => m.endedAt)
    .filter((d): d is Date => !!d && d.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const nextDeadlineLabel =
    upcomingEnds.length > 0 ? fmtDate(upcomingEnds[0]!) : t('kpiNextEmpty');

  const kpis: Array<{
    key: 'active' | 'completed' | 'avgTime' | 'nextDeadline';
    value: string;
    accent: string;
  }> = [
    { key: 'active', value: String(activeCount), accent: '#7301FF' },
    { key: 'completed', value: `${achievedCount}/${totalGoals}`, accent: '#A34BF5' },
    { key: 'avgTime', value: avgDaysLabel, accent: '#F46FB1' },
    { key: 'nextDeadline', value: nextDeadlineLabel, accent: '#3B7BFF' },
  ];

  // Only show mentorships that have at least one goal — empty
  // mentorships are noise on this page.
  const mentorshipsWithGoals = mentorships.filter((m) => m.goals.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
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
          {t('kicker')}
        </span>
        <h1 className="dz-h2" style={{ fontSize: 26, margin: '6px 0 0' }}>
          {t('title')}
        </h1>
        <p className="dz-body" style={{ marginTop: 6 }}>
          {t('subtitle')}
        </p>
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.key}
            className="dz-card"
            style={{ padding: 18 }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#545b7a',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {t(`kpis.${k.key}`)}
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: k.accent,
                marginTop: 6,
                letterSpacing: '-0.02em',
              }}
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Section title + "+ Nouvel objectif" CTA — rendered ALWAYS, so
          users can add a goal even when the list is empty. The CTA
          links to the first available mentorship's detail page where
          the goal-creation form lives; if the user has no mentorships
          yet we route them to /mentora/dashboard/mentorships so they
          can pick one. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          {t('listTitle', { count: activeCount })}
        </h2>
        <a
          href={
            mentorships.length > 0
              ? `/mentora/dashboard/mentorships/${mentorships[0]!.id}`
              : '/mentora/dashboard/mentorships'
          }
          style={{
            padding: '10px 18px',
            borderRadius: 11,
            background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 8px 18px rgba(115,1,255,0.30)',
          }}
        >
          {t('card.newGoal')}
        </a>
      </div>

      {mentorshipsWithGoals.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body" style={{ margin: 0 }}>
            {t('empty')}
          </p>
        </div>
      ) : (
        <>
          {/* Section title with new-goal CTA — moved out above so it
              renders even when the list is empty. The duplicate header
              has been removed; this branch keeps just the cards list. */}
          <div
            style={{
              display: 'none',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
              {t('listTitle', { count: activeCount })}
            </h2>
            {/* Goal creation lives in the mentorship detail page — link
                the user to their first active mentorship to add a goal. */}
            {mentorships.length > 0 && (
              <a
                href={`/mentora/dashboard/mentorships/${mentorships[0]!.id}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 8px 18px rgba(115,1,255,0.30)',
                }}
              >
                {t('card.newGoal')}
              </a>
            )}
          </div>

          {/* Goal cards — one per mentorship that has goals */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mentorshipsWithGoals.map((m, idx) => {
              const accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
              const total = m.goals.length;
              const done = m.goals.filter((g) => g.isAchieved).length;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              const allDone = pct === 100;

              const u = m.mentorProfile.user;
              const mentorName =
                u.name ??
                ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
              // Title: surface a goal-ish summary by joining the first
              // 2 active goals' descriptions, capped, else fall back
              // to a generic label tied to the mentor.
              const headline =
                m.goals
                  .filter((g) => !g.isAchieved)
                  .slice(0, 1)
                  .map((g) => g.description)
                  .join(' · ') ||
                m.goals[0]?.description ||
                t('card.withMentor', { name: mentorName });
              const truncated =
                headline.length > 100 ? `${headline.slice(0, 100)}…` : headline;

              return (
                <article
                  key={m.id}
                  className="dz-card"
                  style={{ padding: 22 }}
                >
                  {/* Header: status pill + deadline + percent */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: allDone ? 'rgba(35,197,94,0.15)' : 'rgba(35,197,94,0.10)',
                            color: '#16a34a',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {allDone ? t('card.achieved') : t('card.onTrack')}
                        </span>
                        <span style={{ fontSize: 11, color: '#545b7a' }}>
                          {t('card.withMentor', { name: mentorName })}
                        </span>
                      </div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#1a1f3a',
                          lineHeight: 1.35,
                        }}
                      >
                        {truncated}
                      </h3>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          color: accent,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                      >
                        {pct}%
                      </div>
                      <div style={{ fontSize: 10, color: '#8b91ad', marginTop: 2 }}>
                        {t('card.completedSuffix')}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    style={{
                      marginTop: 12,
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
                        borderRadius: 3,
                        background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
                        transition: 'width 250ms ease',
                      }}
                    />
                  </div>

                  {/* Goal list — done items show a check, with the title
                      strikethrough; pending items show a hollow circle. */}
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: '14px 0 0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {m.goals.map((g) => (
                      <li
                        key={g.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: g.isAchieved
                            ? 'rgba(35,197,94,0.05)'
                            : '#faf7ff',
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: g.isAchieved ? '#23c55e' : 'transparent',
                            border: g.isAchieved
                              ? 'none'
                              : '1.5px solid rgba(115,1,255,0.30)',
                            color: 'white',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {g.isAchieved ? '✓' : ''}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: g.isAchieved ? '#8b91ad' : '#1a1f3a',
                            textDecoration: g.isAchieved ? 'line-through' : 'none',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {g.description}
                        </span>
                        <span
                          className="dz-small"
                          style={{ fontSize: 11, color: '#8b91ad', flexShrink: 0 }}
                        >
                          {g.isAchieved && g.achievedAt
                            ? t('card.completedAt', { date: fmtDate(g.achievedAt) })
                            : t('card.createdAt', { date: fmtDate(g.createdAt) })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
