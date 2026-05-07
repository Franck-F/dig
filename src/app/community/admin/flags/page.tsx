import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { logAdmin } from '@/lib/audit/log';
import {
  findHyperactiveReporters,
  findMentionStorms,
  findRepeatOffenders,
} from '@/lib/community/abuse-patterns';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Signaux modération · Communauté' };

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Admin-only dashboard for cyber-harassment signals. Three queries run
 * live against the existing indexes (Report.againstMemberId,
 * Mention.targetMemberId, Report.reporterId). No write side — every
 * decision is the moderator's.
 *
 * Audit-logged on view since the page surfaces aggregate behavioural
 * patterns about specific members. The trail names which admin saw
 * which list when, in case a downstream action is challenged.
 */
export default async function AdminFlagsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect('/login?next=/community/admin/flags');

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (me?.role !== 'ADMIN') redirect('/community');

  const [repeatOffenders, hyperactiveReporters, mentionStorms] = await Promise.all([
    findRepeatOffenders(),
    findHyperactiveReporters(),
    findMentionStorms(),
  ]);

  await logAdmin(userId, {
    action: 'community.flags_view',
    targetType: 'Community',
    payload: {
      repeatOffenders: repeatOffenders.length,
      hyperactiveReporters: hyperactiveReporters.length,
      mentionStorms: mentionStorms.length,
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(244,111,177,0.08))',
          border: '1px solid rgba(115,1,255,0.15)',
          borderRadius: 22,
          padding: 22,
        }}
      >
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
          Communauté · Signaux faibles
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
          Détection des patterns d&apos;abus
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
          Signaux automatisés sur les 7 derniers jours (cibles fréquentes) ou les 24 dernières
          heures (rapporteurs prolifiques, pile-ons par mentions). Chaque ligne nécessite une
          revue humaine — aucune action n&apos;est appliquée automatiquement.
        </p>
      </div>

      <FlagSection
        title="Cibles de signalements répétés"
        subtitle="Membres signalés ≥ 3 fois par ≥ 2 rapporteurs distincts (7 derniers jours)"
        emptyState="Aucune cible récurrente."
      >
        {repeatOffenders.length === 0 ? null : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: 'rgba(115,1,255,0.04)' }}>
                <th style={th}>Membre</th>
                <th style={th}>Signalements</th>
                <th style={th}>Rapporteurs</th>
                <th style={th}>Première</th>
                <th style={th}>Dernière</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {repeatOffenders.map((row) => (
                <tr key={row.memberId} style={tr}>
                  <td style={td}>
                    <div style={{ fontWeight: 700, color: '#1a1f3a' }}>
                      {row.displayName ?? `@${row.handle}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b91ad' }}>@{row.handle}</div>
                  </td>
                  <td style={tdNumber}>{row.reportCount}</td>
                  <td style={tdNumber}>{row.distinctReporters}</td>
                  <td style={tdSm}>{dateFmt.format(row.firstReportAt)}</td>
                  <td style={tdSm}>{dateFmt.format(row.lastReportAt)}</td>
                  <td style={td}>
                    <Link
                      href={`/community/admin/users/${row.handle}`}
                      style={linkBtn}
                    >
                      Examiner →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FlagSection>

      <FlagSection
        title="Rapporteurs prolifiques"
        subtitle="Membres ayant filé ≥ 4 signalements en 24 h. Légitime ou coordonné — à scanner."
        emptyState="Aucun rapporteur hyperactif."
      >
        {hyperactiveReporters.length === 0 ? null : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: 'rgba(115,1,255,0.04)' }}>
                <th style={th}>Rapporteur</th>
                <th style={th}>Signalements</th>
                <th style={th}>Cibles distinctes</th>
                <th style={th}>Dernière</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {hyperactiveReporters.map((row) => (
                <tr key={row.memberId} style={tr}>
                  <td style={td}>
                    <div style={{ fontWeight: 700, color: '#1a1f3a' }}>
                      {row.displayName ?? `@${row.handle}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b91ad' }}>@{row.handle}</div>
                  </td>
                  <td style={tdNumber}>{row.reportCount}</td>
                  <td style={tdNumber}>{row.distinctTargets}</td>
                  <td style={tdSm}>{dateFmt.format(row.lastReportAt)}</td>
                  <td style={td}>
                    <Link
                      href={`/community/admin/users/${row.handle}`}
                      style={linkBtn}
                    >
                      Examiner →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FlagSection>

      <FlagSection
        title="Pile-ons par mention"
        subtitle="Membres mentionnés par ≥ 3 auteurs distincts avec ≥ 10 mentions en 24 h. Souvent le premier signal d'un harcèlement coordonné."
        emptyState="Aucun pic de mentions."
      >
        {mentionStorms.length === 0 ? null : (
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: 'rgba(115,1,255,0.04)' }}>
                <th style={th}>Cible</th>
                <th style={th}>Mentions</th>
                <th style={th}>Auteurs distincts</th>
                <th style={th}>Début fenêtre</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {mentionStorms.map((row) => (
                <tr key={row.memberId} style={tr}>
                  <td style={td}>
                    <div style={{ fontWeight: 700, color: '#1a1f3a' }}>
                      {row.displayName ?? `@${row.handle}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b91ad' }}>@{row.handle}</div>
                  </td>
                  <td style={tdNumber}>{row.mentionCount}</td>
                  <td style={tdNumber}>{row.distinctAuthors}</td>
                  <td style={tdSm}>{dateFmt.format(row.windowStartedAt)}</td>
                  <td style={td}>
                    <Link
                      href={`/community/admin/users/${row.handle}`}
                      style={linkBtn}
                    >
                      Examiner →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FlagSection>
    </div>
  );
}

function FlagSection({
  title,
  subtitle,
  emptyState,
  children,
}: {
  title: string;
  subtitle: string;
  emptyState: string;
  children: React.ReactNode;
}) {
  const isEmpty = children == null || children === false;
  return (
    <section
      style={{
        background: 'white',
        border: '1px solid rgba(115,1,255,0.10)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1a1f3a' }}>{title}</h2>
      <p style={{ margin: '4px 0 12px', fontSize: 12, color: '#8b91ad' }}>{subtitle}</p>
      {isEmpty ? (
        <div
          style={{
            padding: 18,
            textAlign: 'center',
            color: '#8b91ad',
            fontSize: 13,
            background: 'rgba(115,1,255,0.04)',
            borderRadius: 10,
          }}
        >
          {emptyState}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};
const th: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#545b7a',
};
const tr: React.CSSProperties = { borderTop: '1px solid rgba(115,1,255,0.06)' };
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top', color: '#1a1f3a' };
const tdNumber: React.CSSProperties = {
  ...td,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 700,
};
const tdSm: React.CSSProperties = { ...td, fontSize: 12, color: '#545b7a' };
const linkBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 8,
  border: '1px solid rgba(115,1,255,0.20)',
  color: '#7301FF',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
};
