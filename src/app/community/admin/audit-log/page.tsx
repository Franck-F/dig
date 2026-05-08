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

const dateFmtFull = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateFmtShort = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "il y a 3 min" / "il y a 2 h" / "hier 14:32" / "08 mai · 14:32" */
function relative(d: Date, now: Date): string {
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172_800) return `hier ${dateFmtShort.format(d).split('·').pop()?.trim() ?? ''}`;
  return dateFmtShort.format(d);
}

/** Map action namespace → palette so each chip reads at a glance. */
function paletteFor(action: string): { fg: string; bg: string; border: string; label: string } {
  const ns = action.split('.')[0] ?? '';
  switch (ns) {
    case 'mentor':
    case 'cycle':
      return { fg: '#7301FF', bg: 'rgba(115,1,255,0.10)', border: 'rgba(115,1,255,0.25)', label: 'Mentora' };
    case 'community':
    case 'post':
    case 'comment':
    case 'channel':
    case 'badge':
    case 'flag':
    case 'mention':
      return { fg: '#d94e92', bg: 'rgba(244,111,177,0.12)', border: 'rgba(244,111,177,0.30)', label: 'Communauté' };
    case 'account':
    case 'user':
    case 'session':
      return { fg: '#3B7BFF', bg: 'rgba(59,123,255,0.12)', border: 'rgba(59,123,255,0.28)', label: 'Compte' };
    case 'mentorship':
    case 'review':
      return { fg: '#A34BF5', bg: 'rgba(163,75,245,0.12)', border: 'rgba(163,75,245,0.28)', label: 'Mentorship' };
    case 'newsletter':
    case 'email':
      return { fg: '#0e9b6f', bg: 'rgba(35,197,94,0.12)', border: 'rgba(35,197,94,0.28)', label: 'Communication' };
    case 'reports':
      return { fg: '#1a1f3a', bg: 'rgba(36,50,95,0.10)', border: 'rgba(36,50,95,0.20)', label: 'Rapports' };
    case 'rgpd':
      return { fg: '#9a4cff', bg: 'rgba(154,76,255,0.10)', border: 'rgba(154,76,255,0.25)', label: 'RGPD' };
    default:
      return { fg: '#545b7a', bg: 'rgba(36,50,95,0.06)', border: 'rgba(36,50,95,0.15)', label: 'Système' };
  }
}

