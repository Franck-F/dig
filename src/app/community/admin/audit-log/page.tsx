import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { listAuditLog } from '@/lib/audit/log';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Journal admin · Communauté' };

type Search = {
  actor?: string;
  action?: string;
  target?: string;
  before?: string;
};

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Read-only viewer of the AuditLog table. Higher gate than the rest of
 * `/community/admin/*` — the audit trail names every admin and what they
 * touched, so we restrict it to UserRole = ADMIN (the surrounding layout
 * already checks `isModerator`, which is wider).
 *
 * Filters supported via query string:
 *   ?actor=email   — match by actor email substring
 *   ?action=name   — exact action key e.g. `challenge.publish`
 *   ?target=id     — match a single target id
 *   ?before=ISO    — fetch the page older than this timestamp
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/community/admin/audit-log');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (me?.role !== 'ADMIN') redirect('/community');

  const sp = await searchParams;

  // Resolve actor email substring → list of userIds, then filter by exact id.
  let actorUserId: string | undefined;
  if (sp.actor && sp.actor.length >= 3) {
    const match = await prisma.user.findFirst({
      where: { email: { contains: sp.actor.toLowerCase(), mode: 'insensitive' } },
      select: { id: true },
    });
    actorUserId = match?.id ?? '__no_match__';
  }

  const beforeDate = sp.before ? new Date(sp.before) : undefined;
  const rows =
    actorUserId === '__no_match__'
      ? []
      : await listAuditLog({
          limit: 100,
          actorUserId,
          action: sp.action || undefined,
          targetId: sp.target || undefined,
          before: beforeDate,
        });

  const oldest = rows.at(-1)?.createdAt;
  const nextPageHref =
    rows.length === 100 && oldest
      ? `/community/admin/audit-log?${new URLSearchParams({
          ...(sp.actor ? { actor: sp.actor } : {}),
          ...(sp.action ? { action: sp.action } : {}),
          ...(sp.target ? { target: sp.target } : {}),
          before: oldest.toISOString(),
        }).toString()}`
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
          Communauté · Administration
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1a1f3a' }}>
          Journal admin
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#545b7a' }}>
          Trace immuable des actions administrateurs : approbations mentor, défis, modération, badges, newsletters.
        </p>
      </div>

      {/* Filters — plain GET form, no client JS needed */}
      <form
        action="/community/admin/audit-log"
        method="get"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto',
          gap: 10,
          padding: 16,
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 14,
        }}
      >
        <input
          name="actor"
          defaultValue={sp.actor ?? ''}
          placeholder="Email actor (3+ chars)"
          aria-label="Filtrer par email actor"
          style={inputStyle}
        />
        <input
          name="action"
          defaultValue={sp.action ?? ''}
          placeholder="action.verb (ex. mentor.approve)"
          aria-label="Filtrer par action"
          style={inputStyle}
        />
        <input
          name="target"
          defaultValue={sp.target ?? ''}
          placeholder="Target id"
          aria-label="Filtrer par target id"
          style={inputStyle}
        />
        <button type="submit" style={btnStyle}>
          Filtrer
        </button>
      </form>

      <div
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#8b91ad' }}>
            Aucune entrée pour ce filtre.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(115,1,255,0.04)' }}>
                <th style={th}>Quand</th>
                <th style={th}>Acteur</th>
                <th style={th}>Action</th>
                <th style={th}>Cible</th>
                <th style={th}>Détails</th>
                <th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(115,1,255,0.06)' }}>
                  <td style={td}>
                    <div style={{ whiteSpace: 'nowrap' }}>{dateFmt.format(r.createdAt)}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.actor.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#8b91ad' }}>{r.actor.email}</div>
                  </td>
                  <td style={td}>
                    <code style={codeStyle}>{r.action}</code>
                  </td>
                  <td style={td}>
                    {r.targetType ? (
                      <div>
                        <div style={{ fontSize: 12, color: '#7301FF' }}>{r.targetType}</div>
                        {r.targetId && (
                          <code style={{ ...codeStyle, fontSize: 10 }}>{r.targetId}</code>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ ...td, maxWidth: 320 }}>
                    {r.payload ? (
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#7301FF', fontSize: 12 }}>
                          Voir
                        </summary>
                        <pre
                          style={{
                            margin: '6px 0 0',
                            padding: 10,
                            background: '#f7f4ff',
                            borderRadius: 8,
                            fontSize: 11,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}
                        >
                          {JSON.stringify(r.payload, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 11, color: '#8b91ad', whiteSpace: 'nowrap' }}>
                    {r.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {nextPageHref && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <Link
            href={nextPageHref}
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(115,1,255,0.20)',
              color: '#7301FF',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Plus ancien →
          </Link>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(115,1,255,0.20)',
  background: 'white',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
  color: 'white',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const th: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#545b7a',
};

const td: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'top',
  color: '#1a1f3a',
};

const codeStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  background: 'rgba(115,1,255,0.06)',
  padding: '2px 6px',
  borderRadius: 4,
  color: '#7301FF',
};
