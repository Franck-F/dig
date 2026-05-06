"use client";

import * as React from "react";

/**
 * Brand scroller — infinite marquee of partner / trust wordmarks.
 *
 * Visual deltas vs the upstream 21st.dev component:
 *  - Wordmarks instead of icon brands (no upstream brand assumption)
 *  - Each item carries its own typographic identity (weight / italic /
 *    letter-spacing / font-family) so the marquee reads as distinct logos.
 *  - Edge fade + variable speed via CSS custom properties.
 *  - Pauses on hover and respects prefers-reduced-motion (CSS-driven).
 *  - Locale-friendly: items come from the parent (i18n already done).
 */

export type BrandLogo = {
  name: string;
  weight?: number;
  italic?: boolean;
  letterSpacing?: string;
  fontFamily?: string;
};

type Direction = "left" | "right";

export interface BrandScrollerProps {
  logos: BrandLogo[];
  direction?: Direction;
  /** Marquee duration. CSS var --duration. */
  durationSeconds?: number;
  /** Gap between two adjacent wordmarks in rem. CSS var --gap. */
  gapRem?: number;
  /** Number of duplicated tracks; 4 yields a smooth perceived loop on wide screens. */
  copies?: number;
  className?: string;
}

const Wordmark = ({ name, weight = 700, italic, letterSpacing, fontFamily }: BrandLogo) => (
  <div
    className="flex shrink-0 items-center select-none whitespace-nowrap"
    style={{
      fontWeight: weight,
      fontStyle: italic ? "italic" : "normal",
      letterSpacing,
      fontFamily: fontFamily ?? "inherit",
      fontSize: "clamp(20px, 1.6vw, 28px)",
      color: "var(--ink, #1a1f3a)",
      opacity: 0.78,
      transition: "opacity 0.3s cubic-bezier(0.16,1,0.3,1), filter 0.3s cubic-bezier(0.16,1,0.3,1)",
      filter: "saturate(0.6)",
    }}
  >
    {name}
  </div>
);

export function BrandScroller({
  logos,
  direction = "left",
  durationSeconds = 42,
  gapRem = 4,
  copies = 4,
  className,
}: BrandScrollerProps) {
  const animClass = direction === "right" ? "animate-marquee-reverse" : "animate-marquee";

  return (
    <div
      className={[
        "group relative flex w-full flex-row overflow-hidden py-2",
        "[mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]",
        "[-webkit-mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]",
        className ?? "",
      ].join(" ")}
      style={
        {
          "--gap": `${gapRem}rem`,
          "--duration": `${durationSeconds}s`,
          gap: `${gapRem}rem`,
        } as React.CSSProperties
      }
    >
      {Array.from({ length: copies }).map((_, copyIdx) => (
        <div
          key={copyIdx}
          className={[
            "flex shrink-0 flex-row items-center [gap:var(--gap)]",
            animClass,
            "group-hover:[animation-play-state:paused]",
          ].join(" ")}
          style={{ gap: `${gapRem}rem` }}
          aria-hidden={copyIdx > 0}
        >
          {logos.map((logo, i) => (
            <Wordmark key={`${copyIdx}-${i}`} {...logo} />
          ))}
        </div>
      ))}
    </div>
  );
}

export const BrandScrollerReverse = (props: Omit<BrandScrollerProps, "direction">) => (
  <BrandScroller {...props} direction="right" />
);

/* Backwards compat — old import still works */
export default BrandScroller;
