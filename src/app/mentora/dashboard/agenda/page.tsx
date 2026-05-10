import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';

export const dynamic = 'force-dynamic';

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

/** Day grid spans 8 → 22 (14 hours), matching the mockup. */
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;

function startOfWeek(d: Date): Date {
  // Monday-anchored. JS getDay returns 0=Sun..6=Sat; we want
  // Monday=0..Sunday=6 internally, so a re-mapping helps elsewhere too.
  const out = new Date(d);
  const jsDow = out.getDay();
  const monIdx = (jsDow + 6) % 7; // Mon=0
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - monIdx);
  return out;
}

function endOfWeek(start: Date): Date {
  const out = new Date(start);
  out.setDate(out.getDate() + 7);
  return out;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned.slice(0, 2).toUpperCase();
}

/**
 * Mentor agenda — week-view calendar of upcoming + past sessions
 * within the current week, designed against
 * `mentora-mentor-tabs.jsx#Agenda`.
 *
 *   - KPI strip: this-week count, hours planned, free slot count
 *     (derived from `AvailabilityRule` minus booked sessions),
 *     this-month count.
 *   - Range chip with "← / Aujourd'hui / →" navigation, week/month/list
 *     view switcher (week is the only one wired for now).
 *   - 7-column × hours-row grid with each session rendered as an
 *     absolutely-positioned coloured block carrying mentee initials,
 *     name and the agenda first line.
 *
 * Mentees are routed to /sessions instead — this page is mentor-only.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/agenda');

  const profile = await getCurrentRoleProfile(session.user.id);
  if (profile.kind !== 'mentor') {
    redirect('/mentora/dashboard/sessions');
  }

  const t = await getTranslations('mentora.dashboard.agendaPage');
  const userId = session.user.id;
  const sp = await searchParams;

  // Anchor — `?w=YYYY-MM-DD` jumps to the week containing that date.
  const anchor = sp.w ? new Date(sp.w) : new Date();
  const weekStart = startOfWeek(Number.isNaN(anchor.getTime()) ? new Date() : anchor);
  const weekEnd = endOfWeek(weekStart);
  const monthStart = startOfMonth(weekStart);
  const monthEnd = endOfMonth(weekStart);

  const baseWhere = {
    mentorship: { mentorProfile: { userId } },
  };

  const [weekSessions, monthCount, availabilityRules] = await Promise.all([
    prisma.session.findMany({
      where: {
        ...baseWhere,
        scheduledAt: { gte: weekStart, lt: weekEnd },
        status: { not: 'CANCELLED' },
      },
      include: {
        mentorship: {
          include: { menteeProfile: { include: { user: true } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    }),
    prisma.session.count({
      where: {
        ...baseWhere,
        scheduledAt: { gte: monthStart, lt: monthEnd },
        status: { not: 'CANCELLED' },
      },
    }),
    prisma.availabilityRule
      .findMany({ where: { mentorProfile: { userId } } })
      .catch(() => [] as Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>),
  ]);

  // Hours planned this week = sum of weekSessions.durationMinutes,
  // displayed as "h" rounding minutes to the nearest 5.
  const totalMinutes = weekSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const planHours = Math.floor(totalMinutes / 60);
  const planRest = Math.round((totalMinutes % 60) / 5) * 5;
  const planLabel =
    planRest === 0
      ? t('kpiHours', { hours: planHours, minutes: 0 })
      : t('kpiHours', { hours: planHours, minutes: String(planRest).padStart(2, '0') });

  // Free slots = total weekly availability hours minus booked.
  const totalAvailMinutes = availabilityRules.reduce(
    (acc, r) => acc + Math.max(0, r.endMinute - r.startMinute),
    0,
  );
  const freeMinutes = Math.max(0, totalAvailMinutes - totalMinutes);
  const freeSlots = Math.round(freeMinutes / 60);

  const kpis = [
    { key: 'thisWeek', value: weekSessions.length, accent: '#7301FF' },
    { key: 'hoursPlanned', value: planLabel, accent: '#A34BF5' },
    { key: 'freeSlots', value: freeSlots, accent: '#23c55e' },
    { key: 'thisMonth', value: monthCount, accent: '#F46FB1' },
  ] as const;

  // Range nav — previous / next / today.
  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const fmtAnchor = (d: Date) => d.toISOString().slice(0, 10);
  const fmtRange = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const days = (() => {
    try {
      const raw = (t as unknown as { raw: (k: string) => string[] }).raw('days');
      if (Array.isArray(raw) && raw.length === 7) return raw;
    } catch {
      /* fall through */
    }
    return ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  })();

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

      {/* Range nav + view switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href={`/mentora/dashboard/agenda?w=${fmtAnchor(prevWeek)}`}
            aria-label="Semaine précédente"
            style={navArrowStyle}
          >
            ‹
          </Link>
          <strong style={{ fontSize: 14 }}>
            {t('rangeLabel', {
              start: fmtRange(weekStart),
              end: fmtRange(new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000)),
            })}
          </strong>
          <Link
            href={`/mentora/dashboard/agenda?w=${fmtAnchor(nextWeek)}`}
            aria-label="Semaine suivante"
            style={navArrowStyle}
          >
            ›
          </Link>
          <Link
            href="/mentora/dashboard/agenda"
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(115,1,255,0.10)',
              color: '#7301FF',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              marginLeft: 4,
            }}
          >
            {t('today')}
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'viewWeek', active: true },
            { key: 'viewMonth', active: false },
            { key: 'viewList', active: false },
          ].map((v) => (
            <span
              key={v.key}
              style={{
                padding: '7px 14px',
                borderRadius: 9,
                background: v.active ? 'linear-gradient(135deg, #7301FF, #A34BF5)' : 'transparent',
                border: v.active ? 'none' : '1px solid rgba(115,1,255,0.20)',
                color: v.active ? 'white' : '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                cursor: v.active ? 'default' : 'not-allowed',
                opacity: v.active ? 1 : 0.7,
              }}
            >
              {t(v.key)}
            </span>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
          </div>
        ))}
      </div>

      {/* Week grid */}
      <div
        className="dz-card"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {/* Header row — day names + numbers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, 1fr)',
            borderBottom: '1px solid rgba(115,1,255,0.08)',
          }}
        >
          <div />
          {DAY_INDICES.map((i) => {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + i);
            const isToday =
              day.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                style={{
                  padding: '14px 8px',
                  textAlign: 'center',
                  borderLeft: i === 0 ? 'none' : '1px solid rgba(115,1,255,0.06)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: '#8b91ad',
                  }}
                >
                  {days[i]}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: isToday ? '#7301FF' : '#1a1f3a',
                    marginTop: 2,
                  }}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Day grid — 14 hour rows × 7 day columns. Sessions are
            rendered as absolutely-positioned blocks inside their day
            column, sized by duration. */}
        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, 1fr)',
          }}
        >
          {/* Time column */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(${HOURS.length}, 56px)`,
              borderRight: '1px solid rgba(115,1,255,0.06)',
            }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                style={{
                  padding: '4px 8px',
                  fontSize: 10,
                  color: '#8b91ad',
                  textAlign: 'right',
                }}
              >
                {h}h
              </div>
            ))}
          </div>

          {/* Each day column */}
          {DAY_INDICES.map((dayIdx) => {
            const dayStart = new Date(weekStart);
            dayStart.setDate(dayStart.getDate() + dayIdx);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const sessionsForDay = weekSessions.filter(
              (s) =>
                s.scheduledAt.getTime() >= dayStart.getTime() &&
                s.scheduledAt.getTime() < dayEnd.getTime(),
            );

            return (
              <div
                key={dayIdx}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateRows: `repeat(${HOURS.length}, 56px)`,
                  borderLeft: '1px solid rgba(115,1,255,0.06)',
                }}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{
                      borderTop: h === DAY_START_HOUR ? 'none' : '1px solid rgba(115,1,255,0.04)',
                    }}
                  />
                ))}
                {sessionsForDay.map((s, idx) => {
                  const startH =
                    s.scheduledAt.getHours() + s.scheduledAt.getMinutes() / 60;
                  const top = Math.max(0, (startH - DAY_START_HOUR) * 56);
                  const height = Math.max(28, (s.durationMinutes / 60) * 56 - 4);
                  const accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
                  const u = s.mentorship.menteeProfile.user;
                  const name =
                    u.name ??
                    ([u.firstName, u.lastName]
                      .filter(Boolean)
                      .join(' ')
                      .trim() || u.email);
                  const initials = initialsFor(name);
                  const titleLine =
                    s.agenda
                      ?.split(/\n/)
                      .map((l) => l.trim())
                      .find(Boolean) ?? t('untitledSession');

                  return (
                    <Link
                      key={s.id}
                      href={`/mentora/dashboard/sessions/${s.id}`}
                      style={{
                        position: 'absolute',
                        top,
                        left: 4,
                        right: 4,
                        height,
                        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                        color: 'white',
                        borderRadius: 10,
                        padding: '6px 10px',
                        textDecoration: 'none',
                        boxShadow: `0 4px 12px ${accent}40`,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.30)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          opacity: 0.9,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {titleLine}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {weekSessions.length === 0 && (
          <div
            style={{
              padding: '24px 18px',
              textAlign: 'center',
              fontSize: 13,
              color: '#8b91ad',
              borderTop: '1px solid rgba(115,1,255,0.06)',
            }}
          >
            {t('noSessions')}
          </div>
        )}
      </div>
    </div>
  );
}

const navArrowStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'rgba(115,1,255,0.06)',
  color: '#7301FF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
  fontWeight: 700,
  textDecoration: 'none',
  flexShrink: 0,
};