function initialsFor(name: string | null, email: string): string {
  const source = (name ?? email).trim();
  if (!source) return '?';
  const parts = source.split(/\s+|@|\./).filter(Boolean).slice(0, 2);
  const out = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return out || source[0]!.toUpperCase();
}

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
  const hasActiveFilter = Boolean(sp.actor || sp.action || sp.target || sp.before);

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

  // Quick KPIs — keep cheap (count + groupBy on AuditLog).
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [totalWeek, latest, distinctActorsRaw] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.auditLog.groupBy({
      by: ['actorUserId'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { _all: true },
    }),
  ]);
  const distinctActors = distinctActorsRaw.length;

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

  const now = new Date();
  const fmtNum = new Intl.NumberFormat('fr-FR');

  // Active filter chips — built before render so we can reuse the URL builder.
  const activeChips: Array<{ key: keyof Search; label: string; value: string }> = [];
  if (sp.actor) activeChips.push({ key: 'actor', label: 'Acteur', value: sp.actor });
  if (sp.action) activeChips.push({ key: 'action', label: 'Action', value: sp.action });
  if (sp.target) activeChips.push({ key: 'target', label: 'Cible', value: sp.target });
  if (sp.before) activeChips.push({ key: 'before', label: 'Avant', value: dateFmtShort.format(new Date(sp.before)) });

  /** Strip a single key from the current search and return the URL. */
  function withoutChip(key: keyof Search): string {
    const next: Record<string, string> = {};
    if (sp.actor && key !== 'actor') next.actor = sp.actor;
    if (sp.action && key !== 'action') next.action = sp.action;
    if (sp.target && key !== 'target') next.target = sp.target;
    if (sp.before && key !== 'before') next.before = sp.before;
    const qs = new URLSearchParams(next).toString();
    return qs ? `/community/admin/audit-log?${qs}` : '/community/admin/audit-log';
  }

  return (
    <div className="dz-audit" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Hero with KPIs ─────────────────────────────────────────── */}
      <header
        style={{
          background:
            'linear-gradient(135deg, rgba(115,1,255,0.10) 0%, rgba(244,111,177,0.10) 60%, rgba(94,160,255,0.06) 100%)',
          border: '1px solid rgba(115,1,255,0.18)',
          borderRadius: 22,
          padding: '24px 28px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(115,1,255,0.18), transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#7301FF',
              marginBottom: 8,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(115,1,255,0.10)',
              border: '1px solid rgba(115,1,255,0.20)',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7301FF' }} />
            Communauté · Administration
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1a1f3a', letterSpacing: '-0.01em' }}>
            Journal admin
          </h1>
          <p style={{ margin: '6px 0 18px', fontSize: 13, color: '#545b7a', maxWidth: 640 }}>
            Trace immuable de toutes les actions administrateurs : approbations mentor, défis, modération,
            badges, newsletters, exports RGPD. Chaque entrée est horodatée, attribuée et conservée.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            <KpiTile label="Entrées · 7 derniers jours" value={fmtNum.format(totalWeek)} accent="#7301FF" />
            <KpiTile label="Acteurs distincts · 7j" value={fmtNum.format(distinctActors)} accent="#F46FB1" />
            <KpiTile
              label="Dernière activité"
              value={latest ? relative(latest.createdAt, now) : '—'}
              accent="#3B7BFF"
            />
          </div>
        </div>
      </header>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <form
        action="/community/admin/audit-log"
        method="get"
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 16,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1f3a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Filtres
          </div>
          {hasActiveFilter && (
            <Link
              href="/community/admin/audit-log"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#7301FF',
                textDecoration: 'none',
              }}
            >
              ✕ Réinitialiser
            </Link>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 10,
            alignItems: 'stretch',
          }}
        >
          <FilterField
            name="actor"
            placeholder="ex. admin@digizelle.fr"
            label="Email acteur (3+ car.)"
            defaultValue={sp.actor ?? ''}
          />
          <FilterField
            name="action"
            placeholder="ex. mentor.approve"
            label="Verbe d’action (exact)"
            defaultValue={sp.action ?? ''}
          />
          <FilterField
            name="target"
            placeholder="ID exact"
            label="Identifiant cible"
            defaultValue={sp.target ?? ''}
          />
          <button type="submit" style={btnPrimary}>
            <span aria-hidden>⌕</span> Filtrer
          </button>
        </div>
        {activeChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {activeChips.map((c) => (
              <Link
                key={c.key}
                href={withoutChip(c.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(115,1,255,0.08)',
                  border: '1px solid rgba(115,1,255,0.20)',
                  color: '#7301FF',
                  fontSize: 11,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <span style={{ opacity: 0.7 }}>{c.label} :</span>
                <strong style={{ fontWeight: 700 }}>{c.value}</strong>
                <span aria-hidden>✕</span>
              </Link>
            ))}
          </div>
        )}
      </form>

      {/* ── Result list ────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div
          style={{
            background: 'white',
            border: '1px dashed rgba(115,1,255,0.20)',
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
            color: '#545b7a',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.7 }}>◇</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1f3a', marginBottom: 4 }}>
            Aucune entrée pour ce filtre
          </div>
          <div style={{ fontSize: 13 }}>
            Essayez d’élargir la recherche ou{' '}
            <Link href="/community/admin/audit-log" style={{ color: '#7301FF', fontWeight: 600 }}>
              réinitialisez les filtres
            </Link>
            .
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontSize: 11,
              color: '#8b91ad',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '0 4px',
            }}
          >
            {rows.length} entrée{rows.length > 1 ? 's' : ''} affichée{rows.length > 1 ? 's' : ''}
            {rows.length === 100 ? ' (100 max par page)' : ''}
          </div>
          {rows.map((r) => {
            const palette = paletteFor(r.action);
            const initials = initialsFor(r.actor.name, r.actor.email);
            return (
              <article
                key={r.id}
                className="dz-audit__row"
                style={{
                  background: 'white',
                  border: '1px solid rgba(115,1,255,0.10)',
                  borderRadius: 14,
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 220px) minmax(0, 1fr) auto',
                  gap: 18,
                  alignItems: 'start',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Actor + timestamp column */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                  <div
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#1a1f3a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={r.actor.name ?? r.actor.email}
                    >
                      {r.actor.name ?? r.actor.email.split('@')[0]}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#8b91ad',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={r.actor.email}
                    >
                      {r.actor.email}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: '#545b7a',
                        fontWeight: 600,
                      }}
                      title={dateFmtFull.format(r.createdAt)}
                    >
                      {relative(r.createdAt, now)}
                    </div>
                  </div>
                </div>

                {/* Action + target column */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: palette.bg,
                        border: `1px solid ${palette.border}`,
                        color: palette.fg,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <span aria-hidden style={{ width: 5, height: 5, borderRadius: '50%', background: palette.fg }} />
                      {palette.label}
                    </span>
                    <code
                      style={{
                        fontSize: 12,
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        background: 'rgba(36,50,95,0.06)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        color: '#1a1f3a',
                        fontWeight: 600,
                      }}
                    >
                      {r.action}
                    </code>
                  </div>
                  {r.targetType && (
                    <div
                      style={{
                        marginTop: 8,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#8b91ad', fontWeight: 600 }}>Cible :</span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(115,1,255,0.06)',
                          color: '#7301FF',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {r.targetType}
                      </span>
                      {r.targetId && (
                        <Link
                          href={`/community/admin/audit-log?target=${encodeURIComponent(r.targetId)}`}
                          style={{
                            fontSize: 11,
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                            color: '#545b7a',
                            background: 'transparent',
                            padding: '2px 6px',
                            borderRadius: 6,
                            textDecoration: 'none',
                            border: '1px dashed rgba(36,50,95,0.20)',
                            maxWidth: 240,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}
                          title={`Cliquer pour filtrer sur ${r.targetId}`}
                        >
                          {r.targetId}
                        </Link>
                      )}
                    </div>
                  )}
                  {r.payload !== null && (
                    <details className="dz-audit__details" style={{ marginTop: 10 }}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          color: '#7301FF',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          listStyle: 'none',
                        }}
                      >
                        <span aria-hidden style={{ fontSize: 10 }}>▸</span>
                        Voir le payload
                      </summary>
                      <pre
                        style={{
                          margin: '8px 0 0',
                          padding: '12px 14px',
                          background: '#0f0f1f',
                          color: '#e5d4ff',
                          borderRadius: 10,
                          fontSize: 12,
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                          lineHeight: 1.55,
                          overflow: 'auto',
                          maxHeight: 320,
                          whiteSpace: 'pre',
                        }}
                      >
                        {JSON.stringify(r.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>

                {/* IP / metadata column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {r.ip && (
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                        color: '#545b7a',
                        background: 'rgba(36,50,95,0.06)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                      }}
                      title={`IP de l’acteur · ${r.ip}`}
                    >
                      {r.ip}
                    </span>
                  )}
                  {r.userAgent && (
                    <span
                      style={{
                        fontSize: 10,
                        color: '#8b91ad',
                        maxWidth: 180,
                        textAlign: 'right',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={r.userAgent}
                    >
                      {r.userAgent.slice(0, 40)}
                      {r.userAgent.length > 40 ? '…' : ''}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {nextPageHref && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <Link href={nextPageHref} style={btnGhost}>
            Charger les entrées plus anciennes ↓
          </Link>
        </div>
      )}

      {/* Component-scoped styles — hover lift + dark theme overrides. */}
      <style>{`
        .dz-audit__row:hover {
          border-color: rgba(115,1,255,0.30) !important;
          box-shadow: 0 8px 24px rgba(115,1,255,0.08);
        }
        .dz-audit__details > summary::-webkit-details-marker { display: none; }
        .dz-audit__details[open] > summary > span[aria-hidden]:first-child { transform: rotate(90deg); display: inline-block; }
        @media (max-width: 760px) {
          .dz-audit__row {
            grid-template-columns: 1fr !important;
          }
          .dz-audit__row > div:last-child {
            align-items: flex-start !important;
          }
        }
        body.dz-theme-dark .dz-audit__row {
          background: rgba(28,18,60,0.65) !important;
          border-color: rgba(255,255,255,0.10) !important;
          color: #e5d4ff;
        }
        body.dz-theme-dark .dz-audit__row code {
          background: rgba(255,255,255,0.08) !important;
          color: #e5d4ff !important;
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function KpiTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: 'white',
        border: `1px solid ${accent}33`,
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
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
          background: accent,
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#545b7a',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          paddingLeft: 8,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, color: '#1a1f3a', paddingLeft: 8, letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </div>
  );
}

function FilterField({
  name,
  placeholder,
  label,
  defaultValue,
}: {
  name: string;
  placeholder: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#545b7a', fontWeight: 600 }}>{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid rgba(115,1,255,0.18)',
          background: 'white',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          color: '#1a1f3a',
        }}
      />
    </label>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
  color: 'white',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  alignSelf: 'flex-end',
  height: 42,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

const btnGhost: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 18px',
  borderRadius: 10,
  border: '1px solid rgba(115,1,255,0.20)',
  color: '#7301FF',
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
  background: 'rgba(115,1,255,0.04)',
};
