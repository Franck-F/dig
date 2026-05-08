import * as React from 'react';

/**
 * Vector icon set used across the app — Lucide-style strokes (1.8px)
 * tuned to read well at 14-22px without ever showing a blurry edge
 * the way an emoji would. Every icon takes a `size` (default 16),
 * inherits color from `currentColor`, and accepts a `strokeWidth`
 * override for surfaces where 1.8 is too thin (large hero icons).
 *
 * Why hand-roll instead of pulling lucide-react?
 *  - Zero new dependency (we'd ship 600+ icons we'd never use).
 *  - Each icon is ~10 lines, easier to tweak (cap, weight, viewBox)
 *    when we want a Digizelle-specific tilt.
 *  - Server components don't need a 'use client' boundary just to
 *    render a glyph — these stay RSC-friendly.
 *
 * Add new icons here when introducing them, with a one-liner above
 * naming the canonical surface that requested them.
 */

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number;
};

function Base({
  size = 16,
  strokeWidth = 1.8,
  children,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** Calendar — used by event date metadata (album header, card chips). */
export function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 10h18" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
    </Base>
  );
}

/** MapPin — venue / location chips. */
export function MapPinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 10c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.8" />
    </Base>
  );
}

/** ArrowLeft — back navigation. */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M19 12H5" />
      <path d="m12 5-7 7 7 7" />
    </Base>
  );
}

/** ArrowRight — CTA chevrons (slightly bolder). */
export function ArrowRightIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Base>
  );
}

/** Camera — gallery / album. */
export function CameraIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14.5 4h-5L8 6.5H4.5A2.5 2.5 0 0 0 2 9v9.5A2.5 2.5 0 0 0 4.5 21h15a2.5 2.5 0 0 0 2.5-2.5V9a2.5 2.5 0 0 0-2.5-2.5H16Z" />
      <circle cx="12" cy="13.5" r="3.6" />
    </Base>
  );
}

/** UserGroup — attendees count chip. */
export function UsersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Base>
  );
}

/** Mic — speakers count chip. */
export function MicIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v4" />
      <path d="M8 22h8" />
    </Base>
  );
}

/** Handshake — partners count chip. */
export function HandshakeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3-2.81 2.81a5.79 5.79 0 0 0-7.06.87l-2.81 2.81a3 3 0 0 0 0 4.24l3.06 3.06" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h0" />
    </Base>
  );
}
