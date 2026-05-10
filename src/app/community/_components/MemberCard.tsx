import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export type MemberCardData = {
  id: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerColor: string;
  isFounder: boolean;
  isCoreTeam: boolean;
  isModerator: boolean;
  postCount: number;
  commentCount: number;
  reactionsReceivedCount?: number;
  reactionsGivenCount?: number;
  user?: {
    role: 'STUDENT' | 'MENTOR' | 'PARTNER' | 'ADMIN';
  } | null;
};

/**
 * Synthetic XP / level derivation. The schema doesn't ship explicit
 * fields for these (they're not core to the product), so we compute
 * a stable proxy from the denormalised counts the platform already
 * keeps current. Same numbers everywhere → no inconsistency between
 * the directory card and the profile page.
 *
 *   XP = postCount × 50 + commentCount × 10
 *      + reactionsReceivedCount × 5 + reactionsGivenCount × 2
 *   Level = floor(sqrt(XP / 100)) + 1
 *
 * Caps at 99 so the badge stays compact.
 */
function deriveXpLevel(m: MemberCardData): { xp: number; level: number } {
  const xp =
    m.postCount * 50 +
    m.commentCount * 10 +
    (m.reactionsReceivedCount ?? 0) * 5 +
    (m.reactionsGivenCount ?? 0) * 2;
  const level = Math.min(99, Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1));
  return { xp, level };
}

function initialsFor(displayName: string, handle: string): string {
  const cleaned = displayName.trim();
  if (cleaned) {
    const parts = cleaned.split(/\s+/).slice(0, 2);
    const out = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
    if (out) return out;
  }
  return handle.slice(0, 2).toUpperCase();
}

/**
 * Member directory card — centered layout to match the handoff
 * `community-tabs.jsx#Members` design:
 *   - Large gradient avatar circle (initials fallback) on top
 *   - Name + role/sub on the next two lines
 *   - Badge chips wrapping centred
 *   - "Lv. N · X XP" line
 *   - Full-width "Voir le profil" CTA
 *
 * Avatars use the member's `bannerColor` as the gradient seed so the
 * directory has visual variety without exposing yet another colour
 * picker — the field is already populated on every row.
 */
export default async function MemberCard({ member }: { member: MemberCardData }) {
  const t = await getTranslations('community.members');
  const name = member.displayName ?? `@${member.handle}`;
  const role = member.user?.role;
  const accent = member.bannerColor || '#7301FF';
  const { xp, level } = deriveXpLevel(member);

  return (
    <article
      style={{
        padding: 16,
        borderRadius: 14,
        background: '#faf7ff',
        border: '1px solid rgba(115,1,255,0.06)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Avatar — gradient circle with initials, or photo override */}
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatarUrl}
          alt=""
          width={56}
          height={56}
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 4px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid white',
            boxShadow: '0 4px 12px rgba(36,18,80,0.12)',
          }}
        />
      ) : (
        <div
          aria-hidden
          translate="no"
          title={name}
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 4px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 18,
            border: '3px solid white',
            boxShadow: '0 4px 12px rgba(36,18,80,0.12)',
          }}
        >
          {initialsFor(member.displayName ?? '', member.handle)}
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1f3a' }}>{name}</div>
      {role && (
        <div className="dz-small" style={{ fontSize: 11 }}>
          {t(`roleLabels.${role}`)}
        </div>
      )}

      {/* Badge chips — accent-tinted to match the member's bannerColor */}
      {(member.isFounder || member.isCoreTeam || member.isModerator) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginTop: 2,
          }}
        >
          {member.isFounder && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: `${accent}15`,
                color: accent,
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {t('foundersBadge')}
            </span>
          )}
          {member.isCoreTeam && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: 'rgba(115,1,255,0.10)',
                color: '#7301FF',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {t('coreTeamBadge')}
            </span>
          )}
          {member.isModerator && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: 'rgba(244,111,177,0.12)',
                color: '#d94e92',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {t('moderatorBadge')}
            </span>
          )}
        </div>
      )}

      <div
        className="dz-small"
        style={{ marginTop: 4, fontSize: 11, color: '#8b91ad' }}
      >
        Lv. {level} · {xp.toLocaleString('fr-FR')} XP
      </div>

      <Link
        href={`/community/members/${member.handle}`}
        style={{
          marginTop: 4,
          width: '100%',
          padding: '6px 10px',
          borderRadius: 8,
          border: 'none',
          background: 'rgba(115,1,255,0.10)',
          color: '#7301FF',
          fontSize: 11,
          fontWeight: 700,
          textDecoration: 'none',
          textAlign: 'center',
          display: 'block',
        }}
      >
        {t('profileCta')}
      </Link>
    </article>
  );
}
