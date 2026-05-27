import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentRoleProfile } from '@/lib/mentora/current-profile';

/**
 * `/mentora/dashboard/activity` — full chronological activity log.
 *
 * Aggregates events from every Mentorat-bound source (sessions, messages,
 * reviews, requests, mentorships, goals, notifications), fuses them into
 * one timeline sorted by `when` desc, paginates 50/page via `?cursor`,
 * and exposes type + time-range filters as `<Link>`-driven search params
 * so the page stays a pure RSC (no `"use client"`).
 *
 * Schema reality check (vs spec):
 *  - `Session` has no `confirmedAt` / `completedAt` / `cancelledAt` /
 *    `rescheduledAt` columns — we derive the event date from `status` +
 *    `updatedAt` (state transition timestamp) and split SCHEDULED rows so
 *    they also surface their creation as a "session proposée" event.
 *  - `Mentorship` has no `pausedAt`; PAUSED state surfaces only with
 *    `startedAt` (no transition timestamp available).
 *  - `MentorshipGoal` uses `isAchieved` + `achievedAt` (not
 *    `completedAt`); we map accordingly.
 *
 * Every source is wrapped in `safe()` so a missing column / failing
 * query yields `[]` instead of bricking the whole page.
 */

type EventType = 'sessions' | 'messages' | 'reviews' | 'requests' | 'mentorships' | 'goals' | 'notifications';

type ActivityEvent = {
  id: string;
  type: EventType;
  when: Date;
  title: string;
  description?: string;
  icon: string;
  color: string;
  href?: string;
};

type RangeKey = 'all' | '30d' | 'year';

const PAGE_SIZE = 50;

const TYPE_META: Record<EventType, { label: string; icon: string; color: string }> = {
  sessions: { label: 'Sessions', icon: '◌', color: '#7301FF' },
  messages: { label: 'Messages', icon: '✉', color: '#F46FB1' },
  reviews: { label: 'Avis', icon: '★', color: '#FFB823' },
  requests: { label: 'Demandes', icon: '✦', color: '#A34BF5' },
  mentorships: { label: 'Mentorats', icon: '☷', color: '#23c55e' },
  goals: { label: 'Objectifs', icon: '◈', color: '#3B7BFF' },
  notifications: { label: 'Notifications', icon: '◇', color: '#24325F' },
};

const ALL_TYPES: EventType[] = ['sessions', 'messages', 'reviews', 'requests', 'mentorships', 'goals'];

async function safe<T>(fn: () => Promise<T[]>, fallback: T[] = []): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function parseTypes(raw: string | undefined): Set<EventType> {
  if (!raw) return new Set(ALL_TYPES);
  const parts = raw
    .split(',')
    .map((s) => s.trim() as EventType)
    .filter((s): s is EventType => (s as string) in TYPE_META);
  if (parts.length === 0) return new Set(ALL_TYPES);
  return new Set(parts);
}

function parseRange(raw: string | undefined): RangeKey {
  if (raw === '30d' || raw === 'year' || raw === 'all') return raw;
  return '30d';
}

function rangeStart(range: RangeKey): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  }
  // 'year'
  return new Date(now.getFullYear(), 0, 1);
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

function dayBucketKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayBucketLabel(d: Date): string {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dayBucketKey(d) === dayBucketKey(today)) return "Aujourd'hui";
  if (dayBucketKey(d) === dayBucketKey(yest)) return 'Hier';
  return dateFormatter.format(d);
}

