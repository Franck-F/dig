'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

const FORMATS = ['REMOTE', 'IN_PERSON', 'HYBRID'] as const;
type Format = (typeof FORMATS)[number];

const RATINGS: Array<{ value: string; key: string }> = [
  { value: '', key: 'ratingAny' },
  { value: '4', key: 'rating4' },
  { value: '4.5', key: 'rating4_5' },
];

/**
 * Filter sidebar for /mentora/discover. Uses search-params as the source of
 * truth so server-side filtering stays cacheable. Pushes a new URL on Apply,
 * which triggers a server re-render of the parent RSC.
 */
export default function DiscoverFilters() {
  const t = useTranslations('mentora.discover.filters');
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [skills, setSkills] = useState(params.get('skills') ?? '');
  const [language, setLanguage] = useState(params.get('language') ?? '');
  const [format, setFormat] = useState<Format | ''>(
    (params.get('format') as Format) ?? '',
  );
  const [minRating, setMinRating] = useState(params.get('minRating') ?? '');

  const apply = () => {
    const next = new URLSearchParams();
    if (skills.trim()) next.set('skills', skills.trim().toLowerCase());
    if (language.trim()) next.set('language', language.trim().toLowerCase());
    if (format) next.set('format', format);
    if (minRating) next.set('minRating', minRating);
    next.set('page', '1');
    startTransition(() => {
      router.push(`/mentora/discover?${next.toString()}`);
    });
  };

  const reset = () => {
    setSkills('');
    setLanguage('');
    setFormat('');
    setMinRating('');
    startTransition(() => {
      router.push('/mentora/discover');
    });
  };

  return (
    <aside
      className="dz-glass"
      style={{
        padding: 22,
        borderRadius: 18,
        position: 'sticky',
        top: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <h2 className="dz-h3" style={{ fontSize: 18, margin: 0 }}>
        {t('title')}
      </h2>

      <div>
        <label htmlFor="filter-skills" className="dz-label">{t('skills')}</label>
        <input
          id="filter-skills"
          type="text"
          className="dz-input"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder={t('skillsPlaceholder')}
        />
        <div className="dz-small" style={{ fontSize: 11, marginTop: 4 }}>
          {t('skillsHint')}
        </div>
      </div>

      <div>
        <label htmlFor="filter-language" className="dz-label">{t('language')}</label>
        <input
          id="filter-language"
          type="text"
          className="dz-input"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          placeholder={t('languageAny')}
          maxLength={5}
        />
      </div>

      <div>
        <span className="dz-label">{t('format')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button
            type="button"
            onClick={() => setFormat('')}
            className={`dz-btn dz-btn-sm ${format === '' ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
          >
            {t('formatAny')}
          </button>
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`dz-btn dz-btn-sm ${format === f ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
            >
              {t(
                f === 'REMOTE'
                  ? 'formatRemote'
                  : f === 'IN_PERSON'
                    ? 'formatInPerson'
                    : 'formatHybrid',
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="filter-rating" className="dz-label">{t('minRating')}</label>
        <select
          id="filter-rating"
          className="dz-input"
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
        >
          {RATINGS.map((r) => (
            <option key={r.value} value={r.value}>{t(r.key)}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={apply}
          className="dz-btn dz-btn-primary"
          disabled={pending}
          style={{ flex: 2 }}
        >
          {t('apply')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="dz-btn dz-btn-ghost"
          disabled={pending}
          style={{ flex: 1 }}
        >
          {t('reset')}
        </button>
      </div>
    </aside>
  );
}
