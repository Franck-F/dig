import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import StatusPill from '../_components/StatusPill';
import { fmtDate } from '../_components/format';

/**
 * Mentorships listing — every mentorship the current user belongs to
 * (mentor side OR mentee side). Designed against the `mentora-mentee-tabs`
 * "Mes mentors" mockup: cards with a coloured gradient header strip,
 * initials avatar overlapping the strip, status pill, frequency / format
 * line, next-session readout and a footer CTA.
 *
 * Order: ACTIVE first, then PAUSED, then COMPLETED / TERMINATED, most
 * recent within each group.
 */
const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  const out = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return out || cleaned.slice(0, 2).toUpperCase();
}

export default async function MentorshipsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/mentorships');

  const t = await getTranslations('mentora.mentorships');

  const userId = session.user.id;

  const mentorships = await prisma.mentorship.findMany({
    where: {
      OR: [{ mentorProfile: { userId } }, { menteeProfile: { userId } }],
    },
    include: {
      mentorProfile: { include: { user: true } },
      menteeProfile: { include: { user: true } },
      // Pull the next upcoming SCHEDULED session per mentorship so we
      // can surface "Prochaine session" right on the card without a
      // second round trip per row.
      sessions: {
        where: { status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 1,
        select: { id: true, scheduledAt: true, durationMinutes: true },
      },
      _count: { select: { sessions: true } },
    },
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
  });

  // Status counts for the filter pills (no client filter wiring yet —
  // displayed as informative chips that mirror the design).
  const statusCounts = mentorships.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 className="dz-h2" style={{ fontSize: 24, margin: 0 }}>
              {t('title')}
            </h1>
            <p className="dz-body" style={{ marginTop: 6 }}>
              {t('subtitle')}
            </p>
          </div>
          {/* Filter chips (display-only — match the design language) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'ACTIVE', label: t('statusLabels.active'), color: '#23c55e' },
              { key: 'PAUSED', label: t('statusLabels.paused'), color: '#FFB823' },
              { key: 'COMPLETED', label: t('statusLabels.completed'), color: '#7301FF' },
            ].map((f) => {
              const n = statusCounts[f.key] ?? 0;
              if (n === 0) return null;
              return (
                <span
                  key={f.key}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: `${f.color}15`,
                    color: f.color,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {f.label} · {n}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {mentorships.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body">{t('empty')}</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
          }}
        >
          {mentorships.map((m, idx) => {
            const iAmMentor = m.mentorProfile.userId === userId;
            const otherUser = iAmMentor ? m.menteeProfile.user : m.mentorProfile.user;
            const otherName =
              otherUser.name ??
              ([otherUser.firstName, otherUser.lastName].filter(Boolean).join(' ').trim() ||
                otherUser.email);
            const initials = initialsFor(otherName);
            const accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
            const statusKey = m.status.toLowerCase() as
              | 'active'
              | 'paused'
              | 'completed'
              | 'terminated';
            const headline = iAmMentor
              ? t('card.withMentee', { name: otherName })
              : t('card.withMentor', { name: otherName });
            const subtitle = iAmMentor
              ? m.menteeProfile.goals.split('\n')[0].slice(0, 80)
              : m.mentorProfile.headline;
            const nextSession = m.sessions[0];

            return (
              <Link
                key={m.id}
                href={`/mentora/dashboard/mentorships/${m.id}`}
                className="dz-card"
                style={{
                  padding: 0,
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 120ms',
                }}
              >
                {/* Coloured header band — sets the row's accent identity */}
                <div
                  aria-hidden
                  style={{
                    height: 70,
                    background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                    }}
                  >
                    <StatusPill status={m.status} label={t(`statusLabels.${statusKey}`)} />
                  </span>
                </div>
                <div style={{ padding: '0 20px 20px' }}>
                  {/* Avatar overlapping the band */}
                  <div
                    aria-hidden
                    translate="no"
                    title={otherName}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 18,
                      marginTop: -28,
                      border: '4px solid white',
                      boxShadow: '0 8px 18px rgba(36,18,80,0.18)',
                    }}
                  >
                    {initials}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{headline}</div>
                    {subtitle && (
                      <div
                        className="dz-small"
                        style={{
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {subtitle}
                      </div>
                    )}
                  </div>

                  <div className="dz-small" style={{ marginTop: 12, lineHeight: 1.6 }}>
                    {t('card.startedAt', { date: fmtDate(m.startedAt) })}
                    {m.endedAt && (
                      <>
                        <br />
                        {t('card.endedAt', { date: fmtDate(m.endedAt) })}
                      </>
                    )}
                  </div>
                  <div className="dz-small" style={{ marginTop: 4 }}>
                    {t('card.frequency', { value: m.agreedFrequency })} ·{' '}
                    {t('card.format', { value: t(`format.${m.agreedFormat}`) })}
                  </div>

                  {/* Next-session strip + footer CTA */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: '1px solid rgba(115,1,255,0.08)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="dz-small" style={{ fontSize: 11 }}>
                        {t('card.nextSessionLabel')}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {nextSession
                          ? `${fmtDate(nextSession.scheduledAt)} · ${nextSession.durationMinutes} min`
                          : t('card.noUpcomingSession')}
                      </div>
                    </div>
                    <span
                      className="dz-small"
                      style={{
                        color: accent,
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                        marginLeft: 8,
                      }}
                    >
                      {t('card.openCta')}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
