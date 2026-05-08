import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapports · Admin Mentora' };

/**
 * `/mentora/admin/reports` — exports & rapports synthèse.
 *
 * Vue agrégée par période (cette semaine, ce mois, total) sur les indicateurs
 * Mentora. Chaque section a un bouton d'export CSV qui pointe vers
 * `/api/admin/mentora/reports/export?kind=…` (admin-only, audit-logged,
 * cap 5 000 lignes).
 */

const EXPORT_KINDS = [
  { kind: 'sessions', label: 'Toutes les sessions' },
  { kind: 'mentorships', label: 'Tous les mentorships' },
  { kind: 'requests', label: 'Toutes les demandes' },
  { kind: 'reviews', label: 'Tous les avis' },
  { kind: 'mentors', label: 'Tous les mentors' },
  { kind: 'mentees', label: 'Toutes les mentorées' },
] as const;
export default async function ReportsPage() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [
    sessionsTotal,
    sessionsWeek,
    sessionsMonth,
    mentorshipsTotal,
    mentorshipsActive,
    mentorshipsWeek,
    requestsTotal,
    requestsAccepted,
    requestsDeclined,
    reviewsTotal,
    reviewsAvg,
    completionRate,
  ] = await Promise.all([
    prisma.session.count(),
    prisma.session.count({ where: { scheduledAt: { gte: weekAgo } } }),
    prisma.session.count({ where: { scheduledAt: { gte: monthAgo } } }),
    prisma.mentorship.count(),
    prisma.mentorship.count({ where: { status: 'ACTIVE' } }),
    prisma.mentorship.count({ where: { startedAt: { gte: weekAgo } } }),
    prisma.mentorshipRequest.count(),
    prisma.mentorshipRequest.count({ where: { status: 'ACCEPTED' } }),
    prisma.mentorshipRequest.count({ where: { status: 'DECLINED' } }),
    prisma.review.count(),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.session.count({ where: { status: 'COMPLETED' } }),
  ]);

  const acceptanceRate =
    requestsTotal > 0 ? Math.round((requestsAccepted / requestsTotal) * 100) : 0;
  const declineRate =
    requestsTotal > 0 ? Math.round((requestsDeclined / requestsTotal) * 100) : 0;
  const sessionCompletionRate =
    sessionsTotal > 0 ? Math.round((completionRate / sessionsTotal) * 100) : 0;
  const fmt = new Intl.NumberFormat('fr-FR');

  const sections: Array<{
    id: string;
    title: string;
    rows: { label: string; value: string }[];
    exportKind: typeof EXPORT_KINDS[number]['kind'];
  }> = [
    {
      id: 'sessions',
      title: 'Sessions',
      exportKind: 'sessions',
      rows: [
        { label: 'Total cumulé', value: fmt.format(sessionsTotal) },
        { label: 'Cette semaine', value: fmt.format(sessionsWeek) },
        { label: '30 derniers jours', value: fmt.format(sessionsMonth) },
        { label: 'Taux de complétion', value: `${sessionCompletionRate}%` },
      ],
    },
    {
      id: 'mentorships',
      title: 'Mentorships',
      exportKind: 'mentorships',
      rows: [
        { label: 'Total cumulé', value: fmt.format(mentorshipsTotal) },
        { label: 'Actifs', value: fmt.format(mentorshipsActive) },
        { label: 'Démarrés cette semaine', value: fmt.format(mentorshipsWeek) },
      ],
    },
    {
      id: 'requests',
      title: 'Demandes de mentorat',
      exportKind: 'requests',
      rows: [
        { label: 'Total reçues', value: fmt.format(requestsTotal) },
        { label: 'Acceptées', value: `${fmt.format(requestsAccepted)} (${acceptanceRate}%)` },
        { label: 'Refusées', value: `${fmt.format(requestsDeclined)} (${declineRate}%)` },
      ],
    },
    {
      id: 'satisfaction',
      title: 'Satisfaction',
      exportKind: 'reviews',
      rows: [
        { label: 'Avis collectés', value: fmt.format(reviewsTotal) },
        {
          label: 'Note moyenne',
          value: reviewsAvg._avg.rating !== null ? `${reviewsAvg._avg.rating.toFixed(2)} / 5` : '—',
        },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
            Rapports & exports
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Vue synthèse temps réel · Export CSV (max 5 000 lignes par fichier).
          </p>
        </div>
        {/* Bulk-export bar — every dataset in one click each. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          {EXPORT_KINDS.map((e) => (
            <a
              key={e.kind}
              href={`/api/admin/mentora/reports/export?kind=${e.kind}`}
              download
              style={{
                padding: '8px 14px',
                borderRadius: 9,
                border: '1px solid rgba(115,1,255,0.20)',
                background: 'white',
                color: '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span aria-hidden>⬇</span> {e.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {sections.map((s) => (
          <div
            key={s.title}
            id={s.id}
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 16,
              padding: 22,
              scrollMarginTop: 96,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1a1f3a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {s.title}
              </h3>
              <a
                href={`/api/admin/mentora/reports/export?kind=${s.exportKind}`}
                download
                title={`Exporter ${s.title.toLowerCase()} en CSV`}
                style={{
                  padding: '4px 10px',
                  borderRadius: 7,
                  background: 'rgba(115,1,255,0.08)',
                  color: '#7301FF',
                  fontSize: 11,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                CSV ↓
              </a>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.label}>
                    <td style={{ padding: '8px 0', fontSize: 13, color: '#545b7a' }}>{r.label}</td>
                    <td style={{ padding: '8px 0', fontSize: 14, fontWeight: 700, color: '#1a1f3a', textAlign: 'right' }}>
                      {r.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
