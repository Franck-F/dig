'use client';

import { useEffect, useRef } from 'react';

type Props = {
  children: React.ReactNode;
  /** Y translation in px between scroll start and bottom of hero. Default -100 (drifts up). */
  yRange?: [number, number];
  /** Scale at start vs end of hero. Default [1, 0.94]. */
  scaleRange?: [number, number];
  /** Optional className applied to the wrapper. */
  className?: string;
};

/**
 * Scroll-driven parallax for hero content (mascot, hero image…).
 *
 * Dependency-free by design: this used to wrap children in framer-motion's
 * `motion.div`, which pulled ~110 KB of motion JS onto the homepage's critical
 * path and delayed the LCP image paint on mobile (LCP ~4.8 s). framer-motion
 * had only two importers in the whole app — this and the (now-removed) infinite
 * slider — so dropping it here lets the homepage chunk shed it entirely.
 *
 * The children render in a plain `<div>` (server-rendered, so the `priority`
 * mascot is painted as the LCP without waiting on JS); a passive rAF scroll
 * listener then enhances with the same translate + scale parallax. Bails out
 * under `prefers-reduced-motion`.
 */
export default function HeroParallax({
  children,
  yRange = [0, -100],
  scaleRange = [1, 0.94],
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const [y0, y1] = yRange;
    const [s0, s1] = scaleRange;
    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      // Progress 0→1 as the wrapper scrolls from "top at viewport top" to
      // "fully scrolled past its own height" — mirrors framer-motion's
      // offset ['start start', 'end start'].
      const total = rect.height || window.innerHeight || 1;
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      const y = y0 + (y1 - y0) * progress;
      const scale = s0 + (s1 - s0) * progress;
      el.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [yRange, scaleRange]);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}
