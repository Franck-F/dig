import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getCommunityViewer } from '../../_components/viewer';
import { getCommunitySettings } from '@/lib/actions/platform-settings';
import { CommunityBoolToggle, CommunityNumberStepper } from './SettingsToggles';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.adminSettingsPage');
  return { title: t('metaTitle') };
}

const MOD_INDICES = ['0', '1', '2'] as const;

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned.slice(0, 2).toUpperCase();
}

/**
 * Community admin governance settings — designed against
 * `community-admin-tabs.jsx#Settings`.
 *
 * 2-col layout:
 *   - Left: "Charte & règles" card with charter publish state, signup
 *     gate toggle, banned-words config, auto-sanctions toggle,
 *     quarantine toggle.
 *   - Right: "Modérateurs" card listing current mods with action
 *     stats + Permissions / + Add CTAs, then a "Confidentialité" card
 *     with public/private toggles + GDPR-on-demand state.
 *
 * Toggles are visual stubs for now — most surface no schema-backed
 * boolean (e.g. "indexation moteurs de recherche", "quarantaine 7 j").
 * Wire-up lands in a dedicated follow-up.
 */
export default async function CommunityAdminSettingsPage() {
  // Defense-in-depth — layout already gates moderators + 2FA but we
  // assert again for direct nav.
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const t = await getTranslations('community.admin.adminSettingsPage');
  const settings = await getCommunitySettings();

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
        <p className="dz-body" style={{ marginTop: 6 }}>
          {t('subtitle')}
        </p>
      </div>

      <div
        className="dz-comm-settings-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 18,
        }}
      >
        {/* Charter & rules */}
        <section className="dz-card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
            {t('charterCard.title')}
          </h2>
          <SettingRow
            label={t('charterCard.charter')}
            meta={
              settings.charterPublishedAt
                ? `${settings.charterVersion} · publiée le ${settings.charterPublishedAt
                    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`
                : `${settings.charterVersion} · pas encore publiée`
            }
            cta={t('charterCard.editCta')}
          />
          <SettingRow
            label={t('charterCard.applicationGate')}
            meta={t('charterCard.applicationGateMeta')}
            customRight={
              <CommunityBoolToggle
                field="requireCharterAccept"
                initialOn={settings.requireCharterAccept}
              />
            }
          />
          <SettingRow
            label={t('charterCard.blockedWords')}
            meta={
              settings.bannedWords
                ? `${settings.bannedWords.split(/\s*,\s*|\n/).filter(Boolean).length} mots · règles actives`
                : 'Aucun mot configuré'
            }
            cta={t('charterCard.configureCta')}
          />
          <SettingRow
            label={t('charterCard.autoSanctions')}
            meta={
              settings.autoSanctionThreshold > 0
                ? `${settings.autoSanctionThreshold} avertissements = suspension 7 j`
                : 'Désactivées'
            }
            customRight={
              <CommunityNumberStepper
                field="autoSanctionThreshold"
                initialValue={settings.autoSanctionThreshold}
                min={0}
                max={20}
                unit="avert."
              />
            }
          />
          <SettingRow
            label={t('charterCard.quarantine')}
            meta={
              settings.quarantineDays > 0
                ? `${settings.quarantineDays} premiers jours`
                : 'Désactivée'
            }
            customRight={
              <CommunityNumberStepper
                field="quarantineDays"
                initialValue={settings.quarantineDays}
                min={0}
                max={60}
                unit="j"
              />
            }
            isLast
          />
        </section>

        {/* Moderators + Privacy stacked on the right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section className="dz-card" style={{ padding: 22 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
              {t('moderatorsCard.title')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MOD_INDICES.map((i, idx) => {
                const name = t(`moderatorsCard.items.${i}.name`);
                const meta = t(`moderatorsCard.items.${i}.meta`);
                const palette = ['#7301FF', '#A34BF5', '#F46FB1'];
                const accent = palette[idx];
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
                        {meta}
                      </div>
                    </div>
                    <button type="button" style={ghostBtn}>
                      {t('moderatorsCard.permissions')}
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
              {t('moderatorsCard.addCta')}
            </button>
          </section>

          <section className="dz-card" style={{ padding: 22 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
              {t('privacyCard.title')}
            </h2>
            <SettingRow
              label={t('privacyCard.openToVisitors')}
              meta={t('privacyCard.openToVisitorsMeta')}
              customRight={
                <CommunityBoolToggle
                  field="openToVisitors"
                  initialOn={settings.openToVisitors}
                />
              }
            />
            <SettingRow
              label={t('privacyCard.noIndex')}
              meta={t('privacyCard.noIndex')}
              customRight={
                <CommunityBoolToggle field="noIndex" initialOn={settings.noIndex} />
              }
              metaHidden
            />
            <SettingRow
              label={t('privacyCard.rgpd')}
              meta={t('privacyCard.rgpdMeta')}
              toggle
              on
              isLast
            />
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dz-comm-settings-grid { grid-template-columns: 1fr !important; }
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

function SettingRow({
  label,
  meta,
  cta,
  toggle = false,
  on = false,
  isLast = false,
  metaHidden = false,
  customRight,
}: {
  label: string;
  meta: string;
  cta?: string;
  toggle?: boolean;
  on?: boolean;
  isLast?: boolean;
  /** Skip rendering the meta line (used when label/meta are the same). */
  metaHidden?: boolean;
  /** Slot for a fully-custom right-hand control (e.g. a wired toggle
   *  or numeric stepper client island). When supplied it wins over
   *  `cta` and the static `toggle` block. */
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
        {!metaHidden && (
          <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
            {meta}
          </div>
        )}
      </div>
      {customRight ? (
        customRight
      ) : toggle ? (
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
            }}
          />
        </span>
      ) : (
        cta && (
          <button type="button" style={ghostBtn}>
            {cta}
          </button>
        )
      )}
    </div>
  );
}
