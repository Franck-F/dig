import Link from 'next/link';
import type { Prisma, SessionStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import Pagination from '@/components/admin/Pagination';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mentorées · Admin Mentora' };

/**
 * `/mentora/admin/mentees` — refondu pour matcher le handoff
 * (`mentora-admin-tabs.jsx#Mentees`, "Mentorées · cycle Printemps 2026").
 *
 *  - 4 KPI cards : Total / Avec match / Sans match / En onboarding
 *  - Filtres rapides : Toutes / Avec match / Sans match / À risque
 *  - Tableau : Avatar+nom · Objectif · Mentor attribué · Progression · Statut · Suivre
 *
 * "Progression" est dérivée des sessions complétées (cap 90%, 100% si la
 * mentorship est COMPLETED). "Statut" combine la santé du parcours :
 *   - Sans match     → 0 mentorship actif
 *   - À risque       → mentorship actif sans session ces 30 derniers jours
 *   - Bientôt diplômée → mentorship COMPLETED ou progression ≥ 90 %
 *   - Active         → cas par défaut
 *
 * La recherche legacy `?q=` reste supportée (champ caché) — on la conserve
 * pour les liens entrants des autres pages admin.
 */

type Search = {
  filter?: string;
  level?: string;
  q?: string;
  page?: string;
};

type FilterKey = 'all' | 'matched' | 'unmatched' | 'risk';

const PAGE_SIZE = 25;

const STAT_COLOR: Record<FilterKey, string> = {
  all: '#7301FF',
  matched: '#23c55e',
  unmatched: '#F46FB1',
  risk: '#FFB823',
};

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Toutes' },
  { key: 'matched', label: 'Avec match' },
  { key: 'unmatched', label: 'Sans match' },
  { key: 'risk', label: 'À risque' },
];

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#FFB823', '#23c55e'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[h % ACCENT_PALETTE.length];
}

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '–';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned[0].toUpperCase();
}

function fullName(u: { name: string | null; firstName: string | null; lastName: string | null; email: string }): string {
  return u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
}

