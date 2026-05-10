import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { SessionStatus } from '@prisma/client';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

type Tab = 'upcoming' | 'past' | 'cancelled';

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e'] as const;

const FORMAT_LABEL_KEY: Record<string, 'remoteVideo' | 'inPerson' | 'phone'> = {
  REMOTE_VIDEO: 'remoteVideo',
  IN_PERSON: 'inPerson',
  PHONE: 'phone',
};

const STATUS_LABEL_KEY: Record<SessionStatus, 'scheduled' | 'inProgress' | 'completed' | 'cancelled' | 'noShow'> = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'noShow',
};

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned.slice(0, 2).toUpperCase();
}

/**
 * Cross-mentorship sessions listing — redesigned to match the
 * `mentora-mentee-tabs.jsx#Sessions` mockup:
 *
 *   - 3 tabs (À venir / Passées / Annulées) each carrying a live
 *     count from a single Prisma `groupBy`.
 *   - Top-right "+ Nouvelle session" CTA.
 *   - Each row is a card with: a coloured day-pill (DD + month abbr),
 *     session title (agenda first line, falling back to "Session avec
 *     X"), avatar + name + time + duration + format, agenda tags
 *     (first 2 hashtag-style words from the agenda), then
 *     "Reporter" + "Rejoindre" buttons on the right.
 *
 * Counts are computed in a single round-trip; rows for the active
 * tab are fetched separately so we always display the right slice.
 */
