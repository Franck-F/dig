import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { MentorStatus, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mentors · Admin Mentora' };

type Search = {
  status?: string;
  q?: string;
  page?: string;
};

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<MentorStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: '#8b91ad' },
  PENDING_REVIEW: { label: 'À valider', color: '#F46FB1' },
  ACTIVE: { label: 'Actif', color: '#23c55e' },
  PAUSED: { label: 'Pausé', color: '#A34BF5' },
  SUSPENDED: { label: 'Suspendu', color: '#ef4444' },
};

export default async function AdminMentorsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const statusFilter =
    sp.status && Object.keys(STATUS_LABELS).includes(sp.status)
      ? (sp.status as MentorStatus)
      : null;
  const query = sp.q?.trim().slice(0, 100) ?? '';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const where: Prisma.MentorProfileWhereInput = {};
  if (statusFilter) where.status = statusFilter;
  if (query) {
    where.OR = [
      { headline: { contains: query, mode: 'insensitive' } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
      { user: { name: { contains: query, mode: 'insensitive' } } },
      { user: { firstName: { contains: query, mode: 'insensitive' } } },
      { user: { lastName: { contains: query, mode: 'insensitive' } } },
    ];
  }

  const [total, rows, statusCounts] = await Promise.all([
    prisma.mentorProfile.count({ where }),
    prisma.mentorProfile.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        userId: true,
        headline: true,
        status: true,
        yearsExperience: true,
        languages: true,
        isAcceptingMentees: true,
        maxConcurrentMentees: true,
        createdAt: true,
        user: { select: { name: true, firstName: true, lastName: true, email: true } },
        _count: { select: { mentorships: true } },
      },
    }),
    prisma.mentorProfile.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fullName = (u: { name: string | null; firstName: string | null; lastName: string | null; email: string }) =>
    u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
  const fmt = new Intl.NumberFormat('fr-FR');

  const buildHref = (overrides: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.status) next.set('status', merged.status);
    if (merged.q) next.set('q', merged.q);
    if (merged.page) next.set('page', merged.page);
    const qs = next.toString();
    return `/mentora/admin/mentors${qs ? `?${qs}` : ''}`;
  };

  const statusFilters: Array<{ key: MentorStatus | null; label: string }> = [
    { key: null, label: 'Tous' },
    { key: 'PENDING_REVIEW', label: STATUS_LABELS.PENDING_REVIEW.label },
    { key: 'ACTIVE', label: STATUS_LABELS.ACTIVE.label },
    { key: 'DRAFT', label: STATUS_LABELS.DRAFT.label },
    { key: 'PAUSED', label: STATUS_LABELS.PAUSED.label },
    { key: 'SUSPENDED', label: STATUS_LABELS.SUSPENDED.label },
  ];
  const countByStatus = new Map(statusCounts.map((s) => [s.status, s._count._all]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 20,
          padding: 22,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
            Mentors · {fmt.format(total)}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Gestion de l&apos;ensemble des candidatures et profils mentor.
          </p>
        </div>
        <form method="GET" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Recherche nom ou email…"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(115,1,255,0.20)',
              fontSize: 13,
              minWidth: 240,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#7301FF',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Chercher
          </button>
        </form>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          padding: '0 4px',
        }}
      >
        {statusFilters.map((f) => {
          const count = f.key ? countByStatus.get(f.key) ?? 0 : total;
          const active = (statusFilter ?? null) === f.key;
          return (
            <Link
              key={String(f.key)}
              href={buildHref({ status: f.key ?? undefined, page: undefined })}
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
                {count}
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(115,1,255,0.04)', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mentor</th>
              <th style={{ padding: '12px 8px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</th>
              <th style={{ padding: '12px 8px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>XP</th>
              <th style={{ padding: '12px 8px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Langues</th>
              <th style={{ padding: '12px 8px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Charge</th>
              <th style={{ padding: '12px 16px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>—</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#8b91ad' }}>
                  Aucun mentor ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const sLabel = STATUS_LABELS[m.status];
                const load =
                  m.maxConcurrentMentees > 0
                    ? `${m._count.mentorships}/${m.maxConcurrentMentees}`
                    : `${m._count.mentorships}/—`;
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid rgba(115,1,255,0.06)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#1a1f3a' }}>{fullName(m.user)}</div>
                      <div style={{ fontSize: 12, color: '#8b91ad' }}>{m.user.email}</div>
                    </td>
                    <td style={{ padding: '14px 8px' }}>
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
                    </td>
                    <td style={{ padding: '14px 8px', color: '#1a1f3a', fontWeight: 600 }}>
                      {m.yearsExperience} an{m.yearsExperience > 1 ? 's' : ''}
                    </td>
                    <td style={{ padding: '14px 8px', color: '#545b7a' }}>{m.languages.join(', ') || '—'}</td>
                    <td style={{ padding: '14px 8px', color: '#1a1f3a', fontWeight: 600 }}>
                      {load}
                      {!m.isAcceptingMentees && (
                        <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 6, fontWeight: 700 }}>
                          (FERMÉ)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <Link
                        href={`/mentora/${m.userId}`}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(115,1,255,0.20)',
                          color: '#7301FF',
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        Profil
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
          {page > 1 && (
            <Link
              href={buildHref({ page: String(page - 1) })}
              style={{
                padding: '8px 14px',
                borderRadius: 9,
                border: '1px solid rgba(115,1,255,0.20)',
                color: '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              ← Précédent
            </Link>
          )}
          <span style={{ fontSize: 12, color: '#545b7a', fontWeight: 600 }}>
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildHref({ page: String(page + 1) })}
              style={{
                padding: '8px 14px',
                borderRadius: 9,
                border: '1px solid rgba(115,1,255,0.20)',
                color: '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Suivant →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
