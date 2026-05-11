'use client';

import { SectionErrorPanel } from '@/components/boundary/SectionErrorPanel';

export default function MentoratAdminError({
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
      scope="mentora.admin"
      homeHref="/mentora/admin"
      homeLabel="← Retour au pilotage"
    />
  );
}
