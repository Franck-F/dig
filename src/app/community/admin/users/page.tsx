import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { MemberStatus, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Membres · Admin Communauté' };

type Search = {
  status?: string;
  q?: string;
  page?: string;
};

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<MemberStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Actif', color: '#23c55e' },
  MUTED: { label: 'Muet', color: '#A34BF5' },
  SUSPENDED: { label: 'Suspendu', color: '#F46FB1' },
  BANNED: { label: 'Banni', color: '#ef4444' },
};

export default async function AdminCommunityUsersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const statusFilter =
    sp.status && Object.keys(STATUS_LABELS).includes(sp.status)
      ? (sp.status as MemberStatus)
      : null;
  const query = sp.q?.trim().slice(0, 100) ?? '';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const where: Prisma.CommunityMemberWhereInput = {};
  if (statusFilter) where.status = statusFilter;
  if (query) {
    where.OR = [
      { handle: { contains: query, mode: 'insensitive' } },
      { displayName: { contains: query, mode: 'insensitive' } },
      { user: { email: { contains: query, mode: 'insensitive' } } },
    ];
  }

  const [total, rows, statusCounts] = await Promise.all([
    prisma.communityMember.count({ where }),
    prisma.communityMember.findMany({
      where,
      orderBy: { joinedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        isModerator: true,
        isCoreTeam: true,
        isFounder: true,
        postCount: true,
        commentCount: true,
        joinedAt: true,
        user: { select: { email: true, name: true } },
        _count: { select: { badges: true } },
      },
    }),
    prisma.communityMember.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fmt = new Intl.NumberFormat('fr-FR');
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const buildHref = (overrides: Partial<Search>) => {
    const next = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.status) next.set('status', merged.status);
    if (merged.q) next.set('q', merged.q);
    if (merged.page) next.set('page', merged.page);
    const qs = next.toString();
    return `/community/admin/users${qs ? `?${qs}` : ''}`;
  };

  const statusFilters: Array<{ key: MemberStatus | null; label: string }> = [
    { key: null, label: 'Tous' },
    { key: 'ACTIVE', label: STATUS_LABELS.ACTIVE.label },
    { key: 'MUTED', label: STATUS_LABELS.MUTED.label },
    { key: 'SUSPENDED', label: STATUS_LABELS.SUSPENDED.label },
    { key: 'BANNED', label: STATUS_LABELS.BANNED.label },
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
            Membres communauté · {fmt.format(total)}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Annuaire complet, modération individuelle accessible depuis le détail.
          </p>
        </div>
        <form method="GET" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="handle, nom, email…"
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
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
              <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#545b7a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Membre</th>
              <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: '#545b7a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</th>
              <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: '#545b7a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Posts</th>
              <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: '#545b7a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comments</th>
              <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: '#545b7a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Badges</th>
              <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 700, color: '#545b7a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Inscrit·e</th>
              <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#545b7a', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>—</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#8b91ad' }}>
                  Aucun membre ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const sLabel = STATUS_LABELS[m.status];
                const display = m.displayName ?? m.user.name ?? `@${m.handle}`;
                const tags: { label: string; color: string }[] = [];
                if (m.isFounder) tags.push({ label: 'Fondateur·rice', color: '#F46FB1' });
                if (m.isCoreTeam) tags.push({ label: 'Core team', color: '#7301FF' });
                if (m.isModerator) tags.push({ label: 'Modérateur·rice', color: '#A34BF5' });
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid rgba(115,1,255,0.06)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatarUrl}
                            alt=""
                            width={32}
                            height={32}
                            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            aria-hidden
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            {display.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#1a1f3a', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            {display}
                            {tags.map((tag) => (
                              <span
                                key={tag.label}
                                style={{
                                  padding: '1px 6px',
                                  borderRadius: 999,
                                  background: `${tag.color}22`,
                                  color: tag.color,
                                  fontSize: 9,
                                  fontWeight: 700,
                                }}
                              >
                                {tag.label}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 12, color: '#8b91ad' }}>@{m.handle} · {m.user.email}</div>
                        </div>
                      </div>
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
                    <td style={{ padding: '14px 8px', color: '#1a1f3a', fontWeight: 600 }}>{m.postCount}</td>
                    <td style={{ padding: '14px 8px', color: '#545b7a' }}>{m.commentCount}</td>
                    <td style={{ padding: '14px 8px', color: '#545b7a' }}>{m._count.badges}</td>
                    <td style={{ padding: '14px 8px', color: '#545b7a' }}>{dateFmt.format(m.joinedAt)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <Link
                        href={`/community/admin/users/${m.handle}`}
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
                        Modérer
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
