/**
 * Reusable loading-state skeletons. All variants use the same shimmer
 * animation defined inline (no global CSS dependency required since
 * loading.tsx renders before our design-system CSS would otherwise be
 * fully cascaded — keeping the styles self-contained avoids FOUC).
 *
 * Each component renders pure layout boxes with a subtle pulsing
 * background. Designed to match the rough shape of the page that's
 * about to load so the layout doesn't shift on hydration.
 */

const SHIMMER_KEYFRAMES = `
  @keyframes dz-skel-pulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.85; }
  }
`;

const baseBox: React.CSSProperties = {
  background:
    'linear-gradient(135deg, rgba(115,1,255,0.08), rgba(244,111,177,0.06))',
  borderRadius: 14,
  animation: 'dz-skel-pulse 1.4s ease-in-out infinite',
};

export function SkeletonStyles() {
  return <style>{SHIMMER_KEYFRAMES}</style>;
}

/** Single line of fake text. `width` accepts any CSS length. */
export function SkeletonLine({
  width = '100%',
  height = 14,
  style,
}: {
  width?: string | number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        ...baseBox,
        width,
        height,
        borderRadius: height < 20 ? 6 : 10,
        ...style,
      }}
    />
  );
}

/** Card-shaped block — a header line + body lines. */
export function SkeletonCard({
  lines = 3,
  height,
  style,
}: {
  lines?: number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        padding: 22,
        borderRadius: 18,
        border: '1px solid rgba(115,1,255,0.10)',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height,
        ...style,
      }}
    >
      <SkeletonLine width="60%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? '40%' : `${85 + (i % 3) * 5}%`}
          height={12}
        />
      ))}
    </div>
  );
}

/** Grid of skeleton cards — used for member / mentor directories. */
export function SkeletonGrid({
  count = 6,
  columns = 'repeat(auto-fill, minmax(260px, 1fr))',
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={3} />
      ))}
    </div>
  );
}

/** Page-level skeleton: title + intro + grid. Wraps a section. */
export function SkeletonPage({
  showFilters = false,
  cards = 6,
}: {
  showFilters?: boolean;
  cards?: number;
}) {
  return (
    <>
      <SkeletonStyles />
      <div
        className="dz-section"
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <SkeletonLine width="40%" height={32} />
        <SkeletonLine width="65%" height={16} />
        {showFilters && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLine key={i} width={90 + (i % 3) * 20} height={32} />
            ))}
          </div>
        )}
        <SkeletonGrid count={cards} />
      </div>
    </>
  );
}

/** Single-column long-content skeleton (post / member profile). */
export function SkeletonArticle() {
  return (
    <>
      <SkeletonStyles />
      <div
        className="dz-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <SkeletonLine width="70%" height={32} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SkeletonLine width={40} height={40} style={{ borderRadius: '50%' }} />
          <SkeletonLine width="30%" height={12} />
        </div>
        <SkeletonLine width="100%" height={200} style={{ borderRadius: 18 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLine key={i} width={i === 5 ? '60%' : '100%'} height={12} />
        ))}
      </div>
    </>
  );
}

/** Admin dashboard skeleton — stat strip + list. */
export function SkeletonAdmin() {
  return (
    <>
      <SkeletonStyles />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <SkeletonLine width="45%" height={28} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} height={92} />
          ))}
        </div>
        <SkeletonGrid count={6} columns="1fr" />
      </div>
    </>
  );
}
