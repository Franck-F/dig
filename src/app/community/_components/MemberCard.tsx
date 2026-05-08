import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import Avatar from './Avatar';

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
  user?: {
    role: 'STUDENT' | 'MENTOR' | 'PARTNER' | 'ADMIN';
  } | null;
};

export default async function MemberCard({ member }: { member: MemberCardData }) {
  const t = await getTranslations('community.members');
  const name = member.displayName ?? `@${member.handle}`;
  const role = member.user?.role;

  return (
    <article
      className="dz-card"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: `linear-gradient(135deg, ${member.bannerColor}, ${member.bannerColor}AA)`,
          opacity: 0.5,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        <Avatar
          size={56}
          src={member.avatarUrl}
          seed={member.handle}
          name={name}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            href={`/community/members/${member.handle}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'block',
              minWidth: 0,
            }}
          >
            {/* Truncate hard: a free-text displayName can be long
                (or a hostile single-word string) and would otherwise
                overflow under the avatar / into the card edge. */}
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
              title={name}
            >
              {name}
            </div>
            <div
              className="dz-small"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              @{member.handle}
            </div>
          </Link>
        </div>
      </div>

      {(member.isFounder || member.isCoreTeam || member.isModerator || role) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {member.isFounder && (
            <span className="dz-chip --pink" style={{ fontSize: 11 }}>{t('foundersBadge')}</span>
          )}
          {member.isCoreTeam && (
            <span className="dz-chip" style={{ fontSize: 11 }}>{t('coreTeamBadge')}</span>
          )}
          {member.isModerator && (
            <span className="dz-chip" style={{ fontSize: 11 }}>{t('moderatorBadge')}</span>
          )}
          {role && (
            <span className="dz-chip" style={{ fontSize: 11 }}>
              {t(`roleLabels.${role}`)}
            </span>
          )}
        </div>
      )}

      {member.bio && (
        <p
          className="dz-body"
          style={{
            margin: 0,
            fontSize: 14,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {member.bio}
        </p>
      )}

      <div className="dz-small" style={{ display: 'flex', gap: 12, opacity: 0.85 }}>
        <span>{t('memberCount', { count: member.postCount })}</span>
        <span>·</span>
        <span>{`${member.commentCount} commentaire${member.commentCount === 1 ? '' : 's'}`}</span>
      </div>

      <Link
        href={`/community/members/${member.handle}`}
        className="dz-btn dz-btn-ghost dz-btn-sm"
        style={{ marginTop: 'auto', textAlign: 'center' }}
      >
        {t('profileCta')}
      </Link>
    </article>
  );
}
