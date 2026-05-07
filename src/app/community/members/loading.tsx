import { SkeletonPage } from '@/components/boundary/Skeletons';

export default function MembersLoading() {
  return <SkeletonPage showFilters cards={9} />;
}
