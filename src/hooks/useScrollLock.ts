'use client';

import { useEffect } from 'react';

let lockCount = 0;
let prevOverflow = '';

/**
 * Locks `document.body` scroll while at least one consumer has it active.
 * Reference-counted so multiple simultaneous modals don't race on the
 * `body.style.overflow` property (the second one to close would otherwise
 * leave the page un-scrollable).
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}
