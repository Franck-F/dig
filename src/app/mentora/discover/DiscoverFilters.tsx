'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

const FORMATS = ['REMOTE', 'IN_PERSON', 'HYBRID'] as const;
type Format = (typeof FORMATS)[number];

const CATEGORIES = ['TECHNICAL', 'SOFT', 'CAREER', 'BUSINESS', 'CREATIVE'] as const;
type Category = (typeof CATEGORIES)[number];

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
  const tCat = useTranslations('mentora.skillCategories');
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [category, setCategory] = useState<Category | ''>(
    (CATEGORIES as readonly string[]).includes(params.get('category') ?? '')
      ? (params.get('category') as Category)
      : '',
  );
  const [reactiveOnly, setReactiveOnly] = useState(params.get('reactive') === '1');
  const [sort, setSort] = useState(params.get('sort') === 'recent' ? 'recent' : 'relevance');
  const [language, setLanguage] = useState(params.get('language') ?? '');
  const [format, setFormat] = useState<Format | ''>(
    (params.get('format') as Format) ?? '',
  );
  const [minRating, setMinRating] = useState(params.get('minRating') ?? '');

  const apply = () => {
    const next = new URLSearchParams();
    const q = params.get('q');
    if (q) next.set('q', q);
    if (category) next.set('category', category);
    if (reactiveOnly) next.set('reactive', '1');
    if (sort === 'recent') next.set('sort', 'recent');
    if (language.trim()) next.set('language', language.trim().toLowerCase());
    if (format) next.set('format', format);
    if (minRating) next.set('minRating', minRating);
    startTransition(() => {
      router.push(`/mentora/discover?${next.toString()}`);
    });
  };

  const reset = () => {
    setCategory('');
    setReactiveOnly(false);
    setSort('relevance');
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
        <label htmlFor="filter-sort" className="dz-label">{t('sort')}</label>
        <select
          id="filter-sort"
          className="dz-input"
          value={sort}
          onChange={(e) => setSort(e.target.value === 'recent' ? 'recent' : 'relevance')}
        >
          <option value="relevance">{t('sortRelevance')}</option>
          <option value="recent">{t('sortRecent')}</option>
        </select>
      </div>

      <div>
        <label htmlFor="filter-category" className="dz-label">{t('category')}</label>
        <select
          id="filter-category"
          className="dz-input"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | '')}
        >
          <option value="">{t('categoryAny')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{tCat(c)}</option>
          ))}
        </select>
      </div>

      <label
        htmlFor="filter-reactive"
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}
      >
        <input
          id="filter-reactive"
          type="checkbox"
          checked={reactiveOnly}
          onChange={(e) => setReactiveOnly(e.target.checked)}
        />
        {t('reactive')}
      </label>

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
