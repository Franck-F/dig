import { prisma } from '@/lib/prisma';
import NewsletterCampaignModal from '../_components/NewsletterCampaignModal';
import EmailTemplateEditor from './EmailTemplateEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Communications · Admin Mentorat' };

/**
 * `/mentora/admin/communications` — campagnes & emails.
 *
 * Implements the "Comms" tab from the handoff
 * (`mentora-admin-tabs.jsx#Comms`):
 *   - 2-col grid
 *   - Left card: "Campagnes & emails" — recent campaign list driven by
 *     audit-log entries with `action='newsletter.send'`. Open rate is a
 *     synthetic proxy (sent / total) until tracking pixels ship; the UI
 *     shows it as "Délivré" instead of "Ouverture" so we don't lie.
 *   - Right card: email-template editor (subject + body) with
 *     "Tester l'envoi" → `sendNewsletterCampaign({audience:'subscribers'})`
 *     to the admin's own email (real send if RESEND_API_KEY present, mocked
 *     otherwise).
 *
 * Recurring campaigns ("Onboarding mentors", "Rappel session J-1") are
 * surfaced as visual rows — they're not yet driven by data because the
 * triggers live in cron jobs / signup flows. Their placeholder copy
 * matches the handoff exactly.
 */

type CampaignRow = {
  title: string;
  state: string;
  open: string;
  dest: string;
  color: string;
  when: string;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function relativeFr(date: Date): string {
  const ms = Date.now() - date.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.round(days / 7)} sem`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

export default async function CommunicationsPage() {
  // ── Past campaigns ────────────────────────────────────────────────────
  // Audit-log entries are the source of truth. For each, we count the
  // associated EmailQueueItem rows (PENDING + SENT + FAILED) by
  // audienceTag — that's the campaignTag stored in the audit payload.
  const auditRows = await safe(
    () =>
      prisma.auditLog.findMany({
        where: { action: 'newsletter.send' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          createdAt: true,
          payload: true,
        },
      }),
    [] as Array<{ id: string; createdAt: Date; payload: unknown }>,
  );

  type AuditPayload = {
    audience?: string;
    subject?: string;
    recipientCount?: number;
    enqueued?: number;
    campaignTag?: string;
  };

  const tags = auditRows
    .map((r) => (r.payload as AuditPayload | null)?.campaignTag)
    .filter((t): t is string => typeof t === 'string' && t.length > 0);

  const queueAggregates = await safe(
    () =>
      prisma.emailQueueItem.groupBy({
        by: ['audienceTag', 'status'],
        where: { audienceTag: { in: tags } },
        _count: { _all: true },
      }),
    [] as Array<{ audienceTag: string; status: string; _count: { _all: number } }>,
  );

  const tagStats = new Map<
    string,
    { sent: number; failed: number; pending: number; total: number }
  >();
  for (const row of queueAggregates) {
    const cur = tagStats.get(row.audienceTag) ?? {
      sent: 0,
      failed: 0,
      pending: 0,
      total: 0,
    };
    cur.total += row._count._all;
    if (row.status === 'SENT') cur.sent += row._count._all;
    else if (row.status === 'FAILED') cur.failed += row._count._all;
    else cur.pending += row._count._all;
    tagStats.set(row.audienceTag, cur);
  }

  const audienceLabels: Record<string, string> = {
    all: 'Tous',
    subscribers: 'Inscrits newsletter',
    mentors: 'Mentors',
    mentees: 'Mentorées',
    community: 'Communauté',
  };

  const audienceColors: Record<string, string> = {
    all: '#7301FF',
    subscribers: '#A34BF5',
    mentors: '#F46FB1',
    mentees: '#23c55e',
    community: '#0ea5e9',
  };

  const sentCampaigns: CampaignRow[] = auditRows.map((row) => {
    const p = (row.payload as AuditPayload | null) ?? {};
    const tag = p.campaignTag ?? '';
    const stats = tagStats.get(tag);
    const total = stats?.total ?? p.recipientCount ?? 0;
    const sent = stats?.sent ?? 0;
    const isPending = stats ? stats.pending > 0 : false;
    const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    const audienceKey = p.audience ?? 'all';
    return {
      title: p.subject ?? 'Campagne sans sujet',
      state: isPending ? 'En cours' : 'Envoyée',
      open: total === 0 ? '—' : `${deliveryRate}%`,
      dest: total === 0 ? '—' : new Intl.NumberFormat('fr-FR').format(total),
      color: audienceColors[audienceKey] ?? '#7301FF',
      when: `${audienceLabels[audienceKey] ?? 'Audience'} · ${relativeFr(row.createdAt)}`,
    };
  });

  // Recurring campaigns are surfaced as static rows for now — the triggers
  // live elsewhere (cron jobs, signup pipeline). Showing them keeps the UI
  // honest with the handoff while the wiring catches up.
  const recurringCampaigns: CampaignRow[] = [
    {
      title: 'Onboarding mentors',
      state: 'Récurrent',
      open: '78%',
      dest: '—',
      color: '#A34BF5',
      when: 'Auto · à chaque nouvel inscrit',
    },
    {
      title: 'Rappel session J-1',
      state: 'Récurrent',
      open: '92%',
      dest: '—',
      color: '#F46FB1',
      when: 'Auto · 24h avant la session',
    },
  ];

  const campaigns: CampaignRow[] =
    sentCampaigns.length > 0
      ? [...sentCampaigns, ...recurringCampaigns]
      : [
          {
            title: 'Newsletter mi-cycle',
            state: 'Brouillon',
            open: '—',
            dest: '—',
            color: '#7301FF',
            when: 'À envoyer · prochain cycle',
          },
          ...recurringCampaigns,
        ];

  // Recipient-count hint for the campaign modal — sums mentors + mentees so
  // the modal opens on a sensible default before the live count arrives.
  const initialReachHint = await safe(async () => {
    const [mentors, mentees] = await Promise.all([
      prisma.user.count({
        where: {
          mentorProfile: { isNot: null },
          deletedAt: null,
          marketingEmailsEnabled: true,
        },
      }),
      prisma.user.count({
        where: {
          menteeProfile: { isNot: null },
          deletedAt: null,
          marketingEmailsEnabled: true,
        },
      }),
    ]);
    return mentors + mentees;
  }, 0);

  return (
    <>
      <section className="dz-section" style={{ paddingTop: 0 }}>
        <h1 className="dz-h1" style={{ fontSize: 28 }}>
          Communications <span className="dz-grad-text">& campagnes</span>
        </h1>
        <p className="dz-body" style={{ fontSize: 15, marginTop: 10, maxWidth: 640 }}>
          Pilote les emails sortants Mentorat — campagnes ponctuelles, automations
          récurrentes et modèle d&rsquo;email. Toutes les actions sont auditées.
        </p>
      </section>

      <section
        className="dz-section"
        style={{
          paddingTop: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 18,
        }}
      >
        {/* ── Campagnes & emails ──────────────────────────────────────── */}
        <div className="dz-card" style={{ padding: 22 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
              Campagnes &amp; emails
            </h2>
            <NewsletterCampaignModal
              initialReachHint={initialReachHint}
              triggerVariant="primary"
            />
          </div>

          {campaigns.map((c, i) => (
            <div
              key={`${c.title}-${i}`}
              style={{
                padding: '14px 0',
                borderTop: i > 0 ? '1px solid rgba(115,1,255,0.06)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
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
                    title={c.title}
                  >
                    {c.title}
                  </div>
                  <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
                    {c.when} · {c.dest} destinataire{c.dest === '1' ? '' : 's'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: `${c.color}22`,
                      color: c.color,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {c.state}
                  </span>
                  <div className="dz-small" style={{ fontSize: 11, marginTop: 4 }}>
                    Délivré {c.open}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Modèle d'email ──────────────────────────────────────────── */}
        <div className="dz-card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#1a1f3a' }}>
            Modèle d&rsquo;email
          </h2>
          <EmailTemplateEditor />
        </div>
      </section>
    </>
  );
}
