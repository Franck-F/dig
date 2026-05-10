import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * Digizelle XML sitemap.
 *
 * Generated at build/request time per Next.js 16 convention.
 * Available at https://digizelle.fr/sitemap.xml
 *
 * Note: Google ignores <priority> and <changefreq>, but Bing and other
 * engines still consider them as weak signals — kept for completeness.
 */

const SITE_URL = 'https://digizelle.fr';

type StaticRoute = {
  path: string;
  priority: number;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
};

/**
 * Static routes that are publicly indexable.
 * Excluded by design: `/login`, `/api/*`, `not-found`.
 */
const STATIC_ROUTES: StaticRoute[] = [
  // Home — top of the funnel
  { path: '', priority: 1.0, changeFrequency: 'weekly' },

  // Hero pages — flagship content
  { path: '/about', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/manifesto', priority: 0.9, changeFrequency: 'yearly' },
  { path: '/mentora', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/programs', priority: 0.9, changeFrequency: 'monthly' },

  // Secondary pages
  { path: '/team', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/projects', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/events', priority: 0.7, changeFrequency: 'weekly' },
  // Hand-built event album — kept out of the dynamic /events/[slug]
  // generator because it has its own bespoke page with stats lockup.
  { path: '/events/digizelle-impact-1', priority: 0.6, changeFrequency: 'yearly' },
  { path: '/blog', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/newsletter', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },

  // Legal — rarely change but must be discoverable
  { path: '/legal', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/cookies', priority: 0.3, changeFrequency: 'yearly' },
];

/**
 * Blog posts and events are stored as i18n entries (see
 * `messages/fr.json#blog.posts.0..5` and `home.events.items.0..4`).
 * We iterate the known indices and resolve their slugs at sitemap
 * generation time so every published article and event lands in
 * the XML output without a manual list to maintain.
 *
 * `lastModified` falls back to `now` for entries without an `iso`
 * field — the freshness signal still points at "current" which is
 * better than missing the URL altogether.
 */
const BLOG_POST_INDICES = ['0', '1', '2', '3', '4', '5'] as const;
const EVENT_INDICES = ['0', '1', '2', '3', '4'] as const;

async function getBlogPosts(now: Date): Promise<Array<{ slug: string; updatedAt: Date }>> {
  try {
    const t = await getTranslations('blog');
    return BLOG_POST_INDICES.flatMap((i) => {
      // i18n key access throws on missing keys when using `t()`; guard
      // with `t.has` so partial bundles (en.json with fewer posts)
      // don't break sitemap generation.
      if (!t.has(`posts.${i}.slug`)) return [];
      const slug = t(`posts.${i}.slug`);
      let updatedAt = now;
      if (t.has(`posts.${i}.iso`)) {
        const iso = t(`posts.${i}.iso`);
        const parsed = new Date(iso);
        if (!Number.isNaN(parsed.getTime())) updatedAt = parsed;
      }
      return [{ slug, updatedAt }];
    });
  } catch {
    return [];
  }
}

async function getEvents(now: Date): Promise<Array<{ slug: string; updatedAt: Date }>> {
  try {
    const t = await getTranslations('home.events.items');
    return EVENT_INDICES.flatMap((i) => {
      if (!t.has(`${i}.slug`)) return [];
      const slug = t(`${i}.slug`);
      // The home `events.items` shape doesn't carry an iso date; we
      // leave `updatedAt = now` so the entry shows up as "current".
      return [{ slug, updatedAt: now }];
    });
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const [posts, events] = await Promise.all([getBlogPosts(now), getEvents(now)]);

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const eventEntries: MetadataRoute.Sitemap = events.map((event) => ({
    url: `${SITE_URL}/events/${event.slug}`,
    lastModified: event.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...blogEntries, ...eventEntries];
}
