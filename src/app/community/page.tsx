import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { auth } from '@/auth';

import ConnectedFeed from './_components/ConnectedFeed';
import PublicLanding from './_components/PublicLanding';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

type SearchParams = {
  channel?: string;
  cursor?: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('community.feed');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

/**
 * `/community` dispatcher.
 *
 * - Authenticated users see the connected feed (3-col composer + posts +
 *   side panels) inside the `AppShell` provided by `community/layout.tsx`.
 * - Anonymous visitors see the public landing (hero + value props +
 *   showcase + paywalled feed) inside the public `<Frame>`.
 *
 * All `/community/**` sub-routes inherit the same auth-aware shell so the
 * connected experience never gets interrupted once the user is signed in.
 */
export default async function CommunityRouter({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const sp = await searchParams;

  if (session?.user?.id) {
    return <ConnectedFeed searchParams={sp} />;
  }
  return <PublicLanding searchParams={sp} />;
}
