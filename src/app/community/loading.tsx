import { SkeletonPage } from '@/components/boundary/Skeletons';

/**
 * Loading skeleton for /community and any nested route that doesn't
 * declare its own. Renders while the server component awaits its
 * Prisma queries (channels carousel, post feed, etc.).
 */
export default function CommunityLoading() {
  return <SkeletonPage showFilters cards={6} />;
}
