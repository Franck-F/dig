import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ModerationActions from './ModerationActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Modération · Admin Mentorat' };

/**
 * `/mentora/admin/moderation` — modération côté Mentorat.
 *
 * Pour l'instant, Mentorat n'a pas de système de signalement de mentorship
 * indépendant. Cette page agrège les signaux pertinents :
 *  - Mentors inactifs (statut ACTIVE mais updatedAt > 60j) — à relancer
 *  - Mentorships sans session depuis 30j — risque d'abandon
 *  - Reviews 1-2 étoiles récentes — à examiner
 *
 * Pour la modération de la communauté (posts/comments), le bouton renvoie
 * vers `/community/admin/moderation`.
 */
export default async function MentoratModerationPage() {
  const now = new Date();
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // The Review model has no `handledAt` field, so the audit log is the
  // source of truth for whether a low review was already examined.
  const [inactiveMentors, staleMentorships, lowReviews, handledReviewLogs] = await Promise.all([
    prisma.mentorProfile.findMany({
      where: { status: 'ACTIVE', updatedAt: { lt: sixtyDaysAgo } },
      take: 10,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        headline: true,
        updatedAt: true,
        user: { select: { name: true, email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.mentorship.findMany({
      where: {
        status: 'ACTIVE',
        sessions: { none: { scheduledAt: { gte: thirtyDaysAgo } } },
      },
      take: 10,
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        startedAt: true,
        mentorProfile: {
          select: { user: { select: { name: true, email: true, firstName: true, lastName: true } } },
        },
        menteeProfile: {
          select: { user: { select: { name: true, email: true, firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.review.findMany({
      where: { rating: { lte: 2 } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        mentorship: {
          select: {
            mentorProfile: {
              select: { user: { select: { name: true, email: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: 'review.handled', targetType: 'Review' },
      select: { targetId: true },
    }),
  ]);
  const handledReviewIds = new Set(
    handledReviewLogs.map((l) => l.targetId).filter((v): v is string => Boolean(v)),
  );

  const fullName = (u: { name: string | null; firstName: string | null; lastName: string | null; email: string }) =>
    u.name ?? ([u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email);

  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const card: React.CSSProperties = {
    background: 'white',
    border: '1px solid rgba(115,1,255,0.10)',
    borderRadius: 16,
    padding: 22,
  };
  const sectionTitle: React.CSSProperties = { margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1a1f3a' };
  const emptyP: React.CSSProperties = { margin: 0, fontSize: 13, color: '#8b91ad' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          ...card,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
            Modération Mentorat
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
            Signaux de risque sur les mentorships actifs.
          </p>
        </div>
        <Link
          href="/community/admin/moderation"
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(115,1,255,0.08)',
            color: '#7301FF',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          ◇ Modération communauté →
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div style={card}>
          <h3 style={sectionTitle}>Mentors inactifs &gt; 60 jours</h3>
          {inactiveMentors.length === 0 ? (
            <p style={emptyP}>Aucun. Tous les mentors actifs sont à jour. ✓</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {inactiveMentors.map((m) => (
                <li
                  key={m.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(115,1,255,0.06)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>{fullName(m.user)}</div>
                    <div style={{ fontSize: 11, color: '#8b91ad' }}>
                      Profil mis à jour le {dateFmt.format(m.updatedAt)} · {m.headline.slice(0, 60)}
                    </div>
                  </div>
                  <ModerationActions variant="mentor-inactive" id={m.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={card}>
          <h3 style={sectionTitle}>Mentorships sans session &gt; 30 jours</h3>
          {staleMentorships.length === 0 ? (
            <p style={emptyP}>Aucun. Tous les mentorships actifs ont eu une session récente. ✓</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {staleMentorships.map((ms) => (
                <li
                  key={ms.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(115,1,255,0.06)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                      {fullName(ms.mentorProfile.user)} ↔ {fullName(ms.menteeProfile.user)}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b91ad' }}>
                      Mentorship démarré le {ms.startedAt ? dateFmt.format(ms.startedAt) : '—'}
                    </div>
                  </div>
                  <ModerationActions variant="mentorship-stale" id={ms.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={card}>
          <h3 style={sectionTitle}>Avis 1-2 étoiles récents</h3>
          {lowReviews.length === 0 ? (
            <p style={emptyP}>Aucun. Pas d&apos;avis négatifs récents. ✓</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lowReviews.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(115,1,255,0.06)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                      ★ {r.rating}/5 — {fullName(r.mentorship.mentorProfile.user)}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b91ad' }}>{dateFmt.format(r.createdAt)}</div>
                    {r.comment && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#545b7a', fontStyle: 'italic' }}>
                        « {r.comment.slice(0, 140)}{r.comment.length > 140 ? '…' : ''} »
                      </p>
                    )}
                  </div>
                  <ModerationActions
                    variant="review-low"
                    id={r.id}
                    reviewHandled={handledReviewIds.has(r.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
