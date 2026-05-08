import Link from 'next/link';

/**
 * Page-number pagination for admin list pages. Reusable across the
 * moderation queue, users list, mentor admin lists. Server component —
 * no JS needed.
 *
 * Convention:
 *  - `page` is 1-indexed.
 *  - `buildHref(page)` is provided by the caller so each page can
 *    preserve its own query-string filters (status, q, etc.) when
 *    navigating between pages.
 *  - Renders nothing when `totalPages <= 1`.
 *
 * Accessibility:
 *  - aria-label on the nav for screen readers.
 *  - Disabled (current page / out-of-range) buttons render as plain
 *    spans without href, with aria-current="page" on the current.
 */
export type PaginationProps = {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  /** Optional total-row count for the "X éléments" affordance. */
  total?: number;
  /** i18n-style overrides; defaults are FR. */
  labels?: {
    previous?: string;
    next?: string;
    page?: string;
    of?: string;
    items?: (n: number) => string;
  };
};

const DEFAULT_LABELS = {
  previous: 'Précédent',
  next: 'Suivant',
  page: 'Page',
  of: '/',
  items: (n: number) => `${new Intl.NumberFormat('fr-FR').format(n)} élément${n > 1 ? 's' : ''}`,
} as const;

export default function Pagination({
  page,
  totalPages,
  buildHref,
  total,
  labels,
}: PaginationProps) {
  const L = { ...DEFAULT_LABELS, ...labels };
  if (totalPages <= 1) {
    return total !== undefined ? (
      <div
        aria-label="Pagination"
        style={{
          display: 'flex',
          justifyContent: 'center',
          fontSize: 12,
          color: '#8b91ad',
          padding: 8,
        }}
      >
        {L.items(total)}
      </div>
    ) : null;
  }

  const safePage = Math.max(1, Math.min(totalPages, page));
  const hasPrev = safePage > 1;
  const hasNext = safePage < totalPages;

  return (
    <nav
      aria-label="Pagination"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        padding: '4px 0',
        flexWrap: 'wrap',
      }}
    >
      {hasPrev ? (
        <Link
          href={buildHref(safePage - 1)}
          rel="prev"
          style={navLink}
        >
          ← {L.previous}
        </Link>
      ) : (
        <span style={{ ...navLink, opacity: 0.4, pointerEvents: 'none' }}>
          ← {L.previous}
        </span>
      )}

      <span style={{ fontSize: 12, color: '#545b7a', fontWeight: 600 }} aria-current="page">
        {L.page} {safePage} {L.of} {totalPages}
        {total !== undefined && (
          <span style={{ marginLeft: 8, color: '#8b91ad', fontWeight: 400 }}>
            · {L.items(total)}
          </span>
        )}
      </span>

      {hasNext ? (
        <Link
          href={buildHref(safePage + 1)}
          rel="next"
          style={navLink}
        >
          {L.next} →
        </Link>
      ) : (
        <span style={{ ...navLink, opacity: 0.4, pointerEvents: 'none' }}>
          {L.next} →
        </span>
      )}
    </nav>
  );
}

const navLink: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 9,
  border: '1px solid rgba(115,1,255,0.20)',
  color: '#7301FF',
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
  background: 'white',
};
