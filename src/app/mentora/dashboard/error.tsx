'use client';

import { SectionErrorPanel } from '@/components/boundary/SectionErrorPanel';

export default function MentoraDashboardError({
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
      scope="mentora.dashboard"
      homeHref="/mentora/dashboard"
      homeLabel="← Retour au dashboard"
    />
  );
}
