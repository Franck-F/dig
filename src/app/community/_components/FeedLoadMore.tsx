'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';

import { loadMoreCommunityFeed } from '@/lib/actions/community/feed-load-more';

/**
 * Client island that owns the "Charger plus" button + accumulator for
 * the community feed. Replaces the previous URL-based pagination so
 * the user keeps her scroll position and the SSR-rendered initial
 * 20 cards stay mounted while extra cards stream in below.
 *
 * IntersectionObserver auto-loads the next page when the sentinel
 * scrolls into view — feels like infinite scroll. The button stays
 * as the keyboard-accessible fallback; pressing Enter on it triggers
 * the same load.
 *
 * Reduced-motion users still get auto-load (they're not animations,
 * just network requests) but no scroll-position-restore tricks.
 *
 * Server actions return rendered <PostCard> nodes so we don't have to
 * duplicate the i18n + glassmorphism markup in a client component.
 */
export default function FeedLoadMore({
  initialCursor,
  channelSlug,
  tag,
}: {
  initialCursor: string | null;
  channelSlug?: string | null;
  tag?: string | null;
}) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [chunks, setChunks] = useState<ReactNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const requestNext = () => {
    if (!cursor || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await loadMoreCommunityFeed({
          cursor,
          channelSlug: channelSlug ?? null,
          tag: tag ?? null,
        });
        setChunks((prev) => [...prev, res.node]);
        setCursor(res.nextCursor);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Impossible de charger la suite. Vérifie la connexion.',
        );
      }
    });
  };

  // IntersectionObserver — auto-trigger requestNext when the sentinel
  // enters the viewport. We rebind whenever cursor changes so the
  // observer disconnects once we run out of pages.
  useEffect(() => {
    if (!cursor) return;
    const node = sentinelRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            requestNext();
            break;
          }
        }
      },
      { rootMargin: '300px' }, // pre-fetch when within 300px of bottom
    );
    obs.observe(node);
    return () => obs.disconnect();
    // requestNext depends on `cursor` and `pending` via closure; cursor
    // is the dep that matters for re-arming the observer. Adding
    // requestNext would re-bind on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  if (chunks.length === 0 && !cursor) {
    // No pagination needed — let the parent render its own empty-state.
    return null;
  }

  return (
    <>
      {/* Accumulator: each chunk is the rendered RSC payload of a page. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {chunks.map((chunk, i) => (
          <div key={i}>{chunk}</div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 10,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        {cursor ? (
          <>
            <button
              type="button"
              onClick={requestNext}
              disabled={pending}
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                border: '1px solid rgba(115,1,255,0.18)',
                background: 'transparent',
                color: '#7301FF',
                fontSize: 12,
                fontWeight: 700,
                cursor: pending ? 'wait' : 'pointer',
                opacity: pending ? 0.6 : 1,
              }}
            >
              {pending ? 'Chargement…' : 'Charger plus →'}
            </button>
            {/* IntersectionObserver sentinel — invisible, just a hook
                point for the observer above. */}
            <div ref={sentinelRef} aria-hidden style={{ width: 1, height: 1 }} />
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#8b91ad' }}>
            Tu as tout vu pour ce filtre.
          </span>
        )}
      </div>
    </>
  );
}
