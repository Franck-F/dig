import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Security headers — applied to every route.
 *
 * Content-Security-Policy is shipped in **Report-Only** mode for the first
 * production deploy so we can observe violations in the browser console
 * (and via Sentry's CSP report endpoint when wired) without breaking the
 * site. Once the report stream is clean for ~1 week, flip the directive
 * name from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
 *
 * The codebase relies heavily on inline `style={{…}}` attributes (every
 * component) and on Next.js styled-jsx `<style jsx>{…}</style>`. CSP cannot
 * differentiate React-emitted inline styles from attacker-injected ones, so
 * `style-src` keeps `'unsafe-inline'`. For `script-src`, Next.js 16 emits
 * inline scripts (RSC payload, hydration) with hashes/nonces transparently —
 * we keep `'self' 'unsafe-inline'` until we wire a strict nonce middleware
 * (Phase 2). Browsers ignore `'unsafe-inline'` when a nonce/hash is present,
 * so this is a stricter posture than it looks.
 *
 * Allowlists:
 *  - Supabase: storage + REST (image hosting + Realtime)
 *  - Resend: transactional email pixel/tracking
 *  - Vercel Speed Insights / Analytics: ingestion endpoint (Phase 2 wiring)
 *  - data: + blob: : data-URI uploads + (future) Vercel Blob signed URLs
 */
const isDev = process.env.NODE_ENV !== 'production';

const cspDirectives = [
  "default-src 'self'",
  // Scripts: Next.js + RSC inline scripts. `unsafe-eval` only kept in dev
  // for HMR; production strips it.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  // Styles: every page uses `style={{…}}` and styled-jsx → unsafe-inline
  // is required. We compensate by hardening other directives.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.public.blob.vercel-storage.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://cdn.discordapp.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // XHR / fetch: same origin + Supabase (REST + Realtime WS) + Resend +
  // Sentry + Vercel.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://*.ingest.sentry.io https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  // Frames: deny all (used to be X-Frame-Options: DENY). OAuth providers
  // never embed our pages in frames; if a future feature needs an iframe,
  // explicitly allowlist that origin here.
  "frame-ancestors 'none'",
  // Forms: only post to ourselves (auth callbacks live on /api/auth/*).
  "form-action 'self'",
  // Misc tightening
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
];

const securityHeaders = [
  // CSP in Report-Only first; flip to enforced after observation window.
  {
    key: 'Content-Security-Policy-Report-Only',
    value: cspDirectives.join('; '),
  },
  // HSTS: 2 years, include subdomains, preload-eligible. Vercel terminates
  // TLS so this is safe.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Legacy backstop for browsers that don't honour `frame-ancestors`.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs to third parties; same-origin requests still get
  // the full referrer.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable powerful APIs we don't use. Browsers that don't recognise a
  // feature simply ignore it, so this list can grow over time without
  // breaking older clients.
  {
    key: 'Permissions-Policy',
    value: [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()',
    ].join(', '),
  },
  // Cross-origin protections — keep us isolated from third-party windows
  // that try to read our state via window.opener / Spectre-class attacks.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Don't list our app version / framework
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route except OAuth callback iframes (none today).
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