function buildQS(params: { types?: Set<EventType>; range?: RangeKey; cursor?: string }): string {
  const sp = new URLSearchParams();
  if (params.types) {
    const arr = Array.from(params.types);
    if (arr.length > 0 && arr.length < ALL_TYPES.length) sp.set('types', arr.join(','));
  }
  if (params.range && params.range !== '30d') sp.set('range', params.range);
  if (params.cursor) sp.set('cursor', params.cursor);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function displayName(u: { firstName: string | null; name: string | null } | null | undefined): string {
  if (!u) return 'quelqu’un';
  return u.firstName?.trim() || u.name?.trim() || 'quelqu’un';
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ types?: string; range?: 'all' | '30d' | 'year'; cursor?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/dashboard/activity');
  const userId = session.user.id;

  const profile = await getCurrentRoleProfile(userId);
  const activeTypes = parseTypes(sp.types);
  const range = parseRange(sp.range);
  const since = rangeStart(range);
  const cursorTs = sp.cursor ? new Date(sp.cursor) : null;
  const cursorValid = cursorTs && !Number.isNaN(cursorTs.getTime()) ? cursorTs : null;

  const mentorId = profile.kind === 'mentor' ? profile.mentorProfile.id : null;
  const menteeId = profile.kind === 'mentee' ? profile.menteeProfile.id : null;

  const sinceFilter = since ? { gte: since } : undefined;

  // ── Source: Sessions (split SCHEDULED rows so creation + state both surface) ──
  const sessionsPromise = safe<ActivityEvent>(async () => {
    if (!mentorId && !menteeId) return [];
    const rows = await prisma.session.findMany({
      where: {
        mentorship: mentorId ? { mentorProfileId: mentorId } : { menteeProfileId: menteeId! },
        ...(sinceFilter ? { updatedAt: sinceFilter } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        mentorship: {
          include: {
            mentorProfile: { include: { user: { select: { firstName: true, name: true } } } },
            menteeProfile: { include: { user: { select: { firstName: true, name: true } } } },
          },
        },
      },
    });
    const out: ActivityEvent[] = [];
    for (const s of rows) {
      const counterpart = mentorId
        ? displayName(s.mentorship.menteeProfile.user)
        : displayName(s.mentorship.mentorProfile.user);
      const href = `/mentora/dashboard/sessions/${s.id}`;
      const sched = timeFormatter.format(s.scheduledAt);
      const dateLong = dateFormatter.format(s.scheduledAt);
      // State transition event — uses updatedAt as the "when".
      let title = `Session avec ${counterpart}`;
      let description = `Programmée le ${dateLong} à ${sched}`;
      switch (s.status) {
        case 'SCHEDULED':
          title = `Session proposée avec ${counterpart}`;
          break;
        case 'IN_PROGRESS':
          title = `Session en cours avec ${counterpart}`;
          break;
        case 'COMPLETED':
          title = `Session terminée avec ${counterpart}`;
          description = `Session du ${dateLong} à ${sched} marquée terminée`;
          break;
        case 'CANCELLED':
          title = `Session annulée avec ${counterpart}`;
          description = s.cancellationReason
            ? `Motif : ${s.cancellationReason}`
            : `Session du ${dateLong} à ${sched} annulée`;
          break;
        case 'NO_SHOW':
          title = `No-show — session avec ${counterpart}`;
          description = `Session du ${dateLong} à ${sched}`;
          break;
      }
      out.push({
        id: `session-${s.id}-${s.status}`,
        type: 'sessions',
        when: s.updatedAt,
        title,
        description,
        icon: TYPE_META.sessions.icon,
        color: TYPE_META.sessions.color,
        href,
      });
      // Also surface the creation as its own event when it differs from
      // the state-transition timestamp.
      if (s.createdAt.getTime() !== s.updatedAt.getTime()) {
        out.push({
          id: `session-${s.id}-created`,
          type: 'sessions',
          when: s.createdAt,
          title: `Session proposée avec ${counterpart}`,
          description: `Pour le ${dateLong} à ${sched}`,
          icon: TYPE_META.sessions.icon,
          color: TYPE_META.sessions.color,
          href,
        });
      }
    }
    return out;
  });

  // ── Source: Messages (received only — skip self-authored to cut noise) ──
  const messagesPromise = safe<ActivityEvent>(async () => {
    if (!mentorId && !menteeId) return [];
    const rows = await prisma.mentorshipMessage.findMany({
      where: {
        mentorship: mentorId ? { mentorProfileId: mentorId } : { menteeProfileId: menteeId! },
        senderUserId: { not: userId },
        ...(sinceFilter ? { sentAt: sinceFilter } : {}),
      },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: {
        sender: { select: { firstName: true, name: true } },
        mentorship: { select: { id: true } },
      },
    });
    return rows.map<ActivityEvent>((m) => ({
      id: `msg-${m.id}`,
      type: 'messages',
      when: m.sentAt,
      title: `Nouveau message de ${displayName(m.sender)}`,
      description: m.body.length > 140 ? `${m.body.slice(0, 140)}…` : m.body,
      icon: TYPE_META.messages.icon,
      color: TYPE_META.messages.color,
      href: `/mentora/dashboard/mentorships/${m.mentorship.id}?tab=messages`,
    }));
  });

  // ── Source: Reviews ────────────────────────────────────────────────────
  const reviewsPromise = safe<ActivityEvent>(async () => {
    if (!mentorId && !menteeId) return [];
    if (mentorId) {
      const rows = await prisma.review.findMany({
        where: {
          mentorship: { mentorProfileId: mentorId },
          ...(sinceFilter ? { createdAt: sinceFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { author: { select: { firstName: true, name: true } } },
      });
      return rows.map<ActivityEvent>((r) => ({
        id: `review-${r.id}`,
        type: 'reviews',
        when: r.createdAt,
        title: `Avis ★${r.rating}/5 reçu de ${displayName(r.author)}`,
        description: r.comment ? (r.comment.length > 140 ? `${r.comment.slice(0, 140)}…` : r.comment) : undefined,
        icon: TYPE_META.reviews.icon,
        color: TYPE_META.reviews.color,
        href: '/mentora/dashboard/feedbacks',
      }));
    }
    // mentee — reviews authored by this user
    const rows = await prisma.review.findMany({
      where: {
        authorUserId: userId,
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        mentorship: {
          include: {
            mentorProfile: { include: { user: { select: { firstName: true, name: true } } } },
          },
        },
      },
    });
    return rows.map<ActivityEvent>((r) => ({
      id: `review-${r.id}`,
      type: 'reviews',
      when: r.createdAt,
      title: `Avis ★${r.rating}/5 donné à ${displayName(r.mentorship.mentorProfile.user)}`,
      description: r.comment ? (r.comment.length > 140 ? `${r.comment.slice(0, 140)}…` : r.comment) : undefined,
      icon: TYPE_META.reviews.icon,
      color: TYPE_META.reviews.color,
      href: '/mentora/dashboard/feedbacks',
    }));
  });

  // ── Source: Mentorship requests (sent + received + responded) ──────────
  const requestsPromise = safe<ActivityEvent>(async () => {
    if (!mentorId && !menteeId) return [];
    const where = mentorId ? { toMentorId: mentorId } : { fromMenteeId: menteeId! };
    const rows = await prisma.mentorshipRequest.findMany({
      where: {
        ...where,
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        fromMentee: { include: { user: { select: { firstName: true, name: true } } } },
        toMentor: { include: { user: { select: { firstName: true, name: true } } } },
      },
    });
    const out: ActivityEvent[] = [];
    for (const r of rows) {
      const counterpart = mentorId
        ? displayName(r.fromMentee.user)
        : displayName(r.toMentor.user);
      const href = '/mentora/dashboard/requests';
      // Creation event
      out.push({
        id: `req-${r.id}-created`,
        type: 'requests',
        when: r.createdAt,
        title: mentorId
          ? `Demande reçue de ${counterpart}`
          : `Demande envoyée à ${counterpart}`,
        description: r.message.length > 140 ? `${r.message.slice(0, 140)}…` : r.message,
        icon: TYPE_META.requests.icon,
        color: TYPE_META.requests.color,
        href,
      });
      // Response event (only if it happened and is in range)
      if (r.respondedAt && (!since || r.respondedAt >= since)) {
        let title = '';
        switch (r.status) {
          case 'ACCEPTED':
            title = mentorId
              ? `Demande acceptée de ${counterpart}`
              : `Demande acceptée par ${counterpart}`;
            break;
          case 'DECLINED':
            title = mentorId
              ? `Demande déclinée de ${counterpart}`
              : `Demande déclinée par ${counterpart}`;
            break;
          case 'WITHDRAWN':
            title = mentorId
              ? `Demande retirée par ${counterpart}`
              : `Demande retirée envoyée à ${counterpart}`;
            break;
          case 'EXPIRED':
            title = `Demande expirée — ${counterpart}`;
            break;
          default:
            continue;
        }
        out.push({
          id: `req-${r.id}-resp`,
          type: 'requests',
          when: r.respondedAt,
          title,
          description: r.declineReason ?? undefined,
          icon: TYPE_META.requests.icon,
          color: TYPE_META.requests.color,
          href,
        });
      }
    }
    return out;
  });

  // ── Source: Mentorships (started / ended) ──────────────────────────────
  const mentorshipsPromise = safe<ActivityEvent>(async () => {
    if (!mentorId && !menteeId) return [];
    const where = mentorId ? { mentorProfileId: mentorId } : { menteeProfileId: menteeId! };
    const rows = await prisma.mentorship.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        mentorProfile: { include: { user: { select: { firstName: true, name: true } } } },
        menteeProfile: { include: { user: { select: { firstName: true, name: true } } } },
      },
    });
    const out: ActivityEvent[] = [];
    for (const m of rows) {
      const counterpart = mentorId
        ? displayName(m.menteeProfile.user)
        : displayName(m.mentorProfile.user);
      const href = `/mentora/dashboard/mentorships/${m.id}`;
      if (!since || m.startedAt >= since) {
        out.push({
          id: `mship-${m.id}-start`,
          type: 'mentorships',
          when: m.startedAt,
          title: `Mentorat commencé avec ${counterpart}`,
          icon: TYPE_META.mentorships.icon,
          color: TYPE_META.mentorships.color,
          href,
        });
      }
      if (m.endedAt && (!since || m.endedAt >= since)) {
        const ended =
          m.status === 'COMPLETED'
            ? `Mentorat terminé avec ${counterpart}`
            : m.status === 'TERMINATED'
              ? `Mentorat interrompu avec ${counterpart}`
              : `Mentorat clos avec ${counterpart}`;
        out.push({
          id: `mship-${m.id}-end`,
          type: 'mentorships',
          when: m.endedAt,
          title: ended,
          description: m.closingNote ?? undefined,
          icon: TYPE_META.mentorships.icon,
          color: TYPE_META.mentorships.color,
          href,
        });
      }
    }
    return out;
  });

  // ── Source: Goals ──────────────────────────────────────────────────────
  const goalsPromise = safe<ActivityEvent>(async () => {
    if (!mentorId && !menteeId) return [];
    const rows = await prisma.mentorshipGoal.findMany({
      where: {
        mentorship: mentorId ? { mentorProfileId: mentorId } : { menteeProfileId: menteeId! },
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { mentorship: { select: { id: true } } },
    });
    const out: ActivityEvent[] = [];
    for (const g of rows) {
      const desc = g.description.length > 140 ? `${g.description.slice(0, 140)}…` : g.description;
      out.push({
        id: `goal-${g.id}-created`,
        type: 'goals',
        when: g.createdAt,
        title: `Nouvel objectif défini`,
        description: desc,
        icon: TYPE_META.goals.icon,
        color: TYPE_META.goals.color,
        href: `/mentora/dashboard/goals`,
      });
      if (g.isAchieved && g.achievedAt && (!since || g.achievedAt >= since)) {
        out.push({
          id: `goal-${g.id}-done`,
          type: 'goals',
          when: g.achievedAt,
          title: `Objectif atteint`,
          description: desc,
          icon: TYPE_META.goals.icon,
          color: TYPE_META.goals.color,
          href: `/mentora/dashboard/goals`,
        });
      }
    }
    return out;
  });

  // ── Source: Notifications (always-on fallback, also tagged 'notifications') ──
  const notificationsPromise = safe<ActivityEvent>(async () => {
    const rows = await prisma.notification.findMany({
      where: {
        userId,
        ...(sinceFilter ? { createdAt: sinceFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map<ActivityEvent>((n) => {
      const raw = String(n.type).replace(/_/g, ' ').toLowerCase();
      return {
        id: `notif-${n.id}`,
        type: 'notifications',
        when: n.createdAt,
        title: raw.charAt(0).toUpperCase() + raw.slice(1),
        description: undefined,
        icon: TYPE_META.notifications.icon,
        color: TYPE_META.notifications.color,
        href: '/mentora/dashboard/notifications',
      };
    });
  });

  const [sessionsEv, messagesEv, reviewsEv, requestsEv, mentorshipsEv, goalsEv, notifsEv] =
    await Promise.all([
      sessionsPromise,
      messagesPromise,
      reviewsPromise,
      requestsPromise,
      mentorshipsPromise,
      goalsPromise,
      notificationsPromise,
    ]);

  // Merge — notifications are a passive fallback: include them only if no
  // other source produced anything *and* the user picked no explicit filter
  // (otherwise the notifications log lives at its dedicated page).
  const hasRichEvents =
    sessionsEv.length +
      messagesEv.length +
      reviewsEv.length +
      requestsEv.length +
      mentorshipsEv.length +
      goalsEv.length >
    0;
  const allEvents: ActivityEvent[] = [
    ...sessionsEv,
    ...messagesEv,
    ...reviewsEv,
    ...requestsEv,
    ...mentorshipsEv,
    ...goalsEv,
    ...(hasRichEvents ? [] : notifsEv),
  ];

  // 30-day stats (computed before type filter so KPI stays steady regardless of chips)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30 = allEvents.filter((e) => e.when >= thirtyDaysAgo);
  const totalLast30 = last30.length;
  const typeCounts: Record<string, number> = {};
  for (const e of last30) typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  const topType =
    Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as EventType | undefined;
  const dayCounts: Record<string, number> = {};
  for (const e of last30) {
    const k = dayBucketKey(e.when);
    dayCounts[k] = (dayCounts[k] ?? 0) + 1;
  }
  const peakDayEntry = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  const peakDay = peakDayEntry
    ? { label: dateFormatter.format(new Date(`${peakDayEntry[0]}T12:00:00`)), count: peakDayEntry[1] }
    : null;

  // Filter by selected types
  const filteredEvents = allEvents.filter((e) => activeTypes.has(e.type) || e.type === 'notifications');
  // Sort desc by when
  filteredEvents.sort((a, b) => b.when.getTime() - a.when.getTime());

  // Cursor pagination — show events strictly older than cursorValid
  const afterCursor = cursorValid
    ? filteredEvents.filter((e) => e.when < cursorValid)
    : filteredEvents;
  const page = afterCursor.slice(0, PAGE_SIZE);
  const hasMore = afterCursor.length > PAGE_SIZE;
  const nextCursor = hasMore ? page[page.length - 1]?.when.toISOString() : undefined;

  // Group by day
  const dayGroups: Array<{ key: string; label: string; events: ActivityEvent[] }> = [];
  for (const ev of page) {
    const k = dayBucketKey(ev.when);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.key === k) {
      last.events.push(ev);
    } else {
      dayGroups.push({ key: k, label: dayBucketLabel(ev.when), events: [ev] });
    }
  }

  const role = profile.kind;
  const emptyCta =
    role === 'mentor'
      ? { label: 'Voir mes mentorés', href: '/mentora/dashboard/mentorships' }
      : role === 'mentee'
        ? { label: 'Trouver un mentor', href: '/mentora/discover' }
        : { label: 'Compléter mon profil', href: '/mentora/onboarding' };

  // ── Styling tokens (mirror MentorOverview) ──
  const cardBg = 'white';
  const cardBorder = '1px solid rgba(115,1,255,0.10)';
  const ink = '#1a1f3a';
  const sub = '#545b7a';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1
          className="dz-grad-text"
          style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Mon activité
        </h1>
        <p style={{ margin: 0, color: sub, fontSize: 14 }}>
          Toute ton historique en un coup d’œil — sessions, messages, avis, demandes, objectifs.
        </p>
      </header>

      {/* ── Filters bar ───────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* "Tout" chip */}
          <FilterChip
            label="Tout"
            active={activeTypes.size === ALL_TYPES.length}
            href={buildQS({ range })}
          />
          {ALL_TYPES.map((t) => {
            const isActive = activeTypes.has(t) && activeTypes.size !== ALL_TYPES.length;
            // Clicking a chip toggles single-type filter (deselect-all + select-this).
            const nextTypes = new Set<EventType>([t]);
            return (
              <FilterChip
                key={t}
                label={TYPE_META[t].label}
                icon={TYPE_META[t].icon}
                color={TYPE_META[t].color}
                active={isActive}
                href={buildQS({ types: nextTypes, range })}
              />
            );
          })}

          <span aria-hidden style={{ width: 1, height: 22, background: 'rgba(36,50,95,0.12)', margin: '0 6px' }} />

          {(['30d', 'year', 'all'] as RangeKey[]).map((r) => (
            <FilterChip
              key={r}
              label={r === '30d' ? '30 derniers jours' : r === 'year' ? 'Cette année' : 'Tout'}
              active={range === r}
              href={buildQS({
                types: activeTypes.size === ALL_TYPES.length ? undefined : activeTypes,
                range: r,
              })}
              variant="time"
            />
          ))}
        </div>

        <Link
          href="#"
          aria-disabled
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: 'white',
            border: '1px solid rgba(115,1,255,0.18)',
            color: '#7301FF',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden>↓</span> Exporter (CSV)
        </Link>
      </div>

      {/* ── Stats compact ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        <StatTile
          label="Événements (30j)"
          value={String(totalLast30)}
          gradient="linear-gradient(135deg, #7301FF, #A34BF5)"
        />
        <StatTile
          label="Type le plus fréquent"
          value={topType ? TYPE_META[topType].label : '—'}
          gradient="linear-gradient(135deg, #F46FB1, #FFB823)"
        />
        <StatTile
          label="Pic d’activité"
          value={peakDay ? `${peakDay.label}` : '—'}
          sub={peakDay ? `${peakDay.count} événement${peakDay.count > 1 ? 's' : ''}` : undefined}
          gradient="linear-gradient(135deg, #3B7BFF, #23c55e)"
        />
      </div>

      {/* ── Timeline ──────────────────────────────────────────────────── */}
      {page.length === 0 ? (
        <div
          className="dz-card"
          style={{
            padding: 40,
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(115,1,255,0.04), rgba(244,111,177,0.04))',
          }}
        >
          <div
            aria-hidden
            style={{
              fontSize: 36,
              marginBottom: 8,
              background: 'linear-gradient(135deg, #7301FF, #F46FB1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ◇
          </div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, color: ink, fontWeight: 700 }}>
            Aucune activité pour l’instant
          </h2>
          <p style={{ margin: '0 0 16px', color: sub, fontSize: 14 }}>
            {role === 'mentor'
              ? 'Ta timeline se remplira dès qu’une mentorée prendra contact ou réservera une session.'
              : role === 'mentee'
                ? 'Commence par trouver un mentor — chaque message et chaque session apparaîtront ici.'
                : 'Crée ton profil pour démarrer ton parcours Mentorat.'}
          </p>
          <Link
            href={emptyCta.href}
            style={{
              display: 'inline-block',
              padding: '10px 18px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
              boxShadow: '0 10px 22px rgba(115,1,255,0.30)',
            }}
          >
            {emptyCta.label} →
          </Link>
        </div>
      ) : (
        <div
          style={{
            background: cardBg,
            border: cardBorder,
            borderRadius: 20,
            padding: '24px 24px 16px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {dayGroups.map((group) => (
              <section key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Day separator */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: '#7301FF',
                    }}
                  >
                    {group.label}
                  </span>
                  <span
                    aria-hidden
                    style={{ flex: 1, height: 1, background: 'rgba(115,1,255,0.10)' }}
                  />
                  <span style={{ fontSize: 11, color: sub }}>
                    {group.events.length} événement{group.events.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Timeline items in this day */}
                <ol
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: '0 0 0 0',
                    position: 'relative',
                  }}
                >
                  {/* Vertical guide line */}
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 71,
                      top: 8,
                      bottom: 8,
                      width: 2,
                      background:
                        'linear-gradient(to bottom, rgba(115,1,255,0.20), rgba(244,111,177,0.10))',
                      borderRadius: 1,
                    }}
                  />
                  {group.events.map((e) => (
                    <li
                      key={e.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '56px 16px 1fr',
                        gap: 14,
                        alignItems: 'flex-start',
                        padding: '10px 0',
                        position: 'relative',
                      }}
                    >
                      {/* Time */}
                      <time
                        dateTime={e.when.toISOString()}
                        style={{
                          fontSize: 11,
                          color: sub,
                          fontVariantNumeric: 'tabular-nums',
                          paddingTop: 4,
                          textAlign: 'right',
                        }}
                      >
                        {timeFormatter.format(e.when)}
                      </time>

                      {/* Dot */}
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: e.color,
                          marginTop: 8,
                          boxShadow: `0 0 0 4px ${e.color}1F`,
                          position: 'relative',
                          zIndex: 1,
                          justifySelf: 'center',
                        }}
                      />

                      {/* Card */}
                      <div
                        style={{
                          background: 'rgba(115,1,255,0.03)',
                          border: '1px solid rgba(115,1,255,0.08)',
                          borderRadius: 14,
                          padding: '12px 14px',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: `${e.color}1A`,
                            color: e.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {e.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: ink,
                              lineHeight: 1.4,
                            }}
                          >
                            {e.title}
                          </div>
                          {e.description && (
                            <p
                              style={{
                                margin: '4px 0 0',
                                fontSize: 12,
                                color: sub,
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                              }}
                            >
                              {e.description}
                            </p>
                          )}
                        </div>
                        {e.href && (
                          <Link
                            href={e.href}
                            style={{
                              fontSize: 12,
                              color: '#7301FF',
                              fontWeight: 600,
                              textDecoration: 'none',
                              flexShrink: 0,
                              alignSelf: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Voir →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>

          {/* Pagination */}
          {hasMore && nextCursor && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 4px' }}>
              <Link
                href={`/mentora/dashboard/activity${buildQS({
                  types: activeTypes.size === ALL_TYPES.length ? undefined : activeTypes,
                  range,
                  cursor: nextCursor,
                })}`}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  background: 'white',
                  border: '1px solid rgba(115,1,255,0.18)',
                  color: '#7301FF',
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                Charger plus →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components (server) ─────────────────────────────────────────────

function FilterChip({
  label,
  icon,
  color,
  active,
  href,
  variant,
}: {
  label: string;
  icon?: string;
  color?: string;
  active: boolean;
  href: string;
  variant?: 'time';
}) {
  const fullHref = `/mentora/dashboard/activity${href}`;
  const baseStyle: React.CSSProperties = {
    padding: '7px 13px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.12s',
    whiteSpace: 'nowrap',
  };
  const activeStyle: React.CSSProperties = active
    ? {
        background:
          variant === 'time'
            ? 'linear-gradient(135deg, #24325F, #3B7BFF)'
            : 'linear-gradient(135deg, #7301FF, #A34BF5)',
        color: 'white',
        border: '1px solid transparent',
        boxShadow: '0 6px 16px rgba(115,1,255,0.22)',
      }
    : {
        background: 'white',
        color: color ?? '#24325F',
        border: '1px solid rgba(36,50,95,0.14)',
      };
  return (
    <Link href={fullHref} style={{ ...baseStyle, ...activeStyle }}>
      {icon && (
        <span aria-hidden style={{ fontSize: 12 }}>
          {icon}
        </span>
      )}
      {label}
    </Link>
  );
}

function StatTile({
  label,
  value,
  sub,
  gradient,
}: {
  label: string;
  value: string;
  sub?: string;
  gradient: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        padding: 18,
        borderRadius: 18,
        background: gradient,
        color: 'white',
        overflow: 'hidden',
        boxShadow: '0 14px 30px rgba(115,1,255,0.18)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(80% 100% at 100% 0%, rgba(255,255,255,0.22), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 700,
            opacity: 0.85,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: '-0.01em' }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
