'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
};

export default function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 1600,
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);

  // Intrinsic side effect: rAF-driven counter animation on visibility.
  // setN inside the effect is the whole point of an animation.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // WCAG 2.3.3 — reduced-motion users get the final value with no
    // counter animation.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setN(value);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setN(value);
      return;
    }
    // Hoisted so the effect's cleanup can cancel any pending frame even if
    // the component unmounts mid-animation.
    let raf = 0;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setN(Math.floor(eased * value));
          if (t < 1) raf = requestAnimationFrame(tick);
          else setN(value);
        };
        raf = requestAnimationFrame(tick);
        obs.disconnect();
      },
      { threshold: 0.3 }
    );
    obs.observe(node);
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {n.toLocaleString('fr-FR')}
      {suffix}
    </span>
  );
}
