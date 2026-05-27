'use client';

import { useEffect } from 'react';

/**
 * Registers the static service worker (`/sw.js`) on mount.
 *
 * Lives in a separate client component (rather than the root layout's
 * inline boot script) so the registration logic stays out of the
 * server-rendered HTML — and so we can guard against:
 *
 *  - SSR (no `navigator`),
 *  - Dev hot-reload registering the SW against `next dev` (which
 *    doesn't serve `/sw.js` consistently and pollutes cache on every
 *    edit),
 *  - Older browsers without SW support.
 *
 * Updates are picked up automatically — when a new `sw.js` lands, the
 * browser swaps in the new worker on next navigation (the SW itself
 * calls `skipWaiting` + `clients.claim` so there's no stale-tab dance).
 */
export default function PwaServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register on idle so we don't fight with critical-path resources
    // on first paint. Falls back to `setTimeout` on browsers without
    // `requestIdleCallback` (Safari).
    type IdleCallback = (cb: () => void) => void;
    const idle: IdleCallback =
      (window as unknown as { requestIdleCallback?: IdleCallback }).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1000));

    idle(() => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // Best-effort: SW is progressive enhancement, never block the UX.
          // Log so we'd notice in monitoring, but don't surface to users.
          console.warn('[pwa] service worker registration failed', err);
        });
    });
  }, []);

  return null;
}
