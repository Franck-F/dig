import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { getCommunitySettings } from '@/lib/actions/platform-settings';

import { getCommunityViewer } from '../../_components/viewer';
import { CommunityBoolToggle, CommunityNumberStepper } from './SettingsToggles';
import CharterEditor from './CharterEditor';
import BannedWordsEditor from './BannedWordsEditor';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.admin.adminSettingsPage');
  return { title: t('metaTitle') };
}

const ACCENT_PALETTE = ['#7301FF', '#A34BF5', '#F46FB1', '#3B7BFF', '#23c55e', '#FFB823'];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[h % ACCENT_PALETTE.length];
}

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || cleaned.slice(0, 2).toUpperCase();
}

/**
 * `/community/admin/settings` — refondu pour matcher le handoff
 * (`community-admin-tabs.jsx#Settings`, "Charte & gouvernance").
 *
 * Trois cartes :
 *  1. **Charte & règles** (gauche) — version publiée éditable via
 *     `CharterEditor` (modal), banned-words via `BannedWordsEditor`,
 *     toggles wirés à `CommunitySettings`.
 *  2. **Modérateurs** (haut droite) — vraie liste pulled from
 *     `CommunityMember.isModerator = true` avec compteur d'actions
 *     du mois (ModerationAction sur 30j). Permissions → lien vers
 *     /community/admin/users/{handle}.
 *  3. **Confidentialité** (bas droite) — toggles openToVisitors /
 *     noIndex + ligne RGPD (lien vers /community/admin/rgpd).
 */
export default async function CommunityAdminSettingsPage() {
  const viewer = await getCommunityViewer();
  if (viewer.kind !== 'member' || !viewer.isModerator) redirect('/community');

  const t = await getTranslations('community.admin.adminSettingsPage');
  const settings = await getCommunitySettings();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Real moderators (CommunityMember.isModerator = true) ordered by
  // recent activity (action count in the last 30d). Limited to 8 so
  // the card stays compact — overflow goes to /community/admin/users
  // with the moderator filter.
  type ModRow = {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    bannerColor: string;
    isFounder: boolean;
    isCoreTeam: boolean;
    actionCount: number;
  };

  const mods = await prisma.communityMember.findMany({
    where: { isModerator: true, status: 'ACTIVE' },
    take: 8,
    orderBy: [{ isFounder: 'desc' }, { isCoreTeam: 'desc' }, { joinedAt: 'asc' }],
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      bannerColor: true,
      isFounder: true,
      isCoreTeam: true,
    },
  });

  // Per-mod 30d action count from ModerationAction (denormalised at
  // request-time so we don't need a join column). Defensive — falls
  // back to 0 if the query fails (table empty pre-seed).
  let actionCounts = new Map<string, number>();
  try {
    const grouped = await prisma.moderationAction.groupBy({
      by: ['actorId'],
      where: { actorId: { in: mods.map((m) => m.id) }, createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    });
    actionCounts = new Map(
      grouped
        .filter((g): g is typeof g & { actorId: string } => Boolean(g.actorId))
        .map((g) => [g.actorId, g._count._all] as const),
    );
  } catch {
    /* leave empty */
  }

  const modRows: ModRow[] = mods.map((m) => ({
    ...m,
    actionCount: actionCounts.get(m.id) ?? 0,
  }));

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
        {/* ── Charter & rules ─────────────────────────────────────── */}
        <section className="dz-card" style={{ padding: 22 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>
            {t('charterCard.title')}
          </h2>
          <p className="dz-small" style={{ margin: '0 0 8px', fontSize: 12 }}>
            Le contrat moral entre membres.
          </p>

          <SettingRow
            label={t('charterCard.charter')}
            meta={
              settings.charterPublishedAt
                ? `${settings.charterVersion} · publiée le ${settings.charterPublishedAt
                    .toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`
                : `${settings.charterVersion} · pas encore publiée`
            }
            customRight={
              <CharterEditor
                initial={{
                  version: settings.charterVersion,
                  publishedAt: settings.charterPublishedAt,
                }}
              />
            }
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
            id="banned-words"
            label={t('charterCard.blockedWords')}
            meta={
              settings.bannedWords
                ? `${
                    new Set(
                      settings.bannedWords
                        .split(/[\n,]/)
                        .map((w) => w.trim().toLowerCase())
                        .filter((w) => w.length > 0 && !w.startsWith('#')),
                    ).size
                  } mots · règles actives`
                : 'Aucun mot configuré'
            }
            customRight={<BannedWordsEditor initial={settings.bannedWords ?? ''} />}
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

        {/* ── Right column: moderators + privacy ──────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Moderators */}
          <section className="dz-card" style={{ padding: 22 }}>
            <h2 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700 }}>
              {t('moderatorsCard.title')}
            </h2>
            {modRows.length === 0 ? (
              <p className="dz-small" style={{ margin: '0 0 14px', fontSize: 12 }}>
                Aucun modérateur·rice désigné·e pour le moment.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {modRows.map((m, idx) => {
                  const name = m.displayName ?? `@${m.handle}`;
                  const accent = m.bannerColor || colorFor(m.handle);
                  const role = m.isFounder
                    ? 'Fondateur·rice'
                    : m.isCoreTeam
                      ? 'Core team'
                      : 'Modo communauté';
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        paddingTop: idx > 0 ? 10 : 0,
                        borderTop: idx > 0 ? '1px solid rgba(115,1,255,0.06)' : 'none',
                      }}
                    >
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatarUrl}
                          alt=""
                          width={36}
                          height={36}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          aria-hidden
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
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
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
                          {name}
                        </div>
                        <div className="dz-small" style={{ fontSize: 11 }}>
                          {role} · {m.actionCount} action{m.actionCount === 1 ? '' : 's'} ce mois
                        </div>
                      </div>
                      <Link
                        href={`/community/admin/users?q=${encodeURIComponent(m.handle)}`}
                        style={ghostBtn}
                      >
                        Permissions
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
            <Link
              href="/community/admin/users?role=moderator"
              style={{
                display: 'block',
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
                textAlign: 'center',
                textDecoration: 'none',
                fontFamily: 'inherit',
              }}
            >
              + Ajouter un·e modérateur·rice
            </Link>
          </section>

          {/* Privacy */}
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
              meta="Bloque les moteurs de recherche sur les routes communauté."
              customRight={
                <CommunityBoolToggle field="noIndex" initialOn={settings.noIndex} />
              }
            />
            <SettingRow
              label={t('privacyCard.rgpd')}
              meta={t('privacyCard.rgpdMeta')}
              customRight={
                <Link href="/community/admin/rgpd" style={ghostBtn}>
                  Registre →
                </Link>
              }
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
  textDecoration: 'none',
  display: 'inline-block',
};

function SettingRow({
  id,
  label,
  meta,
  isLast = false,
  customRight,
}: {
  id?: string;
  label: string;
  meta: string;
  isLast?: boolean;
  customRight: React.ReactNode;
}) {
  return (
    <div
      id={id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: isLast ? 'none' : '1px solid rgba(115,1,255,0.06)',
        scrollMarginTop: 96,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>{label}</div>
        <div className="dz-small" style={{ fontSize: 11, marginTop: 2 }}>
          {meta}
        </div>
      </div>
      {customRight}
    </div>
  );
}
