import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';

/**
 * `/app/**` — post-login Hub.
 *
 * Auth gate is centralized here so every child page inherits the redirect.
 * The connected community now lives at `/community/**` (auth-aware via
 * `community/layout.tsx`). `/app/community` is kept as a redirect alias.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?next=/app');
  return <>{children}</>;
}
