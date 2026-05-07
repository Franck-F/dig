'use client';

import { SectionErrorPanel } from '@/components/boundary/SectionErrorPanel';

export default function CommunityAdminError({
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
      scope="community.admin"
      homeHref="/community/admin/moderation"
      homeLabel="← Retour à l'admin"
    />
  );
}
