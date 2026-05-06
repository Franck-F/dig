import type { MetadataRoute } from 'next';

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
  { path: '/mentora', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/programs', priority: 0.9, changeFrequency: 'monthly' },

  // Secondary pages
  { path: '/team', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/projects', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/events', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/blog', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },

  // Legal — rarely change but must be discoverable
  { path: '/legal', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/cookies', priority: 0.3, changeFrequency: 'yearly' },
];

/**
 * Future: fetch published blog posts from CMS / Prisma.
 * TODO: replace with real query once `Post` model is wired in.
 */
async function getBlogPosts(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return [];
}

/**
 * Future: fetch upcoming and past event detail pages.
 * TODO: replace with real query once `Event` model is wired in.
 */
async function getEvents(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const [posts, events] = await Promise.all([getBlogPosts(), getEvents()]);

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
