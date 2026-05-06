import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import type { ChallengeStatus } from '@prisma/client';

import ChallengeCreatorModal from './_components/ChallengeCreatorModal';
import ChallengeRowActions from './_components/ChallengeRowActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Défis · Admin Communauté' };

const STATUS_LABELS: Record<
  ChallengeStatus,
  { label: string; color: string; bg: string }
> = {
  DRAFT: { label: 'Brouillon', color: '#8b91ad', bg: 'rgba(139,145,173,0.10)' },
  OPEN: { label: 'Soumissions ouvertes', color: '#23c55e', bg: 'rgba(35,197,94,0.10)' },
  VOTING: { label: 'Vote en cours', color: '#7301FF', bg: 'rgba(115,1,255,0.10)' },
  CLOSED: { label: 'Clos', color: '#A34BF5', bg: 'rgba(163,75,245,0.10)' },
};

type Search = { status?: string };

export default async function AdminChallengesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filter =
    sp.status && Object.keys(STATUS_LABELS).includes(sp.status)
      ? (sp.status as ChallengeStatus)
      : null;

  const [challenges, counts, totalSubmissions] = await Promise.all([
    prisma.challenge.findMany({
      where: filter ? { status: filter } : undefined,
      orderBy: [{ status: 'asc' }, { submissionClosesAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        prize: true,
        submissionOpensAt: true,
        submissionClosesAt: true,
        votingClosesAt: true,
        resultsAnnouncedAt: true,
        author: { select: { displayName: true, handle: true } },
        _count: { select: { submissions: true } },
      },
    }),
    prisma.challenge.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.challengeSubmission.count(),
  ]);

  const dateFmt = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const fmt = new Intl.NumberFormat('fr-FR');
  const total = counts.reduce((acc, c) => acc + c._count._all, 0);
  const countByStatus = new Map(counts.map((s) => [s.status, s._count._all]));

  const filters: Array<{ key: ChallengeStatus | null; label: string }> = [
    { key: null, label: 'Tous' },
    { key: 'DRAFT', label: STATUS_LABELS.DRAFT.label },
    { key: 'OPEN', label: STATUS_LABELS.OPEN.label },
    { key: 'VOTING', label: STATUS_LABELS.VOTING.label },
    { key: 'CLOSED', label: STATUS_LABELS.CLOSED.label },
  ];

  // Top stat cards — give the admin an at-a-glance view of where each
  // challenge sits in the lifecycle.
  const stats: Array<{
    key: ChallengeStatus | 'submissions';
    label: string;
    value: number;
    accent: string;
  }> = [
    { key: 'DRAFT', label: 'Brouillons', value: countByStatus.get('DRAFT') ?? 0, accent: '#8b91ad' },
    { key: 'OPEN', label: 'Soumissions ouvertes', value: countByStatus.get('OPEN') ?? 0, accent: '#23c55e' },
    { key: 'VOTING', label: 'Vote en cours', value: countByStatus.get('VOTING') ?? 0, accent: '#7301FF' },
    { key: 'submissions', label: 'Total soumissions', value: totalSubmissions, accent: '#F46FB1' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header band — brand-coloured to match the other admin sections. */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(244,111,177,0.08))',
          border: '1px solid rgba(115,1,255,0.15)',
          borderRadius: 22,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#7301FF',
              marginBottom: 6,
            }}
          >
            Communauté · Administration
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#1a1f3a' }}>
            Défis communautaires · {fmt.format(total)}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Pilotez le cycle complet des défis : brouillon → soumissions → vote → résultats.
          </p>
        </div>
        <ChallengeCreatorModal />
      </div>

      {/* Stat strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.key}
            style={{
              position: 'relative',
              padding: '20px 22px',
              borderRadius: 16,
              background: 'white',
              border: '1px solid rgba(115,1,255,0.10)',
              overflow: 'hidden',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 4,
                height: '100%',
                background: s.accent,
              }}
            />
            <div style={{ fontSize: 30, fontWeight: 800, color: '#1a1f3a' }}>
              {fmt.format(s.value)}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#545b7a',
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
        {filters.map((f) => {
          const count = f.key ? countByStatus.get(f.key) ?? 0 : total;
          const active = (filter ?? null) === f.key;
          return (
            <Link
              key={String(f.key)}
              href={
                f.key
                  ? `/community/admin/challenges?status=${f.key}`
                  : '/community/admin/challenges'
              }
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

      {/* Challenges list */}
      <div
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 20,
          overflow: 'hidden',
        }}
      >
        {challenges.length === 0 ? (
          <div
            style={{
              padding: '48px 24px',
              textAlign: 'center',
              color: '#8b91ad',
              fontSize: 14,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>◇</div>
            <p style={{ margin: 0, fontWeight: 600, color: '#3a2960' }}>
              Aucun défi pour le moment.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13 }}>
              Cliquez sur <strong>+ Nouveau défi</strong> pour créer le premier brouillon.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {challenges.map((c) => {
              const sLabel = STATUS_LABELS[c.status];
              const excerpt =
                c.description.length > 160
                  ? `${c.description.slice(0, 160)}…`
                  : c.description;
              return (
                <li
                  key={c.id}
                  style={{
                    padding: 20,
                    borderBottom: '1px solid rgba(115,1,255,0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#1a1f3a',
                          }}
                        >
                          {c.title}
                        </h3>
                        <span
                          style={{
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: sLabel.bg,
                            color: sLabel.color,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {sLabel.label}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '6px 0 0',
                          fontSize: 13,
                          color: '#545b7a',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {excerpt}
                      </p>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#8b91ad',
                          marginTop: 8,
                          display: 'flex',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          {fmt.format(c._count.submissions)} soumission
                          {c._count.submissions > 1 ? 's' : ''}
                        </span>
                        {c.author && <span>par @{c.author.handle}</span>}
                        {c.prize && <span>prix : {c.prize}</span>}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#545b7a',
                          marginTop: 8,
                          display: 'flex',
                          gap: 14,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          Soumissions : {dateFmt.format(c.submissionOpensAt)} →{' '}
                          {dateFmt.format(c.submissionClosesAt)}
                        </span>
                        <span>Vote ferme : {dateFmt.format(c.votingClosesAt)}</span>
                        {c.resultsAnnouncedAt && (
                          <span>Résultats : {dateFmt.format(c.resultsAnnouncedAt)}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <ChallengeRowActions id={c.id} status={c.status} />
                      <Link
                        href={`/community/challenges/${c.id}`}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(115,1,255,0.20)',
                          color: '#7301FF',
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Voir →
                      </Link>
                    </div>
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
