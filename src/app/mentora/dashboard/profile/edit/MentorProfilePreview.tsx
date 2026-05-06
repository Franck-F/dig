import { getTranslations } from 'next-intl/server';

type Props = {
  headline: string;
  bio: string;
  yearsExperience: number;
  hourlyRate: number | null; // cents
  timezone: string;
  location: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  languages: string[];
  featuredSkills: string[];
  avgRating: number | null;
  reviewCount: number;
};

/**
 * Read-only preview of the mentor profile, mirroring how it appears on the
 * public `/mentora/[slug]` page. Updates only on full page reload (post-save).
 */
export default async function MentorProfilePreview({
  headline,
  bio,
  yearsExperience,
  hourlyRate,
  timezone,
  location,
  photoUrl,
  linkedinUrl,
  languages,
  featuredSkills,
  avgRating,
  reviewCount,
}: Props) {
  const t = await getTranslations('mentora.profileEdit.preview');

  const initials = headline
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'M';

  return (
    <div className="dz-glass-strong" style={{ padding: 22, borderRadius: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            width={64}
            height={64}
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#7301FF,#A34BF5)',
              color: 'white',
              fontWeight: 700,
              fontSize: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
            {headline || t('headlinePlaceholder')}
          </div>
          <div className="dz-small" style={{ marginTop: 2 }}>
            {[location, timezone].filter(Boolean).join(' · ') || timezone}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
        {featuredSkills.length > 0 ? (
          featuredSkills.map((s) => (
            <span key={s} className="dz-chip" style={{ fontSize: 11 }}>
              {s}
            </span>
          ))
        ) : (
          <span className="dz-small">{t('skillsPlaceholder')}</span>
        )}
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', marginTop: 14 }}>
        {bio.length > 280 ? `${bio.slice(0, 280)}…` : bio || t('bioPlaceholder')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div>
          <div className="dz-small">{t('experienceLabel')}</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {t('experienceValue', { years: yearsExperience })}
          </div>
        </div>
        <div>
          <div className="dz-small">{t('rateLabel')}</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {hourlyRate == null ? t('rateFree') : t('rateValue', { euros: Math.round(hourlyRate / 100) })}
          </div>
        </div>
        <div>
          <div className="dz-small">{t('languagesLabel')}</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {languages.length > 0 ? languages.map((l) => l.toUpperCase()).join(' · ') : '—'}
          </div>
        </div>
        <div>
          <div className="dz-small">{t('ratingLabel')}</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {avgRating == null
              ? t('ratingNone')
              : `${avgRating.toFixed(1)}★ (${reviewCount})`}
          </div>
        </div>
      </div>

      {linkedinUrl && (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="dz-small"
          style={{ display: 'inline-block', marginTop: 12, color: 'var(--brand-violet, #7301FF)', fontWeight: 600 }}
        >
          {t('linkedinCta')} →
        </a>
      )}
    </div>
  );
}
