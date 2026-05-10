import type { CSSProperties } from 'react';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapports · Admin Mentora' };

/**
 * `/mentora/admin/reports` — refondu pour matcher le handoff
 * (`mentora-admin-tabs.jsx#Reports`, "Rapports & exports").
 *
 *  1. **3 KPI hero cards** : Heures cumulées · Taux de complétion mentorships ·
 *     Note moyenne avis. Sourcés en temps réel (sessions COMPLETED ×
 *     duration moyenne, mentorship status ratio, review.rating average).
 *
 *  2. **Exports & rapports** : la grille existante d'exports CSV par
 *     dataset, avec une icône ◧ et le bouton "Télécharger" en aligné
 *     droite — fidèle au handoff.
 *
 *  3. **Indicateurs clés** : 4 progress bars (matchs validés / assiduité
 *     sessions / mentorées qui terminent / mentors fidélisés) calculés
 *     à partir des compteurs réels.
 */

const EXPORT_KINDS = [
  { kind: 'sessions', title: 'Sessions', subtitle: 'Tout le calendrier — datetime, mentorship, statut, durée.', color: '#7301FF' },
  { kind: 'mentorships', title: 'Mentorships', subtitle: 'Pairings actifs / clos avec dates et fréquence.', color: '#A34BF5' },
  { kind: 'requests', title: 'Demandes de mentorat', subtitle: 'Demandes reçues, status, motifs de refus.', color: '#F46FB1' },
  { kind: 'reviews', title: 'Avis & feedback', subtitle: 'Notes mentorées avec verbatim anonymisés.', color: '#23c55e' },
  { kind: 'mentors', title: 'Annuaire mentors', subtitle: 'Profils mentor, disponibilités, capacité.', color: '#3B7BFF' },
  { kind: 'mentees', title: 'Annuaire mentorées', subtitle: 'Profils mentorées, niveau, objectif, langue.', color: '#FFB823' },
] as const;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function ReportsPage() {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    sessionsCompleted,
    sessionsTotal,
    sessionsCancelled,
    mentorshipsTotal,
    mentorshipsCompleted,
    mentorshipsActive,
    requestsTotal,
    requestsAccepted,
    reviewsAgg,
    activeMentors,
    activeMentorsRecent,
  ] = await Promise.all([
    safe(() => prisma.session.count({ where: { status: 'COMPLETED' } }), 0),
    safe(() => prisma.session.count(), 0),
    safe(
      () =>
        prisma.session.count({
          where: { status: { in: ['CANCELLED', 'NO_SHOW'] } },
        }),
      0,
    ),
    safe(() => prisma.mentorship.count(), 0),
    safe(() => prisma.mentorship.count({ where: { status: 'COMPLETED' } }), 0),
    safe(() => prisma.mentorship.count({ where: { status: 'ACTIVE' } }), 0),
    safe(() => prisma.mentorshipRequest.count(), 0),
    safe(() => prisma.mentorshipRequest.count({ where: { status: 'ACCEPTED' } }), 0),
    safe(
      () => prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
      { _avg: { rating: null }, _count: { _all: 0 } },
    ),
    safe(() => prisma.mentorProfile.count({ where: { status: 'ACTIVE' } }), 0),
    safe(
      () =>
        prisma.mentorProfile.count({
          where: { status: 'ACTIVE', updatedAt: { gte: sixMonthsAgo } },
        }),
      0,
    ),
  ]);

  // ── KPI numbers ─────────────────────────────────────────────────────
  // Hours assume an average 60-min session — actual durations live on
  // Session.scheduledDurationMin but the field is best-effort populated;
  // we use 60 as a stable floor.
  const cumulatedHours = sessionsCompleted * 1; // 1h average
  const completionRate =
    mentorshipsTotal > 0
      ? Math.round((mentorshipsCompleted / mentorshipsTotal) * 100)
      : 0;
  const matchValidationRate =
    requestsTotal > 0 ? Math.round((requestsAccepted / requestsTotal) * 100) : 0;
  const sessionAttendance =
    sessionsTotal > 0
      ? Math.round(((sessionsTotal - sessionsCancelled) / sessionsTotal) * 100)
      : 0;
  const mentorRetention =
    activeMentors > 0
      ? Math.round((activeMentorsRecent / activeMentors) * 100)
      : 0;
  const menteeCompletion = completionRate;

  const fmt = new Intl.NumberFormat('fr-FR');
  const avgRating = reviewsAgg._avg.rating;

  // ── Hero KPIs (3 cards) ─────────────────────────────────────────────
  const hero: Array<{ label: string; value: string; sub: string; color: string }> = [
    {
      label: 'Heures cumulées',
      value: cumulatedHours > 0 ? `${fmt.format(cumulatedHours)} h` : '—',
      sub: 'sessions complétées · base 60 min',
      color: '#7301FF',
    },
    {
      label: 'Taux de complétion',
      value: mentorshipsTotal > 0 ? `${completionRate}%` : '—',
      sub: `${fmt.format(mentorshipsCompleted)} mentorships clos · ${fmt.format(mentorshipsActive)} en cours`,
      color: '#23c55e',
    },
    {
      label: 'Note moyenne',
      value: avgRating !== null ? `${avgRating.toFixed(2)}/5` : '—',
      sub: `${fmt.format(reviewsAgg._count._all)} avis collectés`,
      color: '#F46FB1',
    },
  ];

  const kpis: Array<{ label: string; value: number; color: string }> = [
    { label: 'Taux de matchs validés', value: matchValidationRate, color: '#7301FF' },
    { label: 'Taux d’assiduité sessions', value: sessionAttendance, color: '#A34BF5' },
    { label: 'Mentorées qui terminent', value: menteeCompletion, color: '#F46FB1' },
    { label: 'Mentors fidélisés à 6 mois', value: mentorRetention, color: '#3B7BFF' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Hero KPIs ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {hero.map((s) => (
          <div key={s.label} className="dz-card" style={{ padding: 18 }}>
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
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: s.color,
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </div>
            <div className="dz-small" style={{ fontSize: 11 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Exports & rapports ──────────────────────────────────────── */}
      <div className="dz-card" style={{ padding: 22 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
              Exports &amp; rapports
            </h2>
            <p className="dz-small" style={{ margin: '4px 0 0', fontSize: 11 }}>
              Vue synthèse temps réel · Export CSV (max 5 000 lignes par fichier).
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <a
              href="/api/admin/mentora/reports/export?kind=mentorships"
              download
              style={ghostBtn()}
            >
              ↓ CSV
            </a>
          </div>
        </div>

        {EXPORT_KINDS.map((r, i) => (
          <div
            key={r.kind}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderTop: i > 0 ? '1px solid rgba(115,1,255,0.06)' : 'none',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${r.color}22`,
                color: r.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              ◧
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                {r.title}
              </div>
              <div className="dz-small" style={{ fontSize: 11 }}>
                {r.subtitle}
              </div>
            </div>
            <a
              href={`/api/admin/mentora/reports/export?kind=${r.kind}`}
              download
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid rgba(115,1,255,0.20)',
                background: 'transparent',
                color: '#7301FF',
                fontSize: 11,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Télécharger
            </a>
          </div>
        ))}
      </div>

      {/* ── Indicateurs clés ────────────────────────────────────────── */}
      <div
        className="dz-card"
        style={{
          padding: 22,
          background:
            'linear-gradient(135deg, rgba(115,1,255,0.06), rgba(244,111,177,0.06))',
        }}
      >
        <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
          Indicateurs clés
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 10,
          }}
        >
          {kpis.map((kpi) => (
            <div key={kpi.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: '#1a1f3a', fontWeight: 600 }}>{kpi.label}</span>
                <span style={{ color: kpi.color, fontWeight: 700 }}>{kpi.value}%</span>
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 3,
                  background: 'rgba(115,1,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, kpi.value))}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${kpi.color}, ${kpi.color}99)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ghostBtn(): CSSProperties {
  return {
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid rgba(115,1,255,0.15)',
    background: 'transparent',
    color: '#7301FF',
    fontSize: 11,
    fontWeight: 700,
    textDecoration: 'none',
  };
}
