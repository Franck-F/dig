'use client';

import { SectionErrorPanel } from '@/components/boundary/SectionErrorPanel';

export default function MentoraError({
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
      scope="mentora"
      homeHref="/mentora"
      homeLabel="← Retour à Mentora"
    />
  );
}
