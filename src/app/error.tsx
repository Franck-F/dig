'use client';

import { SectionErrorPanel } from '@/components/boundary/SectionErrorPanel';

/**
 * Root-level error boundary. Catches errors in any route that doesn't
 * have its own section-level boundary. `global-error.tsx` is reserved
 * for layout-level crashes (it owns its own <html><body>); this one
 * runs inside the app shell, so the header / sidebar stay intact.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionErrorPanel
      error={error}
      reset={reset}
      scope="root"
      homeHref="/"
      homeLabel="← Retour à l'accueil"
    />
  );
}
