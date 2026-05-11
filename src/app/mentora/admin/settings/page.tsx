import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getMentoratProgrammeSettings } from '@/lib/actions/platform-settings';
import { MentoratBoolToggle } from './SettingsToggles';

export const dynamic = 'force-dynamic';

const TEAM_INDICES = ['0', '1', '2'] as const;
const INTEGRATION_KEYS = [
  'calendar',
  'slack',
  'zoom',
  'stripe',
  'notion',
  'mailjet',
  'hubspot',
  'looker',
] as const;

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned.slice(0, 2).toUpperCase();
}

/**
 * Programme settings — designed against `mentora-admin-tabs.jsx#Settings`.
 *
 * Two-column layout grouping the four canonical admin concerns:
 *   - Programme: cycle config, capacity, matching criteria, application window
 *   - Équipe Digizelle: list of admins with permission stubs + invite
 *   - Communications & marque: email templates, brand kit, onboarding tweaks
 *   - Sécurité & RGPD: mandatory 2FA, SSO, retention, audit log, RGPD export
 *
 * Bottom row: 8-tile integrations grid (Calendar / Slack / Zoom / Stripe /
 * Notion / Mailjet / HubSpot / Looker) with a soft gradient background.
 *
 * Most controls are visual stubs for now (no schema-backed switches
 * for things like "matching weights" or "data retention years"). The
 * affordances are wired but their handlers will land in a future pass.
 */
