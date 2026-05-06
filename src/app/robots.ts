import type { MetadataRoute } from 'next';

/**
 * Digizelle robots.txt.
 *
 * Generated at build/request time per Next.js 16 convention.
 * Available at https://digizelle.fr/robots.txt
 *
 * AI crawler policy:
 *   Digizelle's GEO (Generative Engine Optimization) strategy is to BE
 *   discovered and cited by AI search engines and assistants. We therefore
 *   ALLOW the major AI crawlers (GPTBot, ChatGPT-User, ClaudeBot,
 *   anthropic-ai, Google-Extended, PerplexityBot, CCBot) by default.
 *   Re-evaluate if scraping pressure becomes a problem.
 */

const SITE_URL = 'https://digizelle.fr';

const DISALLOWED_PATHS = [
  '/api/',          // all API endpoints, including /api/auth/[...nextauth]
  '/_next/',        // Next.js internals
  '/login',         // auth UI — no SEO value, must not be indexed
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default policy: allow all crawlers on everything except private routes.
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },

      // Explicit allow-list for AI crawlers (GEO strategy).
      // Listing them explicitly makes the intent auditable and survives any
      // future tightening of the wildcard rule.
      {
        userAgent: [
          'GPTBot',           // OpenAI — model training
          'ChatGPT-User',     // OpenAI — real-time browsing on user request
          'OAI-SearchBot',    // OpenAI — SearchGPT index
          'ClaudeBot',        // Anthropic — model training
          'anthropic-ai',     // Anthropic — legacy token
          'Claude-Web',       // Anthropic — real-time browsing
          'Google-Extended',  // Google — Gemini training
          'PerplexityBot',    // Perplexity — search + training
          'Perplexity-User',  // Perplexity — real-time browsing
          'CCBot',            // Common Crawl — open dataset
          'Applebot-Extended',// Apple — Apple Intelligence training
        ],
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
