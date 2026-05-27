/* eslint-disable */
/**
 * Digizelle service worker — minimal but real PWA shell.
 *
 * Strategy:
 *  - Precache the offline fallback page + app icons + manifest at install
 *    time so the app shell is always available offline.
 *  - At runtime, serve same-origin GET navigation requests network-first
 *    with a fallback to the precached `/offline` page when the network
 *    fails.
 *  - For static assets under `/_next/static/`, `/icon-*.png`, etc., use
 *    cache-first (they're content-hashed and immutable).
 *
 * We deliberately avoid Workbox: the rules are simple enough to hand-roll
 * and a 1 KB SW beats a 30 KB framework for this surface.
 *
 * Versioning: bump CACHE_VERSION to invalidate every old cache at once
 * (the activate handler deletes any cache whose key doesn't start with
 * the current prefix).
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `digizelle-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `digizelle-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/offline',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(CACHE_VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET, only same-origin. Anything else (POST mutations, OAuth
  // redirects, third-party widgets) falls through to the network without
  // touching the cache.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Server actions + API: never cache (would break auth + mutations).
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) {
    return;
  }

  // Immutable static assets: cache-first.
  const isHashed =
    url.pathname.startsWith('/_next/static/') ||
    /\.(woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|map)$/i.test(url.pathname);

  if (isHashed) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // HTML navigations: network-first, fall back to offline page.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline').then((r) => r ?? new Response('Offline', { status: 503 }))),
    );
  }
});
