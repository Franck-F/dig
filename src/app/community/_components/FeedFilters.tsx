'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Channel = {
  slug: string;
  name: string;
  emoji: string | null;
  coverColor: string | null;
};

/**
 * Top-of-feed channel chips. Lets the viewer filter by a single channel.
 * Pushes ?channel=slug to the URL so the RSC handles the actual query.
 */
export default function FeedFilters({
  channels,
  current,
}: {
  channels: Channel[];
  current: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const t = useTranslations('community.feed');

  function setChannel(slug: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (slug) next.set('channel', slug);
    else next.delete('channel');
    next.delete('cursor');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <button
        type="button"
        onClick={() => setChannel(null)}
        className="dz-chip"
        style={{
          fontSize: 12,
          background: current === null ? 'rgba(115,1,255,0.16)' : undefined,
          fontWeight: current === null ? 700 : 500,
          cursor: 'pointer',
        }}
      >
        {t('filters.all')}
      </button>
      {channels.map((c) => {
        const dot = c.coverColor ?? '#7301FF';
        const isActive = current === c.slug;
        return (
          <button
            key={c.slug}
            type="button"
            onClick={() => setChannel(c.slug)}
            className="dz-chip"
            style={{
              fontSize: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: isActive
                ? 'rgba(115,1,255,0.16)'
                : c.coverColor
                  ? `${c.coverColor}14`
                  : undefined,
              borderColor: isActive
                ? 'rgba(115,1,255,0.45)'
                : c.coverColor
                  ? `${c.coverColor}40`
                  : undefined,
              fontWeight: isActive ? 700 : 500,
            }}
          >
            <span
              aria-hidden
              style={{ width: 6, height: 6, borderRadius: '50%', background: dot }}
            />
            <span>{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
