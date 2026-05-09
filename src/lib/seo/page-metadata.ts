import 'server-only';
import type { Metadata } from 'next';

/**
 * Centralised metadata factory for public pages.
 *
 * The root layout sets the global title template, OG defaults and the
 * `metadataBase` (`https://digizelle.fr`). Child pages used to return
 * just `{ title, description }` and inherit everything else, which
 * meant every shared social card pointed at the home image and every
 * canonical fell back to `/`. Two real consequences:
 *
 *  - Sharing /programs on LinkedIn rendered the home OG image.
 *  - Google could see /, /about, /programs, /blog as duplicates of `/`
 *    (same canonical, same OG payload).
 *
 * `pageMetadata({ path, title, description })` solves both by emitting
 * a per-page canonical, openGraph and twitter block. The `path` is the
 * route (e.g. `/programs`) — it's resolved against `metadataBase`
 * automatically, so callers stay declarative.
 *
 * Locale note: the app uses `localePrefix: 'never'` (URLs are
 * locale-free; the active locale is read from a cookie). That trades
 * proper hreflang for cleaner URLs by design — see the comment in
 * `src/i18n/routing.ts`. We still emit a `Content-Language` hint via
 * the `<html lang>` attribute on the root layout, which is the
 * strongest signal we can give without changing the URL strategy.
 */

const SITE_URL = 'https://digizelle.fr';

export type PageMetadataInput = {
  /** Route path, leading slash, no trailing slash. e.g. `/about`. Use `/` for home. */
  path: string;
  /** Page title (the title template `%s · Digizelle` is applied automatically). */
  title: string;
  /** Page description (used for meta description, OG and Twitter card). */
  description: string;
  /** Optional per-page OG image (relative or absolute). Defaults to the brand logo. */
  ogImage?: string;
  /** OG type. Defaults to `website`; use `article` for blog posts, `profile` for member pages. */
  ogType?: 'website' | 'article' | 'profile';
  /** Block search-engine indexing for this specific page (e.g. legal stubs, draft routes). */
  noIndex?: boolean;
  /** ISO date string — sets `article:published_time` on OG when ogType=article. */
  publishedTime?: string;
  /** ISO date string — sets `article:modified_time` on OG when ogType=article. */
  modifiedTime?: string;
};

export function pageMetadata({
  path,
  title,
  description,
  ogImage,
  ogType = 'website',
  noIndex,
  publishedTime,
  modifiedTime,
}: PageMetadataInput): Metadata {
  const normalisedPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const url = `${SITE_URL}${normalisedPath || '/'}`;
  const image = ogImage ?? '/images/logo.png';

  const og: NonNullable<Metadata['openGraph']> = {
    type: ogType,
    locale: 'fr_FR',
    url,
    siteName: 'Digizelle',
    title,
    description,
    images: [{ url: image, width: 1200, height: 630, alt: title }],
  };
  // Only add article timestamps when the OG type is `article` —
  // setting them on a `website` graph object is invalid and some
  // crawlers complain.
  if (ogType === 'article') {
    if (publishedTime) (og as { publishedTime?: string }).publishedTime = publishedTime;
    if (modifiedTime) (og as { modifiedTime?: string }).modifiedTime = modifiedTime;
  }

  return {
    title,
    description,
    alternates: { canonical: normalisedPath || '/' },
    openGraph: og,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}
