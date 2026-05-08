import { defineRouting } from 'next-intl/routing';

/**
 * Locale routing config.
 *
 * Locales:
 *   - `fr` — primary, French (default).
 *   - `en` — secondary, English. Phase 2 — only the high-traffic
 *     surfaces (homepage, header/footer, login, charte) are
 *     hand-translated today; every other key falls through to `fr`
 *     via the merge in `request.ts`.
 *
 * `localePrefix: 'never'` keeps URLs locale-free (`/`, `/community`)
 * — the active locale is read from a cookie (`NEXT_LOCALE`) set by
 * `LocaleSwitcher`, with `Accept-Language` as a first-visit fallback.
 * SEO-wise this trades hreflang signals for cleaner URLs; we'll
 * revisit if EN traffic warrants it.
 */
export const routing = defineRouting({
  locales: ['fr', 'en'] as const,
  defaultLocale: 'fr',
  localePrefix: 'never',
});

export type Locale = (typeof routing.locales)[number];