export default async function MentoratAdminSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/mentora/admin/settings');

  const me = await prisma.user
    .findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    .catch(() => null);
  if (me?.role !== 'ADMIN') redirect('/mentora/admin');

  const t = await getTranslations('mentora.dashboard.adminSettingsPage');
  const settings = await getMentoratProgrammeSettings();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: '#7301FF',
          }}
        >
          {t('kicker')}
        </span>
        <h1 className="dz-h2" style={{ fontSize: 26, margin: '6px 0 0' }}>
          {t('title')}
        </h1>
      </div>

      {/* 2-col grid of cards */}
      <div
        className="dz-admin-settings-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 18,
        }}
      >
        {/* PROGRAMME */}
        <section className="dz-card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
            {t('programme.title')}
          </h2>
          <SettingRow
            label={t('programme.activeCycle')}
            meta={t('programme.activeCycleMeta')}
            cta={t('programme.configureCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('programme.nextCycle')}
            meta={t('programme.nextCycleMeta')}
            cta={t('programme.prepareCta')}
            ctaTone="primary"
          />
          <SettingRow
            label={t('programme.capacity')}
            meta={`Min ${settings.capacityMin} · Max ${settings.capacityMax} binômes`}
            cta={t('programme.adjustCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('programme.matchingCriteria')}
            meta={t('programme.matchingCriteriaMeta')}
            cta={t('programme.editCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('programme.applicationPeriod')}
            meta={t('programme.applicationPeriodMeta')}
            toggle
            on
            isLast
          />
        </section>

        {/* TEAM */}
        <section className="dz-card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
            {t('team.title')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TEAM_INDICES.map((i, idx) => {
              const name = t(`team.members.${i}.name`);
              const role = t(`team.members.${i}.role`);
              const palette = ['#7301FF', '#A34BF5', '#F46FB1'];
              const accent = palette[idx % palette.length];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    aria-hidden
                    translate="no"
                    title={name}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                      color: 'white',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {initialsFor(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                      {name}
                    </div>
                    <div className="dz-small" style={{ fontSize: 11 }}>
                      {role}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={ghostBtn}
                  >
                    {t('team.permissions')}
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            style={{
              width: '100%',
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px dashed rgba(115,1,255,0.30)',
              background: 'transparent',
              color: '#7301FF',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('team.inviteCta')}
          </button>
        </section>

        {/* COMMS & BRAND */}
        <section className="dz-card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
            {t('comms.title')}
          </h2>
          <SettingRow
            label={t('comms.templates')}
            meta={t('comms.templatesMeta')}
            cta={t('comms.manageCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('comms.brand')}
            meta={t('comms.brandMeta')}
            cta={t('comms.viewCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('comms.menteeOnboarding')}
            meta={t('comms.menteeOnboardingMeta')}
            cta={t('comms.customizeCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('comms.mentorOnboarding')}
            meta={t('comms.mentorOnboardingMeta')}
            cta={t('comms.customizeCta')}
            ctaTone="ghost"
            isLast
          />
        </section>

        {/* SECURITY */}
        <section className="dz-card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
            {t('security.title')}
          </h2>
          <SettingRow
            label={t('security.twoFa')}
            meta={t('security.twoFaMeta')}
            customRight={
              <MentoratBoolToggle
                field="require2faAdmin"
                initialOn={settings.require2faAdmin}
              />
            }
          />
          <SettingRow label={t('security.sso')} meta={t('security.ssoMeta')} toggle on />
          <SettingRow
            label={t('security.retention')}
            meta={t('security.retentionMeta')}
            cta={t('security.modifyCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('security.auditLog')}
            meta={t('security.auditLogMeta')}
            cta={t('security.consultCta')}
            ctaTone="ghost"
          />
          <SettingRow
            label={t('security.rgpdExport')}
            meta={t('security.rgpdExportMeta')}
            toggle
            on
            isLast
          />
        </section>
      </div>

      {/* INTEGRATIONS */}
      <section
        style={{
          background:
            'linear-gradient(135deg, rgba(115,1,255,0.06), rgba(244,111,177,0.04))',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 18,
          padding: 22,
        }}
      >
        <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
          {t('integrations.title')}
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {INTEGRATION_KEYS.map((k) => {
            const letter = t(`integrations.items.${k}.letter`);
            const name = t(`integrations.items.${k}.name`);
            const meta = t(`integrations.items.${k}.meta`);
            const onRaw = t(`integrations.items.${k}.on`);
            const isOn = onRaw === 'true';
            return (
              <div
                key={k}
                className="dz-card"
                style={{
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: '#faf7ff',
                    border: '1px solid rgba(115,1,255,0.10)',
                    color: '#7301FF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {letter}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>
                    {name}
                  </div>
                  <div className="dz-small" style={{ fontSize: 11 }}>
                    {meta}
                  </div>
                </div>
                <ToggleVisual on={isOn} />
              </div>
            );
          })}
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .dz-admin-settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(115,1,255,0.20)',
  background: 'transparent',
  color: '#7301FF',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const primaryBtn: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
  color: 'white',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

/** Single setting row — label + meta on the left, optional CTA or
 *  toggle on the right. Adds a hairline border below unless `isLast`. */
function SettingRow({
  label,
  meta,
  cta,
  ctaTone = 'ghost',
  toggle = false,
  on = false,
  isLast = false,
  customRight,
}: {
  label: string;
  meta: string;
  cta?: string;
  ctaTone?: 'ghost' | 'primary';
  toggle?: boolean;
  on?: boolean;
  isLast?: boolean;
  /** Slot for a wired client-side control (toggle, stepper). When set
   *  it wins over `cta` and the static `toggle` block. */
  customRight?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(115,1,255,0.06)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>{label}</div>
        <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
          {meta}
        </div>
      </div>
      {customRight ? (
        customRight
      ) : toggle ? (
        <ToggleVisual on={on} />
      ) : (
        cta && (
          <button type="button" style={ctaTone === 'primary' ? primaryBtn : ghostBtn}>
            {cta}
          </button>
        )
      )}
    </div>
  );
}

/** Visual-only toggle — no client wiring yet (the underlying schema
 *  fields don't exist for most of these). Renders a small green/grey
 *  pill so the design intent is preserved. */
function ToggleVisual({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: on ? '#23c55e' : 'rgba(115,1,255,0.15)',
        position: 'relative',
        flexShrink: 0,
        display: 'inline-block',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 150ms ease',
        }}
      />
    </span>
  );
}
