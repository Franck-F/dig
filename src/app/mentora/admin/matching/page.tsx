import Link from 'next/link';
import type { MentorshipRequestStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import RematchButton from './RematchButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Matching · Admin Mentora' };

/**
 * `/mentora/admin/matching` — refondu pour matcher le handoff
 * (`mentora-admin-tabs.jsx#Matching`, "Matching IA · cycle en cours").
 *
 * Trois zones :
 *  1. Hero card gradient avec icône ⇋ + stats du cycle (validés / à
 *     examiner / refusés) + CTA "Relancer le matching" (server action).
 *  2. "Propositions à examiner" — cartes mentee↔mentor avec score
 *     d'affinité dérivé de l'overlap (langues, compétences, niveau).
 *     Boutons : "Voir détails mentee" / "Voir détails mentor" — la
 *     validation reste à la charge du mentor (action utilisateur, pas
 *     admin) pour respecter le consentement.
 *  3. Demandes hors-PENDING accessibles via un lien discret en bas.
 */

const STATUS_LABELS: Record<MentorshipRequestStatus, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: '#F46FB1' },
  ACCEPTED: { label: 'Acceptée', color: '#23c55e' },
  DECLINED: { label: 'Refusée', color: '#8b91ad' },
  WITHDRAWN: { label: 'Retirée', color: '#A34BF5' },
  EXPIRED: { label: 'Expirée', color: '#ef4444' },
};

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

type Search = { status?: string };

