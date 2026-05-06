import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { MentorshipRequestStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Matching · Admin Mentora' };

const STATUS_LABELS: Record<MentorshipRequestStatus, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: '#F46FB1' },
  ACCEPTED: { label: 'Acceptée', color: '#23c55e' },
  DECLINED: { label: 'Refusée', color: '#8b91ad' },
  WITHDRAWN: { label: 'Retirée', color: '#A34BF5' },
  EXPIRED: { label: 'Expirée', color: '#ef4444' },
};

type Search = { status?: string };

/**
 * `/mentora/admin/matching` — supervision admin sur les demandes de mentorat.
 *
 * Affiche les demandes filtrées par status, avec tous les détails utiles
 * pour comprendre la qualité du match (langues partagées, niveau, capacité
 * mentor restante). Le filtre par défaut est PENDING — les demandes que les
 * mentors n'ont pas encore traitées.
 *
 * Les actions accept/decline sont laissées aux mentors eux-mêmes (server
 * actions `acceptMentorshipRequest` / `declineMentorshipRequest`). L'admin
 * supervise et peut intervenir hors-app si nécessaire.
 */
export default async function AdminMatchingPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filter =
    sp.status && Object.keys(STATUS_LABELS).includes(sp.status)
      ? (sp.status as MentorshipRequestStatus)
      : 'PENDING';

  const [requests, counts, capacity, activeMentorships] = await Promise.all([
    prisma.mentorshipRequest.findMany({
      where: { status: filter },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        message: true,
        createdAt: true,
        status: true,
        fromMentee: {
          select: {
            id: true,
            level: true,
            languages: true,
            user: { select: { name: true, firstName: true, lastName: true, email: true } },
          },
        },
        toMentor: {
          select: {
            id: true,
            headline: true,
            yearsExperience: true,
            languages: true,
            isAcceptingMentees: true,
            maxConcurrentMentees: true,
            user: { select: { name: true, firstName: true, lastName: true, email: true } },
            _count: { select: { mentorships: true } },
          },
        },
        topics: { select: { skill: { select: { name: true } } }, take: 5 },
      },
    }),
    prisma.mentorshipRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.mentorProfile.aggregate({
      where: { status: 'ACTIVE', isAcceptingMentees: true },
      _sum: { maxConcurrentMentees: true },
    }),
    prisma.mentorship.count({ where: { status: 'ACTIVE' } }),
  ]);

  const fullName = (u: { name: string | null; firstName: string | null; lastName: string | null; email: string }) =>
    u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
  const fmt = new Intl.NumberFormat('fr-FR');

  const filters: Array<{ key: MentorshipRequestStatus; label: string }> = [
    { key: 'PENDING', label: STATUS_LABELS.PENDING.label },
    { key: 'ACCEPTED', label: STATUS_LABELS.ACCEPTED.label },
    { key: 'DECLINED', label: STATUS_LABELS.DECLINED.label },
    { key: 'EXPIRED', label: STATUS_LABELS.EXPIRED.label },
    { key: 'WITHDRAWN', label: STATUS_LABELS.WITHDRAWN.label },
  ];
  const countByStatus = new Map(counts.map((s) => [s.status, s._count._all]));

  const totalCapacity = capacity._sum.maxConcurrentMentees ?? 0;
  const utilization =
    totalCapacity > 0 ? Math.round((activeMentorships / totalCapacity) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 20,
          padding: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
            Matching mentor↔mentorée
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Supervision des demandes et capacité globale du programme.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#8b91ad', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Capacité totale
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
            {fmt.format(totalCapacity)} places
          </span>
          <span style={{ fontSize: 12, color: '#545b7a' }}>
            {fmt.format(activeMentorships)} occupées · {utilization}%
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#8b91ad', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Demandes en attente
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#F46FB1' }}>
            {fmt.format(countByStatus.get('PENDING') ?? 0)}
          </span>
          <span style={{ fontSize: 12, color: '#545b7a' }}>À traiter par les mentors</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={`/mentora/admin/matching?status=${f.key}`}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                background: active ? '#7301FF' : 'white',
                border: active ? '1px solid #7301FF' : '1px solid rgba(115,1,255,0.20)',
                color: active ? 'white' : '#545b7a',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {f.label}
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: active ? 'rgba(255,255,255,0.25)' : 'rgba(115,1,255,0.10)',
                  color: active ? 'white' : '#7301FF',
                }}
              >
                {countByStatus.get(f.key) ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      <div
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        {requests.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#8b91ad', fontSize: 14 }}>
            Aucune demande dans cette catégorie.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {requests.map((r) => {
              const sLabel = STATUS_LABELS[r.status];
              const overlap = r.fromMentee.languages.filter((l) => r.toMentor.languages.includes(l));
              return (
                <li key={r.id} style={{ padding: 18, borderBottom: '1px solid rgba(115,1,255,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 10, color: '#7301FF', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Demande de
                      </span>
                      <div style={{ fontWeight: 700, color: '#1a1f3a', fontSize: 14 }}>
                        {fullName(r.fromMentee.user)}
                      </div>
                      <div style={{ fontSize: 12, color: '#8b91ad' }}>
                        {r.fromMentee.user.email} · niveau {r.fromMentee.level} · {r.fromMentee.languages.join(', ')}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: '#A34BF5', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Vers le mentor
                      </span>
                      <div style={{ fontWeight: 700, color: '#1a1f3a', fontSize: 14 }}>
                        {fullName(r.toMentor.user)}
                      </div>
                      <div style={{ fontSize: 12, color: '#8b91ad' }}>
                        {r.toMentor.headline.slice(0, 60)} · {r.toMentor._count.mentorships}/{r.toMentor.maxConcurrentMentees} places
                      </div>
                    </div>
                  </div>

                  {r.message && (
                    <p style={{ margin: '12px 0 0', padding: '10px 14px', background: 'rgba(115,1,255,0.04)', borderRadius: 10, fontSize: 13, color: '#1a1f3a', fontStyle: 'italic', lineHeight: 1.5 }}>
                      « {r.message.slice(0, 220)}{r.message.length > 220 ? '…' : ''} »
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: `${sLabel.color}22`,
                        color: sLabel.color,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {sLabel.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#8b91ad' }}>
                      Demande {dateFmt.format(r.createdAt)}
                    </span>
                    {overlap.length > 0 && (
                      <span style={{ fontSize: 11, color: '#23c55e', fontWeight: 600 }}>
                        ✓ Langues : {overlap.join(', ')}
                      </span>
                    )}
                    {r.topics.slice(0, 3).map((t) => (
                      <span
                        key={t.skill.name}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(244,111,177,0.10)',
                          color: '#d94e92',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {t.skill.name}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
