import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rapports · Admin Mentora' };

/**
 * `/mentora/admin/reports` — exports & rapports synthèse.
 *
 * Affiche une vue agrégée par période (cette semaine, ce mois, total) sur
 * les indicateurs Mentora les plus suivis. Les boutons d'export (CSV) sont
 * volontairement non-fonctionnels pour l'instant — pipeline d'export à
 * implémenter dans une prochaine livraison.
 */
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

  const sections = [
    {
      title: 'Sessions',
      rows: [
        { label: 'Total cumulé', value: fmt.format(sessionsTotal) },
        { label: 'Cette semaine', value: fmt.format(sessionsWeek) },
        { label: '30 derniers jours', value: fmt.format(sessionsMonth) },
        { label: 'Taux de complétion', value: `${sessionCompletionRate}%` },
      ],
    },
    {
      title: 'Mentorships',
      rows: [
        { label: 'Total cumulé', value: fmt.format(mentorshipsTotal) },
        { label: 'Actifs', value: fmt.format(mentorshipsActive) },
        { label: 'Démarrés cette semaine', value: fmt.format(mentorshipsWeek) },
      ],
    },
    {
      title: 'Demandes de mentorat',
      rows: [
        { label: 'Total reçues', value: fmt.format(requestsTotal) },
        { label: 'Acceptées', value: `${fmt.format(requestsAccepted)} (${acceptanceRate}%)` },
        { label: 'Refusées', value: `${fmt.format(requestsDeclined)} (${declineRate}%)` },
      ],
    },
    {
      title: 'Satisfaction',
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
            Vue synthèse temps réel · Exports CSV à venir.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {sections.map((s) => (
          <div
            key={s.title}
            style={{
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 16,
              padding: 22,
            }}
          >
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#1a1f3a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {s.title}
            </h3>
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
