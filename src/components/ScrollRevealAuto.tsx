'use client';

import { useEffect } from 'react';

/**
 * Auto-init script for `[data-dz-reveal]`. Mount once at a layout level —
 * it walks the DOM, observes every reveal target through one shared
 * IntersectionObserver, and flips `data-revealed="true"` when each enters
 * the viewport. Re-scans on route change via a MutationObserver so newly
 * rendered cards are picked up.
 *
 * Bails out under prefers-reduced-motion (the CSS already handles the
 * visual no-op, but this avoids spinning observers).
 */
export default function ScrollRevealAuto() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.revealed = 'true';
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -64px 0px' },
    );

    const scan = () => {
      document.querySelectorAll<HTMLElement>('[data-dz-reveal]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.dataset.revealed === 'true') return;
        io.observe(el);
      });
    };

    scan();

    const mo = new MutationObserver(() => {
      // Throttle: rAF coalesces multiple mutations into one DOM scan.
      requestAnimationFrame(scan);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
