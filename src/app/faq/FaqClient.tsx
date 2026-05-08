'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Client-side search/filter for the FAQ. The page renders ALL questions
 * server-side so SEO + JSON-LD see the full content; this island layers
 * a fast in-memory filter on top with a debounced query and an
 * "X results found" affordance.
 *
 * Design choices:
 *  - `useDeferredValue` lets React keep the input responsive while the
 *    filter recomputes on slow-ish lists (~30+ items here).
 *  - Filter is case- + accent-insensitive (NFD-normalise + strip combining
 *    diacritics) so "mentor" matches "ménTOR" and the like.
 *  - We don't duplicate content in JS — server-rendered <details> carry
 *    a `data-faq-search` attribute with their pre-built haystack text.
 *    The client only toggles a `--faq-hidden` class on each.
 *  - All DOM work runs in `useEffect` so render stays pure (React 19
 *    enforces this on Strict Mode double-invocations).
 */

function normalise(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export default function FaqClient() {
  const t = useTranslations('faqPage.search');
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const trimmed = deferred.trim();
  const [matchCount, setMatchCount] = useState<number | null>(null);

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('[data-faq-search]');
    const categories = document.querySelectorAll<HTMLElement>('[data-faq-category]');

    if (trimmed.length < 2) {
      // Reset visibility — show everything.
      items.forEach((el) => el.classList.remove('--faq-hidden'));
      categories.forEach((cat) => cat.classList.remove('--faq-hidden'));
      setMatchCount(null);
      return;
    }

    const needle = normalise(trimmed);
    let visibleCount = 0;
    items.forEach((el) => {
      const haystack = normalise(el.dataset.faqSearch ?? '');
      const visible = haystack.includes(needle);
      el.classList.toggle('--faq-hidden', !visible);
      if (visible) visibleCount += 1;
    });
    // Collapse categories whose every child is hidden.
    categories.forEach((cat) => {
      const stillVisible = cat.querySelectorAll<HTMLElement>(
        '[data-faq-search]:not(.--faq-hidden)',
      );
      cat.classList.toggle('--faq-hidden', stillVisible.length === 0);
    });
    setMatchCount(visibleCount);
  }, [trimmed]);

  return (
    <div style={{ marginBottom: 32 }}>
      <label
        htmlFor="dz-faq-search"
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: '#7301FF',
          marginBottom: 8,
        }}
      >
        {t('label')}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id="dz-faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          /* No inline `background` / `color` so the global form-control
             rules in design-system.css can flip the input to a dark
             surface in dark theme. Inline values would have higher
             specificity and stay white. */
          style={{
            width: '100%',
            padding: '14px 44px 14px 18px',
            borderRadius: 12,
            border: '1px solid rgba(115,1,255,0.20)',
            fontSize: 15,
            fontFamily: 'inherit',
          }}
          aria-describedby={matchCount !== null ? 'dz-faq-match-count' : undefined}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clear')}
            title={t('clear')}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(115,1,255,0.10)',
              color: '#7301FF',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            ×
          </button>
        )}
      </div>
      {matchCount !== null && (
        <p
          id="dz-faq-match-count"
          aria-live="polite"
          style={{ fontSize: 12, color: '#7301FF', fontWeight: 600, marginTop: 8 }}
        >
          {t('matchCount', { count: matchCount })}
          {matchCount === 0 && (
            <span style={{ color: '#8b91ad', fontWeight: 400, marginLeft: 6 }}>
              · {t('noResults', { query: trimmed })}
            </span>
          )}
        </p>
      )}

      {/* Scoped: only affects FAQ markers — no global pollution. */}
      <style>{`
        [data-faq-search].--faq-hidden { display: none; }
        [data-faq-category].--faq-hidden { display: none; }
      `}</style>
    </div>
  );
}
