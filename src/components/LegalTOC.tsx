'use client';

import { useEffect, useRef, useState } from 'react';

export type LegalTOCItem = { id: string; label: string };
type Props = {
  items: LegalTOCItem[];
  /** Top offset (in px) used by the IntersectionObserver root margin. Helps
   *  account for any sticky header above the page. */
  offset?: number;
  /** Translated heading for the TOC ("Sommaire" in French). Callers must
   *  pass the localized string; this default exists only as a fallback. */
  label?: string;
};

/**
 * Sticky table of contents for legal pages.
 * - On desktop (≥1024px) it is rendered as a sticky vertical list.
 * - On mobile (<1024px) the consumer page should wrap it inside a
 *   <details> element to keep it collapsible.
 *
 * The component is self-contained: it injects its own scoped <style>
 * to avoid touching the global CSS.
 */
export default function LegalTOC({ items, offset = 96, label = 'Sommaire' }: Props) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) return;

    // Cleanup any existing observer before re-creating one.
    observerRef.current?.disconnect();

    const visibility = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }
        // Pick the section with the highest visible ratio. Fallback to
        // the first item that is at least partially in view.
        let bestId = '';
        let bestRatio = 0;
        for (const [id, ratio] of visibility) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId && bestRatio > 0) setActiveId(bestId);
      },
      {
        // Trigger when the section enters the central band of the viewport.
        rootMargin: `-${offset}px 0px -55% 0px`,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [items, offset]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    setActiveId(id);
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
    // Update the URL hash without jumping.
    if (typeof history !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
  };

  return (
    <nav className="dz-legal-toc" aria-label={label}>
      <p className="dz-legal-toc__label">{label}</p>
      <ul className="dz-legal-toc__list">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`dz-legal-toc__link${isActive ? ' --active' : ''}`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>

      <style jsx>{`
        .dz-legal-toc {
          font-family: inherit;
        }
        .dz-legal-toc__label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--brand-violet);
          margin: 0 0 12px 12px;
        }
        .dz-legal-toc__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .dz-legal-toc__link {
          display: block;
          padding: 8px 12px;
          border-left: 2px solid transparent;
          color: #545b7a;
          font-size: 14px;
          line-height: 1.4;
          text-decoration: none;
          transition: color 160ms ease, border-color 160ms ease,
            background-color 160ms ease;
          border-radius: 0 6px 6px 0;
        }
        .dz-legal-toc__link:hover {
          color: var(--brand-violet-light, #a34bf5);
          background: rgba(115, 1, 255, 0.05);
        }
        .dz-legal-toc__link.--active {
          color: var(--brand-violet);
          border-left-color: var(--brand-violet);
          font-weight: 600;
          background: rgba(115, 1, 255, 0.06);
        }
      `}</style>
    </nav>
  );
}
