import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/** Left-column profile card: identity, completion bar, intro, edit CTA. */
export default async function ProfileSummaryCard({
  name,
  location,
  photoUrl,
  completion,
  intro,
  isAvailable,
}: {
  name: string;
  location: string | null;
  photoUrl: string | null;
  completion: number;
  intro: string | null;
  /** Mentors only — mentees have no capacity notion. */
  isAvailable?: boolean;
}) {
  const [t, tBadges] = await Promise.all([
    getTranslations('mentora.dashboard.home'),
    getTranslations('mentora.badges'),
  ]);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="dz-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={64}
            height={64}
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              flexShrink: 0,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #7301FF, #A34BF5)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {initials || '?'}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{name}</div>
          {location && <div className="dz-small">{location}</div>}
          {typeof isAvailable === 'boolean' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 6,
                padding: '2px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: isAvailable ? 'rgba(22,163,74,0.12)' : 'rgba(100,116,139,0.14)',
                color: isAvailable ? '#15803D' : '#475569',
              }}
            >
              <span
                aria-hidden
                style={{ width: 7, height: 7, borderRadius: '50%', background: isAvailable ? '#16A34A' : '#94A3B8' }}
              />
              {isAvailable ? tBadges('available') : tBadges('full')}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="dz-small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>{t('profileCompletion')}</span>
          <span style={{ fontWeight: 700 }}>{completion} %</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completion}
          aria-label={t('profileCompletion')}
          style={{ height: 6, borderRadius: 999, background: 'rgba(115,1,255,0.10)', overflow: 'hidden' }}
        >
          <div style={{ width: `${completion}%`, height: '100%', background: '#16A34A', borderRadius: 999 }} />
        </div>
      </div>

      {intro && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t('presentation')}</div>
          <p
            className="dz-small"
            style={{
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {intro}
          </p>
        </div>
      )}

      <Link
        href="/mentora/dashboard/profile/edit"
        className={`dz-btn dz-btn-sm ${completion < 100 ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
        style={{ alignSelf: 'center' }}
      >
        {t('complete')}
      </Link>
    </section>
  );
}
