'use client';

import { SectionErrorPanel } from '@/components/boundary/SectionErrorPanel';

export default function CommunityError({
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
      scope="community"
      homeHref="/community"
      homeLabel="← Retour à la communauté"
    />
  );
}
