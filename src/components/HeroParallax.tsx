'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

type Props = {
  children: React.ReactNode;
  /** Y translation in px between scroll start and bottom of hero. Default -120 (drifts up). */
  yRange?: [number, number];
  /** Scale at start vs end of hero. Default [1, 0.92]. */
  scaleRange?: [number, number];
  /** Optional className applied to the wrapper. */
  className?: string;
};

/**
 * Wraps hero content (mascot, hero image…) in a scroll-driven parallax.
 * Uses framer-motion `useScroll` against the wrapper itself so the effect is
 * scoped — no global listeners. Bails out under prefers-reduced-motion.
 */
export default function HeroParallax({
  children,
  yRange = [0, -100],
  scaleRange = [1, 0.94],
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const reduced = useReducedMotion();
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : yRange);
  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : scaleRange);

  return (
    <motion.div
      ref={ref}
      style={{ y, scale, willChange: 'transform' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
