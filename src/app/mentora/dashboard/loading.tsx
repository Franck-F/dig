import { SkeletonAdmin } from '@/components/boundary/Skeletons';

/**
 * Reuses the admin skeleton — both surfaces have a similar layout
 * (stat strip + list of items), so the same shapes minimise layout
 * shift on hydration.
 */
export default function MentoraDashboardLoading() {
  return <SkeletonAdmin />;
}
