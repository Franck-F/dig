import Link from 'next/link';

import { ChevronRightIcon, HomeIcon } from './icons';

/**
 * Page-level breadcrumb. Renders a real trail (Home → section → page)
 * with chevron separators, in keeping with the rest of the
 * Digizelle DA: tiny caps tracking, brand violet on the leaf, soft
 * top + bottom rules to seat the trail in the page.
 *
 * The first item is always Home — the icon visually anchors the
 * trail on the left, no need for a label that would compete with
 * the rest of the chrome.
 *
 * Usage:
 *   <Breadcrumb
 *     items={[
 *       { href: '/events', label: 'Événements' },
 *       { label: 'Digizelle Impact #1' },  // current page, no href
 *     ]}
 *   />
 */
export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export default function Breadcrumb({
  items,
  homeHref = '/',
  homeLabel = 'Accueil',
}: {
  items: BreadcrumbItem[];
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <nav aria-label="Fil d'Ariane" className="dz-crumbs">
      <ol className="dz-crumbs__list">
        <li className="dz-crumbs__item">
          <Link href={homeHref} aria-label={homeLabel} className="dz-crumbs__link">
            <HomeIcon size={14} />
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="dz-crumbs__item">
              <span aria-hidden className="dz-crumbs__sep">
                <ChevronRightIcon size={12} strokeWidth={2.2} />
              </span>
              {isLast || !item.href ? (
                <span aria-current={isLast ? 'page' : undefined} className="dz-crumbs__leaf">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="dz-crumbs__link">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <style>{`
        .dz-crumbs {
          padding: 14px 0;
          border-bottom: 1px solid rgba(115, 1, 255, 0.10);
        }
        .dz-crumbs__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .dz-crumbs__item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .dz-crumbs__sep {
          display: inline-flex;
          align-items: center;
          color: rgba(115, 1, 255, 0.45);
        }
        .dz-crumbs__link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #5a4882;
          text-decoration: none;
          padding: 4px 6px;
          border-radius: 6px;
          transition: background 160ms ease, color 160ms ease;
        }
        .dz-crumbs__link:hover {
          background: rgba(115, 1, 255, 0.06);
          color: #7301FF;
        }
        .dz-crumbs__leaf {
          color: #7301FF;
          font-weight: 700;
          padding: 4px 6px;
          max-width: 60ch;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </nav>
  );
}
