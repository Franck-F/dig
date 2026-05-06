'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const POST_INDICES = ['0', '1', '2', '3', '4', '5'] as const;
type PostIdx = (typeof POST_INDICES)[number];

const gradFrom = ['#7301FF', '#A34BF5', '#F46FB1', '#24325F', '#7301FF', '#A34BF5'];
const gradTo = ['#A34BF5', '#F46FB1', '#7301FF', '#A34BF5', '#F46FB1', '#24325F'];

type CategoryFilter = 'all' | 'tech' | 'society' | 'advice' | 'mentora';

const filterMatches: Record<CategoryFilter, (cat: string) => boolean> = {
  all: () => true,
  tech: (c) => /tech/i.test(c) || /coulisse/i.test(c),
  society: (c) => /soci[éeè]t[éeè]/i.test(c),
  advice: (c) => /conseil/i.test(c) || /r[ée]cap/i.test(c),
  mentora: (c) => /mentora/i.test(c),
};

/**
 * Client list — search input, category filter, full-card links.
 * The post catalogue is read entirely from translations.
 */
export default function BlogList() {
  const t = useTranslations('blog');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return POST_INDICES.filter((i) => {
      const title = t(`posts.${i}.title`).toLowerCase();
      const cat = t(`posts.${i}.category`);
      const matchesQuery = !q || title.includes(q);
      const matchesCat = filterMatches[category](cat);
      return matchesQuery && matchesCat;
    });
  }, [query, category, t]);

  const filters: Array<{ key: CategoryFilter; label: string }> = [
    { key: 'all', label: t('filters.all') },
    { key: 'tech', label: t('filters.tech') },
    { key: 'society', label: t('filters.society') },
    { key: 'advice', label: t('filters.advice') },
    { key: 'mentora', label: t('filters.mentora') },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginTop: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="dz-input"
          placeholder={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('search')}
          style={{ maxWidth: 360 }}
        />
        <div className="dz-seg">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={category === f.key ? '--on' : ''}
              onClick={() => setCategory(f.key)}
              aria-pressed={category === f.key ? 'true' : 'false'}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <section className="dz-section" style={{ paddingTop: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {visible.map((idx) => {
            const slug = t(`posts.${idx}.slug`);
            const num = Number(idx);
            return (
              <Link key={idx} href={`/blog/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <article className="dz-card" style={{ padding: 0, overflow: 'hidden', height: '100%' }}>
                  <div style={{ height: 160, background: `linear-gradient(135deg, ${gradFrom[num]}, ${gradTo[num]})`, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.30), transparent 60%)' }} />
                    <span className="dz-chip --white" style={{ position: 'absolute', top: 14, left: 14 }}>{t(`posts.${idx}.category`)}</span>
                  </div>
                  <div style={{ padding: 22 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{t(`posts.${idx}.title`)}</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                      <div className="dz-small">{t(`posts.${idx}.author`)}</div>
                      <div className="dz-small">{t(`posts.${idx}.read`)}</div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
        {visible.length === 0 && (
          <p className="dz-body" style={{ textAlign: 'center', color: '#8b91ad', marginTop: 24 }}>
            —
          </p>
        )}
      </section>
    </>
  );
}

export { POST_INDICES };
export type { PostIdx };
