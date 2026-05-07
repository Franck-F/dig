import {
  SkeletonCard,
  SkeletonLine,
  SkeletonStyles,
} from '@/components/boundary/Skeletons';

/**
 * Channel page skeleton — large header (channel emoji + name + counts),
 * then a stack of post-shaped cards in the main column with a sidebar
 * panel placeholder on the right.
 */
export default function ChannelLoading() {
  return (
    <>
      <SkeletonStyles />
      <section className="dz-section" style={{ paddingTop: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <SkeletonLine width={64} height={64} style={{ borderRadius: 18 }} />
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine width="40%" height={28} />
            <SkeletonLine width="60%" height={14} />
          </div>
          <SkeletonLine width={120} height={36} style={{ borderRadius: 999 }} />
        </div>
      </section>
      <section className="dz-section" style={{ paddingTop: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 280px)',
            gap: 32,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} lines={3} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SkeletonCard lines={4} />
            <SkeletonCard lines={6} />
          </div>
        </div>
      </section>
    </>
  );
}