export default async function AdminMatchingPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const filter: MentorshipRequestStatus =
    sp.status && Object.keys(STATUS_LABELS).includes(sp.status)
      ? (sp.status as MentorshipRequestStatus)
      : 'PENDING';

  const [requests, counts, capacity, activeMentorships] = await Promise.all([
    prisma.mentorshipRequest.findMany({
      where: { status: filter },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        message: true,
        createdAt: true,
        status: true,
        fromMentee: {
          select: {
            id: true,
            userId: true,
            level: true,
            languages: true,
            goals: true,
            user: { select: { name: true, firstName: true, lastName: true, email: true } },
          },
        },
        toMentor: {
          select: {
            id: true,
            userId: true,
            headline: true,
            yearsExperience: true,
            languages: true,
            isAcceptingMentees: true,
            maxConcurrentMentees: true,
            user: { select: { name: true, firstName: true, lastName: true, email: true } },
            _count: { select: { mentorships: { where: { status: 'ACTIVE' } } } },
            skills: { select: { skillId: true }, take: 30 },
          },
        },
        topics: { select: { skillId: true, skill: { select: { name: true } } }, take: 8 },
      },
    }),
    prisma.mentorshipRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.mentorProfile.aggregate({
      where: { status: 'ACTIVE', isAcceptingMentees: true },
      _sum: { maxConcurrentMentees: true },
    }),
    prisma.mentorship.count({ where: { status: 'ACTIVE' } }),
  ]);

  const countByStatus = new Map(counts.map((s) => [s.status, s._count._all]));
  const fmt = new Intl.NumberFormat('fr-FR');
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });

  const totalCapacity = capacity._sum.maxConcurrentMentees ?? 0;
  const utilization =
    totalCapacity > 0 ? Math.round((activeMentorships / totalCapacity) * 100) : 0;

  // ── Affinity score ─────────────────────────────────────────────────
  // Synthetic, transparent: language overlap (40), skill overlap (40),
  // experience-vs-level fit (20). Capped at 99 so the UI never claims
  // a perfect match.
  type Req = (typeof requests)[number];
  function affinity(r: Req): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Languages
    const sharedLangs = r.fromMentee.languages.filter((l) =>
      r.toMentor.languages.includes(l),
    );
    if (sharedLangs.length > 0) {
      score += 40 * Math.min(1, sharedLangs.length / Math.max(1, r.fromMentee.languages.length));
      reasons.push(`Langues communes : ${sharedLangs.join(', ')}`);
    }

    // Skill overlap (mentee topics vs mentor skills)
    const mentorSkillIds = new Set(r.toMentor.skills.map((s) => s.skillId));
    const sharedSkills = r.topics.filter((t) => mentorSkillIds.has(t.skillId));
    if (sharedSkills.length > 0) {
      score += 40 * Math.min(1, sharedSkills.length / Math.max(1, r.topics.length));
      reasons.push(
        `Expertise alignée : ${sharedSkills
          .slice(0, 3)
          .map((s) => s.skill.name)
          .join(', ')}`,
      );
    } else if (r.topics.length > 0) {
      reasons.push(`À retraiter — compétences non couvertes`);
    }

    // Experience vs level fit
    const yrs = r.toMentor.yearsExperience ?? 0;
    if (r.fromMentee.level === 'BEGINNER' && yrs >= 3) {
      score += 20;
      reasons.push('Mentor expérimenté pour débutante');
    } else if (r.fromMentee.level === 'INTERMEDIATE' && yrs >= 5) {
      score += 20;
      reasons.push('Mentor senior · pratique de coaching');
    } else if (r.fromMentee.level === 'ADVANCED' && yrs >= 8) {
      score += 20;
      reasons.push('Mentor lead · stratégie de carrière');
    } else if (yrs > 0) {
      score += 10;
      reasons.push(`${yrs} ans d'expérience mentor`);
    }

    // Capacity check — surface as risk if mentor is at cap
    if (r.toMentor._count.mentorships >= r.toMentor.maxConcurrentMentees) {
      reasons.push('⚠️ Mentor à capacité — bloquera la validation');
    } else if (r.toMentor._count.mentorships > 0) {
      reasons.push(
        `${r.toMentor._count.mentorships}/${r.toMentor.maxConcurrentMentees} places occupées`,
      );
    }

    return { score: Math.min(99, Math.round(score)), reasons: reasons.slice(0, 4) };
  }

  const filters: Array<{ key: MentorshipRequestStatus; label: string }> = [
    { key: 'PENDING', label: STATUS_LABELS.PENDING.label },
    { key: 'ACCEPTED', label: STATUS_LABELS.ACCEPTED.label },
    { key: 'DECLINED', label: STATUS_LABELS.DECLINED.label },
    { key: 'EXPIRED', label: STATUS_LABELS.EXPIRED.label },
    { key: 'WITHDRAWN', label: STATUS_LABELS.WITHDRAWN.label },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Hero card ────────────────────────────────────────────────── */}
      <div
        className="dz-card"
        style={{
          padding: 22,
          background:
            'linear-gradient(135deg, rgba(115,1,255,0.06), rgba(244,111,177,0.06))',
          border: '1px solid rgba(115,1,255,0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            ⇋
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1f3a' }}>
              Matching algorithmique · cycle en cours
            </h1>
            <p
              className="dz-small"
              style={{ margin: '4px 0 0', fontSize: 12 }}
            >
              {fmt.format(activeMentorships)} matchs actifs · {fmt.format(countByStatus.get('PENDING') ?? 0)}{' '}
              à examiner · {fmt.format(countByStatus.get('DECLINED') ?? 0)} refus ·
              {' '}capacité {utilization}%
            </p>
          </div>
          <RematchButton />
        </div>
      </div>

      {/* ── Status filters ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 4px' }}>
        {filters.map((f) => {
          const active = filter === f.key;
          const label = STATUS_LABELS[f.key].label;
          return (
            <Link
              key={f.key}
              href={`/mentora/admin/matching?status=${f.key}`}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                border: 'none',
                background: active ? 'rgba(115,1,255,0.10)' : 'transparent',
                color: active ? '#7301FF' : '#545b7a',
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {label}
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: active ? 'rgba(115,1,255,0.18)' : 'rgba(115,1,255,0.08)',
                  color: '#7301FF',
                }}
              >
                {countByStatus.get(f.key) ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Propositions list ───────────────────────────────────────── */}
      <div className="dz-card" style={{ padding: 22 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
          Propositions à examiner
        </h2>

        {requests.length === 0 ? (
          <p className="dz-body" style={{ margin: 0 }}>
            Aucune demande dans cette catégorie.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((r) => {
              const menteeName = fullName(r.fromMentee.user);
              const mentorName = fullName(r.toMentor.user);
              const menteeAccent = colorFor(r.fromMentee.userId ?? menteeName);
              const mentorAccent = colorFor(r.toMentor.userId ?? mentorName);
              const { score, reasons } = affinity(r);
              const status = STATUS_LABELS[r.status];

              return (
                <div
                  key={r.id}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    background: '#faf7ff',
                    border: '1px solid rgba(115,1,255,0.08)',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(0, 1fr) 32px minmax(0, 1fr) 140px',
                      alignItems: 'center',
                      gap: 14,
                    }}
                    className="dz-match-row"
                  >
                    {/* Mentee */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${menteeAccent}, ${menteeAccent}99)`,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {initialsFor(menteeName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#1a1f3a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {menteeName}
                        </div>
                        <div className="dz-small" style={{ fontSize: 11 }}>
                          Mentorée · {(r.fromMentee.goals ?? '').slice(0, 40) || 'objectif libre'}
                        </div>
                      </div>
                    </div>

                    {/* Affinity arrow */}
                    <div
                      aria-hidden
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(115,1,255,0.10)',
                        color: '#7301FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        margin: '0 auto',
                      }}
                    >
                      ⇋
                    </div>

                    {/* Mentor */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        minWidth: 0,
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${mentorAccent}, ${mentorAccent}99)`,
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {initialsFor(mentorName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#1a1f3a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {mentorName}
                        </div>
                        <div className="dz-small" style={{ fontSize: 11 }}>
                          Mentor · {r.toMentor.headline.slice(0, 40)}
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: 'right' }}>
                      {score > 0 ? (
                        <>
                          <div
                            style={{
                              fontSize: 24,
                              fontWeight: 800,
                              color: score >= 80 ? '#23c55e' : '#7301FF',
                            }}
                          >
                            {score}%
                          </div>
                          <div
                            className="dz-small"
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                            }}
                          >
                            Affinité algorithme
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#d94e92', fontWeight: 700 }}>
                          À examiner
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reasons */}
                  {reasons.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginTop: 12,
                      }}
                    >
                      {reasons.map((reason, j) => (
                        <span
                          key={j}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: 'white',
                            border: '1px solid rgba(115,1,255,0.10)',
                            fontSize: 11,
                            color: '#1a1f3a',
                            fontWeight: 500,
                          }}
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Mentee message */}
                  {r.message && (
                    <p
                      style={{
                        margin: '12px 0 0',
                        padding: '10px 14px',
                        background: 'rgba(115,1,255,0.04)',
                        borderRadius: 10,
                        fontSize: 12,
                        color: '#1a1f3a',
                        fontStyle: 'italic',
                        lineHeight: 1.55,
                      }}
                    >
                      « {r.message.slice(0, 220)}
                      {r.message.length > 220 ? '…' : ''} »
                    </p>
                  )}

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      marginTop: 14,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <Link
                      href={`/mentora/${r.toMentor.userId}`}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'rgba(115,1,255,0.10)',
                        color: '#7301FF',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Voir détails mentor →
                    </Link>
                    <Link
                      href={`/mentora/admin/mentees?q=${encodeURIComponent(
                        r.fromMentee.user.email,
                      )}`}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: '1px solid rgba(115,1,255,0.15)',
                        background: 'transparent',
                        color: '#545b7a',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      Voir mentorée
                    </Link>
                    <span
                      style={{
                        marginLeft: 'auto',
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: `${status.color}22`,
                        color: status.color,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {status.label}
                    </span>
                    <span className="dz-small" style={{ fontSize: 11 }}>
                      Demande {dateFmt.format(r.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile/tablet: collapse the 4-col match row to a stacked layout. */}
      <style>{`
        @media (max-width: 760px) {
          .dz-match-row {
            grid-template-columns: 1fr !important;
          }
          .dz-match-row > div:nth-child(2) {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
