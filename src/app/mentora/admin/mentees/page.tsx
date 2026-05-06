import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { MenteeLevel, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mentorées · Admin Mentora' };

type Search = {
  level?: string;
  q?: string;
  page?: string;
};

const PAGE_SIZE = 25;

const LEVEL_LABELS: Record<MenteeLevel, { label: string; color: string }> = {
  BEGINNER: { label: 'Débutante', color: '#3B7BFF' },
  INTERMEDIATE: { label: 'Intermédiaire', color: '#7301FF' },
  ADVANCED: { label: 'Avancée', color: '#A34BF5' },
};

export default async function AdminMenteesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const levelFilter =
    sp.level && Object.keys(LEVEL_LABELS).includes(sp.level)
      ? (sp.level as MenteeLevel)
      : null;
  const query = sp.q?.trim().slice(0, 100) ?? '';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const where: Prisma.MenteeProfileWhereInput = {};
  if (levelFilter) where.level = levelFilter;
  if (query) {
    where.OR = [
      { goals: { contains: query, mode: 'insensitive' } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
      { user: { name: { contains: query, mode: 'insensitive' } } },
      { user: { firstName: { contains: query, mode: 'insensitive' } } },
      { user: { lastName: { contains: query, mode: 'insensitive' } } },
    ];
  }

  const [total, rows, levelCounts] = await Promise.all([
    prisma.menteeProfile.count({ where }),
    prisma.menteeProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        userId: true,
        goals: true,
        level: true,
        languages: true,
        location: true,
        preferredFormat: true,
        createdAt: true,
        user: { select: { name: true, firstName: true, lastName: true, email: true } },
        _count: { select: { mentorships: true, sentRequests: true } },
      },
    }),
    prisma.menteeProfile.groupBy({ by: ['level'], _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fullName = (u: { name: string | null; firstName: string | null; lastName: string | null; email: string }) =>
    u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);
  const fmt = new Intl.NumberFormat('fr-FR');
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const buildHref = (overrides: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.level) next.set('level', merged.level);
    if (merged.q) next.set('q', merged.q);
    if (merged.page) next.set('page', merged.page);
    const qs = next.toString();
    return `/mentora/admin/mentees${qs ? `?${qs}` : ''}`;
  };

  const levelFilters: Array<{ key: MenteeLevel | null; label: string }> = [
    { key: null, label: 'Toutes' },
    { key: 'BEGINNER', label: LEVEL_LABELS.BEGINNER.label },
    { key: 'INTERMEDIATE', label: LEVEL_LABELS.INTERMEDIATE.label },
    { key: 'ADVANCED', label: LEVEL_LABELS.ADVANCED.label },
  ];
  const countByLevel = new Map(levelCounts.map((s) => [s.level, s._count._all]));

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
            Mentorées · {fmt.format(total)}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Annuaire des apprenantes inscrites au programme.
          </p>
        </div>
        <form method="GET" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {levelFilter && <input type="hidden" name="level" value={levelFilter} />}
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Recherche nom, email, objectif…"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(115,1,255,0.20)',
              fontSize: 13,
              minWidth: 280,
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
        {levelFilters.map((f) => {
          const count = f.key ? countByLevel.get(f.key) ?? 0 : total;
          const active = (levelFilter ?? null) === f.key;
          return (
            <Link
              key={String(f.key)}
              href={buildHref({ level: f.key ?? undefined, page: undefined })}
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
              <th style={{ padding: '12px 16px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mentorée</th>
              <th style={{ padding: '12px 8px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Niveau</th>
              <th style={{ padding: '12px 8px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mentorships</th>
              <th style={{ padding: '12px 8px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Demandes</th>
              <th style={{ padding: '12px 16px', color: '#545b7a', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inscrite</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#8b91ad' }}>
                  Aucune mentorée ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const lLabel = LEVEL_LABELS[m.level];
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid rgba(115,1,255,0.06)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#1a1f3a' }}>{fullName(m.user)}</div>
                      <div style={{ fontSize: 12, color: '#8b91ad', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.user.email} · {m.goals.slice(0, 80)}
                      </div>
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: 999,
                          background: `${lLabel.color}22`,
                          color: lLabel.color,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {lLabel.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 8px', color: '#1a1f3a', fontWeight: 600 }}>{m._count.mentorships}</td>
                    <td style={{ padding: '14px 8px', color: '#545b7a' }}>{m._count.sentRequests}</td>
                    <td style={{ padding: '14px 16px', color: '#545b7a' }}>{dateFmt.format(m.createdAt)}</td>
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