export default async function SessionsListingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/sessions');

  const sp = await searchParams;
  const tab: Tab =
    sp.tab === 'past' ? 'past' : sp.tab === 'cancelled' ? 'cancelled' : 'upcoming';
  const t = await getTranslations('mentora.sessions');
  const userId = session.user.id;
  const now = new Date();

  // Single base predicate to bind every query to "sessions I'm part of".
  const baseWhere = {
    mentorship: {
      OR: [
        { mentorProfile: { userId } },
        { menteeProfile: { userId } },
      ],
    },
  };

  // Whichever tab is active, build the matching where-tree.
  const whereForTab = (target: Tab) =>
    target === 'upcoming'
      ? {
          ...baseWhere,
          status: 'SCHEDULED' as const,
          scheduledAt: { gte: now },
        }
      : target === 'cancelled'
        ? {
            ...baseWhere,
            // Plain mutable array — Prisma's enum `in` filter expects
            // `SessionStatus[]`, not a readonly tuple.
            status: { in: ['CANCELLED', 'NO_SHOW'] as SessionStatus[] },
          }
        : {
            ...baseWhere,
            OR: [
              { status: 'COMPLETED' as const },
              { status: 'SCHEDULED' as const, scheduledAt: { lt: now } },
            ],
          };

  const [upcomingCount, pastCount, cancelledCount, sessions] = await Promise.all([
    prisma.session.count({ where: whereForTab('upcoming') }),
    prisma.session.count({ where: whereForTab('past') }),
    prisma.session.count({ where: whereForTab('cancelled') }),
    prisma.session.findMany({
      where: whereForTab(tab),
      include: {
        mentorship: {
          include: {
            mentorProfile: { include: { user: true } },
            menteeProfile: { include: { user: true } },
          },
        },
      },
      orderBy: { scheduledAt: tab === 'upcoming' ? 'asc' : 'desc' },
      take: 60,
    }),
  ]);

  const counts: Record<Tab, number> = {
    upcoming: upcomingCount,
    past: pastCount,
    cancelled: cancelledCount,
  };

  const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' });
  const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="dz-card" style={{ padding: 24 }}>
        <h1 className="dz-h2" style={{ fontSize: 24, margin: 0 }}>
          {t('title')}
        </h1>
        <p className="dz-body" style={{ marginTop: 6 }}>
          {t('subtitle')}
        </p>
      </div>

      {/* Tabs row + new-session CTA */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['upcoming', 'past', 'cancelled'] as const).map((key) => {
            const active = tab === key;
            const count = counts[key];
            return (
              <Link
                key={key}
                href={`/mentora/dashboard/sessions${key === 'upcoming' ? '' : `?tab=${key}`}`}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
                  color: active ? '#7301FF' : '#545b7a',
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: 'none',
                }}
              >
                {t('tabsCount', { label: t(`tabs.${key}`), count })}
              </Link>
            );
          })}
        </div>
        <span style={{ flex: 1 }} />
        <Link
          href="/mentora/dashboard/sessions/new"
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
          {t('newSessionCta')}
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="dz-card" style={{ padding: 24 }}>
          <p className="dz-body" style={{ margin: 0 }}>
            {tab === 'upcoming'
              ? t('empty.upcoming')
              : tab === 'cancelled'
                ? t('empty.past')
                : t('empty.past')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map((s, idx) => {
            const iAmMentor = s.mentorship.mentorProfile.userId === userId;
            const otherUser = iAmMentor
              ? s.mentorship.menteeProfile.user
              : s.mentorship.mentorProfile.user;
            const otherName =
              otherUser.name ??
              ([otherUser.firstName, otherUser.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() || otherUser.email);
            const initials = initialsFor(otherName);
            const accent = ACCENT_PALETTE[idx % ACCENT_PALETTE.length];
            const statusKey = STATUS_LABEL_KEY[s.status];
            const formatKey = FORMAT_LABEL_KEY[s.format] ?? 'remoteVideo';

            // Title: first non-empty line of agenda, else generic label.
            const agendaTitle = s.agenda
              ?.split(/\n/)
              .map((l) => l.trim())
              .find(Boolean);
            const title = agendaTitle ?? t('card.untitled');

            // Tags: tokens that look like tags or hashtags within the
            // agenda, plus a fallback to status / format chips. We
            // grab up to 2 short capitalised tokens from non-title
            // lines so the cards aren't tag-empty.
            const tagSource = s.agenda
              ? s.agenda
                  .split(/\n/)
                  .slice(1)
                  .join(' ')
                  .match(/[A-Za-zÀ-ÿ][\wÀ-ÿ-]{2,}/g) ?? []
              : [];
            const tags = Array.from(new Set(tagSource.slice(0, 2)));

            const dayNum = dayFormatter.format(s.scheduledAt);
            const monthAbbr = monthFormatter.format(s.scheduledAt).replace('.', '').toUpperCase();
            const timeStr = timeFormatter.format(s.scheduledAt);
            const locationOrUrl =
              s.format === 'IN_PERSON'
                ? s.location ?? ''
                : s.format === 'REMOTE_VIDEO'
                  ? 'Whereby'
                  : t(`formatLabels.${formatKey}`);

            const canJoin = tab === 'upcoming' && !!s.meetingUrl;

            return (
              <article
                key={s.id}
                className="dz-card"
                style={{
                  padding: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  flexWrap: 'wrap',
                }}
              >
                {/* Day pill */}
                <div
                  aria-hidden
                  style={{
                    width: 64,
                    minWidth: 64,
                    padding: '10px 0',
                    borderRadius: 14,
                    background: `${accent}15`,
                    color: accent,
                    textAlign: 'center',
                    fontWeight: 800,
                    lineHeight: 1.1,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 22 }}>{dayNum}</div>
                  <div style={{ fontSize: 10, letterSpacing: '0.06em', marginTop: 2 }}>
                    {monthAbbr}
                  </div>
                </div>

                {/* Title block */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#1a1f3a',
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginTop: 6,
                      fontSize: 12,
                      color: '#545b7a',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      aria-hidden
                      translate="no"
                      title={otherName}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                        color: 'white',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {initials}
                    </span>
                    <span style={{ fontWeight: 600 }}>{otherName}</span>
                    <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                    <span>{timeStr}</span>
                    <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                    <span>{t('card.duration', { minutes: s.durationMinutes })}</span>
                    <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                    <span>
                      {t(`formatLabels.${formatKey}`)}
                      {locationOrUrl && ` — ${locationOrUrl}`}
                    </span>
                  </div>
                  {tags.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 10,
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
                          {tag}
                        </span>
                      ))}
                      {/* Status pill rendered as a tag too — keeps the
                          row visually consistent across all tabs. */}
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: `${accent}12`,
                          color: accent,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {t(`statusLabels.${statusKey}`)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href={`/mentora/dashboard/sessions/${s.id}`}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(115,1,255,0.20)',
                      background: 'transparent',
                      color: '#7301FF',
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    {t('card.rescheduleCta')}
                  </Link>
                  {canJoin ? (
                    <a
                      href={s.meetingUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '8px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      {t('card.joinCta')}
                    </a>
                  ) : (
                    <Link
                      href={`/mentora/dashboard/sessions/${s.id}`}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 10,
                        border: 'none',
                        background:
                          tab === 'upcoming'
                            ? 'linear-gradient(135deg, #7301FF, #A34BF5)'
                            : 'rgba(115,1,255,0.10)',
                        color: tab === 'upcoming' ? 'white' : '#7301FF',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      {tab === 'upcoming' ? t('card.joinCta') : t('card.openCta')}
                    </Link>
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