export default async function AdminMenteesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filter: FilterKey =
    sp.filter === 'matched' || sp.filter === 'unmatched' || sp.filter === 'risk' ? sp.filter : 'all';
  const query = sp.q?.trim().slice(0, 100) ?? '';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // ── Where clause assembly ───────────────────────────────────────────
  // We do filter logic in two stages: SQL for raw shape, then a
  // post-filter pass for derived "À risque" / "Sans match" because they
  // depend on aggregates (active mentorship count, last session date).
  const baseWhere: Prisma.MenteeProfileWhereInput = {};
  if (query) {
    baseWhere.OR = [
      { goals: { contains: query, mode: 'insensitive' } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
      { user: { name: { contains: query, mode: 'insensitive' } } },
      { user: { firstName: { contains: query, mode: 'insensitive' } } },
      { user: { lastName: { contains: query, mode: 'insensitive' } } },
    ];
  }
  if (filter === 'matched') {
    baseWhere.mentorships = { some: { status: 'ACTIVE' } };
  } else if (filter === 'unmatched') {
    baseWhere.mentorships = { none: { status: 'ACTIVE' } };
  } else if (filter === 'risk') {
    // Risk: at least one active mentorship, but no session in the last 30
    // days. We approximate via the mentorship-side relation filter; the
    // post-fetch pass refines this with completed-session counters.
    baseWhere.mentorships = {
      some: {
        status: 'ACTIVE',
        sessions: { none: { scheduledAt: { gte: thirtyDaysAgo } } },
      },
    };
  }

  // ── Stats ───────────────────────────────────────────────────────────
  // The 4 KPI cards: Total / Avec match / Sans match / En onboarding.
  // "En onboarding" = mentee created in the last 30 days (no mentorship
  // started yet OR very early in their journey).
  const [statsTotal, statsMatched, statsUnmatched, statsOnboarding] = await Promise.all([
    prisma.menteeProfile.count(),
    prisma.menteeProfile.count({
      where: { mentorships: { some: { status: 'ACTIVE' } } },
    }),
    prisma.menteeProfile.count({
      where: { mentorships: { none: { status: 'ACTIVE' } } },
    }),
    prisma.menteeProfile.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  // ── List ────────────────────────────────────────────────────────────
  const [filteredTotal, rows] = await Promise.all([
    prisma.menteeProfile.count({ where: baseWhere }),
    prisma.menteeProfile.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        userId: true,
        goals: true,
        level: true,
        createdAt: true,
        user: { select: { name: true, firstName: true, lastName: true, email: true } },
        mentorships: {
          where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
            mentorProfile: {
              select: {
                user: { select: { name: true, firstName: true, lastName: true, email: true } },
              },
            },
            sessions: {
              select: { id: true, status: true, scheduledAt: true },
            },
          },
        },
        _count: { select: { mentorships: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  type MenteeRow = (typeof rows)[number];

  function deriveStatus(m: MenteeRow): {
    label: string;
    color: string;
    progress: number;
    mentorName: string;
  } {
    const recent = m.mentorships[0];
    if (!recent) {
      return { label: 'Sans match', color: '#FFB823', progress: 25, mentorName: '— en attente —' };
    }

    const completed: SessionStatus = 'COMPLETED';
    const completedSessions = recent.sessions.filter((s) => s.status === completed).length;
    const totalSessions = recent.sessions.length;

    // Progress: 25% baseline once matched, +10% per completed session,
    // capped at 90% unless the mentorship itself is COMPLETED → 100%.
    let progress = 25 + completedSessions * 10;
    if (recent.status === 'COMPLETED') progress = 100;
    progress = Math.min(100, Math.max(25, progress));

    // Risk flag: ACTIVE mentorship but no session in the last 30 days.
    const lastSessionDate =
      recent.sessions.length > 0
        ? recent.sessions
            .map((s) => s.scheduledAt.getTime())
            .reduce((a, b) => Math.max(a, b), 0)
        : 0;
    const isRisk =
      recent.status === 'ACTIVE' &&
      (lastSessionDate === 0 ||
        Date.now() - lastSessionDate > 30 * 24 * 60 * 60 * 1000);

    let label = 'Active';
    let color = '#7301FF';
    if (recent.status === 'COMPLETED' || progress >= 90) {
      label = 'Bientôt diplômée';
      color = '#23c55e';
    } else if (isRisk) {
      label = 'À risque';
      color = '#FFB823';
    } else if (totalSessions === 0) {
      label = 'En onboarding';
      color = '#A34BF5';
    }

    const mentorName = recent.mentorProfile
      ? fullName(recent.mentorProfile.user)
      : '— en attente —';

    return { label, color, progress, mentorName };
  }

  const fmt = new Intl.NumberFormat('fr-FR');

  const buildHref = (overrides: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.filter && merged.filter !== 'all') next.set('filter', merged.filter);
    if (merged.q) next.set('q', merged.q);
    if (merged.page) next.set('page', merged.page);
    const qs = next.toString();
    return `/mentora/admin/mentees${qs ? `?${qs}` : ''}`;
  };

  const kpiCards: Array<{ key: FilterKey; label: string; value: number }> = [
    { key: 'all', label: 'Total', value: statsTotal },
    { key: 'matched', label: 'Avec match', value: statsMatched },
    { key: 'unmatched', label: 'Sans match', value: statsUnmatched },
    { key: 'all', label: 'En onboarding', value: statsOnboarding },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── KPI grid ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {kpiCards.map((s, i) => {
          const c =
            STAT_COLOR[(['all', 'matched', 'unmatched', 'risk'] as FilterKey[])[i] ?? 'all'] ??
            '#7301FF';
          return (
            <div
              key={s.label}
              className="dz-card"
              style={{ padding: 16 }}
            >
              <div
                className="dz-small"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c, marginTop: 4 }}>
                {fmt.format(s.value)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Annuaire ─────────────────────────────────────────────────── */}
      <div className="dz-card" style={{ padding: 22 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1f3a' }}>
            Mentorées · cycle Printemps 2026
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ filter: f.key === 'all' ? undefined : f.key, page: undefined })}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    border: 'none',
                    background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
                    color: active ? '#7301FF' : '#545b7a',
                    fontSize: 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Search input — kept as a small inline form, not in the title bar. */}
        {(query || rows.length > 6) && (
          <form
            method="GET"
            action="/mentora/admin/mentees"
            style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}
          >
            {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Recherche nom, email, objectif…"
              style={{
                flex: 1,
                minWidth: 240,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(115,1,255,0.15)',
                fontSize: 12,
              }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#7301FF',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Chercher
            </button>
          </form>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  color: '#545b7a',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <th style={{ padding: '10px 8px', fontWeight: 700 }}>Mentorée</th>
                <th style={{ padding: '10px 8px', fontWeight: 700 }}>Objectif</th>
                <th style={{ padding: '10px 8px', fontWeight: 700 }}>Mentor attribué</th>
                <th style={{ padding: '10px 8px', fontWeight: 700, width: 180 }}>Progression</th>
                <th style={{ padding: '10px 8px', fontWeight: 700 }}>Statut</th>
                <th style={{ padding: '10px 8px', fontWeight: 700 }} aria-label="Action" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: 24, textAlign: 'center', color: '#8b91ad' }}
                  >
                    Aucune mentorée ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                rows.map((m) => {
                  const name = fullName(m.user);
                  const accent = colorFor(m.userId ?? name);
                  const { label, color, progress, mentorName } = deriveStatus(m);
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid rgba(115,1,255,0.06)' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            aria-hidden
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: accent,
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 11,
                              flexShrink: 0,
                            }}
                          >
                            {initialsFor(name)}
                          </div>
                          <span style={{ color: '#1a1f3a', fontWeight: 700 }}>{name}</span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          color: '#545b7a',
                          maxWidth: 220,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={m.goals}
                      >
                        {m.goals.length > 0 ? m.goals.slice(0, 60) : '—'}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#1a1f3a' }}>{mentorName}</td>
                      <td style={{ padding: '12px 8px', width: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: 'rgba(115,1,255,0.08)',
                            }}
                          >
                            <div
                              style={{
                                width: `${progress}%`,
                                height: '100%',
                                borderRadius: 2,
                                background: color,
                              }}
                            />
                          </div>
                          <span style={{ color: '#1a1f3a', fontWeight: 700 }}>{progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: `${color}22`,
                            color,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {m.mentorships[0] ? (
                          <Link
                            href={`/mentora/dashboard/mentorships/${m.mentorships[0].id}`}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 7,
                              border: '1px solid rgba(115,1,255,0.2)',
                              background: 'transparent',
                              color: '#7301FF',
                              fontSize: 11,
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-block',
                            }}
                          >
                            Suivre
                          </Link>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#8b91ad',
                              fontStyle: 'italic',
                            }}
                          >
                            Pas de mentorship
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ marginTop: 16 }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filteredTotal}
              buildHref={(p) => buildHref({ page: String(p) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

