import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';
import { fmtDate } from '../_components/format';

export const dynamic = 'force-dynamic';

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned.slice(0, 2).toUpperCase();
}

/**
 * Stars: a 5-position 1..5 readout. Filled stars use #FFB823, empties
 * are rendered with #d8d4e6 so the bar reads even at small ratings.
 */
function Stars({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-label={`${clamped}/5`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            color: i < clamped ? '#FFB823' : '#d8d4e6',
            fontSize: 14,
            letterSpacing: 1,
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * Mentor feedbacks page — designed against `mentora-mentor-tabs.jsx#Feedbacks`.
 *
 *   - 4 KPI cards: average rating, recommendation rate (% of mentees
 *     who left a 4★+ review), total sessions delivered, completion
 *     rate (% of cycles ended with status COMPLETED).
 *   - "TOP MENTOR" gradient banner — only renders when the average is
 *     ≥ 4.85 across at least 5 reviews (matches the design's
 *     "5% mieux notés" copy without a leaderboard query).
 *   - Card list: avatar + mentee name + cycle/date + stars + comment
 *     + auto-extracted tag chips (capitalised tokens from the body).
 *
 * Mentee-side users get redirected to /mentora/dashboard since this
 * page only makes sense from the mentor's perspective.
 */
export default async function FeedbacksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/feedbacks');

  const profile = await getCurrentRoleProfile(session.user.id);
  if (profile.kind !== 'mentor') {
    redirect('/mentora/dashboard');
  }

  const t = await getTranslations('mentora.dashboard.feedbacksPage');
  const userId = session.user.id;
  const mentorProfileId = profile.mentorProfile.id;

  const [reviews, allMyMentorships, completedSessionsCount] = await Promise.all([
    prisma.review.findMany({
      where: {
        mentorship: { mentorProfileId },
        isPublic: true,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { name: true, firstName: true, lastName: true } },
        mentorship: {
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
            status: true,
          },
        },
      },
      take: 50,
    }),
    prisma.mentorship.findMany({
      where: { mentorProfileId },
      select: { id: true, status: true, startedAt: true },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.session.count({
      where: { mentorship: { mentorProfileId }, status: 'COMPLETED' },
    }),
  ]);

  // KPI math
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount : 0;

  const recommendingReviewers = new Set(
    reviews.filter((r) => r.rating >= 4).map((r) => r.authorUserId),
  );
  const allMenteeUserIds = new Set(reviews.map((r) => r.authorUserId));
  const recommended = recommendingReviewers.size;
  const totalReviewers = Math.max(allMenteeUserIds.size, recommendingReviewers.size, 1);

  const totalCycles = allMyMentorships.length;
  const completedCycles = allMyMentorships.filter((m) => m.status === 'COMPLETED').length;
  const completionPct =
    totalCycles > 0 ? Math.round((completedCycles / totalCycles) * 100) : 0;

  // "Mentor since" — the year of the earliest mentorship startedAt.
  const earliestStart = allMyMentorships[0]?.startedAt;
  const sinceYear = earliestStart ? earliestStart.getFullYear() : new Date().getFullYear();

  const kpis = [
    {
      key: 'average' as const,
      value: avgRating > 0 ? avgRating.toFixed(2) : '—',
      meta: t('kpis.averageMeta', { count: reviewCount }),
      accent: '#FFB823',
    },
    {
      key: 'recommendation' as const,
      value: reviewCount > 0 ? `${Math.round((recommended / totalReviewers) * 100)}%` : '—',
      meta: t('kpis.recommendationMeta', {
        recommended,
        total: totalReviewers,
      }),
      accent: '#23c55e',
    },
    {
      key: 'totalSessions' as const,
      value: completedSessionsCount.toLocaleString('fr-FR'),
      meta: t('kpis.totalSessionsMeta', { since: sinceYear }),
      accent: '#7301FF',
    },
    {
      key: 'completion' as const,
      value: `${completionPct}%`,
      meta: t('kpis.completionMeta'),
      accent: '#F46FB1',
    },
  ];

  const isTopMentor = avgRating >= 4.85 && reviewCount >= 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
          <div key={k.key} className="dz-card" style={{ padding: 18 }}>
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
            <div style={{ fontSize: 11, color: '#8b91ad', marginTop: 4 }}>{k.meta}</div>
          </div>
        ))}
      </div>

      {/* Top-mentor gradient banner — only when criteria met */}
      {isTopMentor && (
        <div
          style={{
            background:
              'linear-gradient(135deg, #7301FF 0%, #A34BF5 60%, #F46FB1 110%)',
            borderRadius: 18,
            padding: '24px 28px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(115,1,255,0.28)',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.18)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.22)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.10em',
              }}
            >
              {t('topMentor.tag')}
            </span>
            <h2 style={{ margin: '10px 0 4px', fontSize: 20, fontWeight: 700 }}>
              {t('topMentor.title')}
            </h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>{t('topMentor.body')}</p>
          </div>
          <div
            aria-hidden
            style={{
              fontSize: 56,
              opacity: 0.85,
              flexShrink: 0,
              position: 'relative',
              lineHeight: 1,
            }}
          >
            ★
          </div>
        </div>
      )}

      {/* List header */}
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('listTitle')}</h2>

      {reviews.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body" style={{ margin: 0 }}>
            {t('empty')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.map((r, idx) => {
            const a = r.author;
            const name =
              a.name ??
              ([a.firstName, a.lastName].filter(Boolean).join(' ').trim() ||
                t('anonReviewer'));
            const initials = initialsFor(name);
            const accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];

            // Cycle label = `Cycle N` derived from the mentorship's
            // startedAt year + a short status hint when relevant.
            const startYear = r.mentorship.startedAt.getFullYear();
            const cycleLabel =
              r.mentorship.status === 'ACTIVE'
                ? `Cycle ${startYear} · en cours`
                : r.mentorship.status === 'COMPLETED'
                  ? `Cycle ${startYear} · terminé`
                  : `Cycle ${startYear}`;

            // Tag extraction — pick up to 3 capitalised tokens from
            // the comment body so the cards never feel tag-empty.
            const tagSource = (r.comment ?? '').match(/[A-ZÀ-Ý][\wÀ-ÿ]{3,}/g) ?? [];
            const tags = Array.from(new Set(tagSource)).slice(0, 3);

            return (
              <article
                key={r.id}
                className="dz-card"
                style={{
                  padding: 22,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  aria-hidden
                  translate="no"
                  title={name}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    color: 'white',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 4,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a' }}>
                        {name}
                      </div>
                      <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
                        {t('cycleAndDate', {
                          cycle: cycleLabel,
                          date: fmtDate(r.createdAt),
                        })}
                      </div>
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  {r.comment && (
                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: '#1a1f3a',
                        fontStyle: 'italic',
                      }}
                    >
                      &ldquo;{r.comment}&rdquo;
                    </p>
                  )}
                  {tags.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginTop: 12,
                      }}
                    >
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(115,1,255,0.06)',
                            color: '#7301FF',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
