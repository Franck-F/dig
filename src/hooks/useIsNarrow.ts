'use client';

import { useEffect, useState } from 'react';

/**
 * Returns `true` when the viewport width is at or below `maxWidthPx`.
 *
 * Subscribes to a `matchMedia(max-width)` so the value stays in sync with
 * viewport resizes (rotation, browser-window resize). SSR-safe: the
 * first render returns `false`, the effect corrects on mount.
 *
 * @example
 *   const isMobile = useIsNarrow(760);
 *   return isMobile ? <MobileLayout /> : <DesktopLayout />;
 */
export function useIsNarrow(maxWidthPx = 760): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    setIsNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidthPx]);

  return isNarrow;
}
