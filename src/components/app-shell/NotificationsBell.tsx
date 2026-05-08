'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export type NotificationPreview = {
  id: string;
  /** Pre-localised title rendered by the layout. */
  title: string;
  /** Optional body / preview line. */
  body?: string | null;
  /** Where clicking the row should navigate. */
  href?: string | null;
  /** ISO timestamp; rendered as a short relative label. */
  createdAt: string;
  /** True when this notification has not been read yet. */
  unread: boolean;
};

type Props = {
  /** Where the "Voir tout" link points (full notifications page). */
  notificationsHref: string;
  /** Aria-label for the bell button. */
  ariaLabel: string;
  /** Latest 5 notifications. */
  items: NotificationPreview[];
  /** Total unread count — drives the badge dot. */
  unreadCount: number;
  /** Locale-aware copy. */
  copy: {
    title: string;
    empty: string;
    seeAll: string;
    just: string; // "à l'instant"
    minutesAgo: string; // "il y a {n} min"
    hoursAgo: string; // "il y a {n} h"
    daysAgo: string; // "il y a {n} j"
  };
  /** True when AppShell is in dark mode. */
  isDark?: boolean;
};

/**
 * Topbar notifications bell with a click-to-open popover.
 * - Bell is an inline SVG (no emoji), badge dot when unread > 0.
 * - Popover fetches nothing — items come pre-rendered from the server layout.
 * - Closes on outside click / Esc.
 */
export default function NotificationsBell({
  notificationsHref,
  ariaLabel,
  items,
  unreadCount,
  copy,
  isDark = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Focus trap on the bell popover (WCAG 2.4.3).
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          border: isDark
            ? '1px solid rgba(255,255,255,0.10)'
            : '1px solid rgba(115,1,255,0.15)',
          background: isDark ? 'rgba(255,255,255,0.05)' : 'white',
          color: isDark ? 'white' : '#7301FF',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#F46FB1',
              boxShadow: '0 0 0 2px ' + (isDark ? '#1a1240' : '#ffffff'),
            }}
          />
        )}
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label={copy.title}
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: 'min(380px, 92vw)',
            maxHeight: 480,
            overflowY: 'auto',
            background: isDark ? 'rgba(28,18,60,0.96)' : 'rgba(255,255,255,0.96)',
            color: isDark ? 'white' : '#1a1f3a',
            border: isDark
              ? '1px solid rgba(255,255,255,0.10)'
              : '1px solid rgba(115,1,255,0.12)',
            borderRadius: 16,
            boxShadow: '0 28px 70px -20px rgba(36,18,80,0.45), 0 1px 0 rgba(255,255,255,0.95) inset',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            zIndex: 50,
            padding: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px 10px',
              borderBottom: isDark
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(115,1,255,0.08)',
            }}
          >
            <strong style={{ fontSize: 14, fontWeight: 700 }}>{copy.title}</strong>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#F46FB1',
                  background: 'rgba(244,111,177,0.12)',
                  border: '1px solid rgba(244,111,177,0.20)',
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                fontSize: 13,
                color: isDark ? 'rgba(255,255,255,0.6)' : '#8b91ad',
              }}
            >
              {copy.empty}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 4 }}>
              {items.map((n) => {
                const Row: React.ElementType = n.href ? Link : 'div';
                const rowProps = n.href ? { href: n.href, onClick: () => setOpen(false) } : {};
                return (
                  <li key={n.id}>
                    <Row
                      {...(rowProps as Record<string, unknown>)}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        padding: '10px 12px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        color: 'inherit',
                        background: n.unread
                          ? isDark
                            ? 'rgba(115,1,255,0.18)'
                            : 'rgba(115,1,255,0.06)'
                          : 'transparent',
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: n.unread ? '#7301FF' : 'transparent',
                          marginTop: 7,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: n.unread ? 700 : 600 }}>{n.title}</div>
                        {n.body && (
                          <div
                            style={{
                              fontSize: 12,
                              color: isDark ? 'rgba(255,255,255,0.65)' : '#545b7a',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {n.body}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 11,
                            color: isDark ? 'rgba(255,255,255,0.45)' : '#8b91ad',
                            marginTop: 4,
                          }}
                        >
                          {formatRelative(n.createdAt, copy)}
                        </div>
                      </div>
                    </Row>
                  </li>
                );
              })}
            </ul>
          )}

          <div
            style={{
              padding: '8px 12px',
              borderTop: isDark
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(115,1,255,0.08)',
              marginTop: 4,
            }}
          >
            <Link
              href={notificationsHref}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                padding: '8px 10px',
                borderRadius: 10,
                color: '#7301FF',
                textDecoration: 'none',
                background: 'rgba(115,1,255,0.06)',
              }}
            >
              {copy.seeAll} →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string, copy: Props['copy']): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return copy.just;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return copy.minutesAgo.replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return copy.hoursAgo.replace('{n}', String(hours));
  const days = Math.floor(hours / 24);
  return copy.daysAgo.replace('{n}', String(days));
}
