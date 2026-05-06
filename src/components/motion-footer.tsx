"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ----------------------------------------------------------------
 * Magnetic primitive — same idea as upstream, no external deps.
 * Bails out cleanly under prefers-reduced-motion.
 * ---------------------------------------------------------------- */
type MagneticProps = React.HTMLAttributes<HTMLElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: React.ElementType;
    href?: string;
  };

const Magnetic = React.forwardRef<HTMLElement, MagneticProps>(
  ({ className, children, as: Component = "button", ...props }, forwardedRef) => {
    const localRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
      if (typeof window === "undefined") return;
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) return;
      const el = localRef.current;
      if (!el) return;

      const handleMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(el, {
          x: x * 0.35,
          y: y * 0.35,
          rotationX: -y * 0.12,
          rotationY: x * 0.12,
          scale: 1.04,
          ease: "power2.out",
          duration: 0.4,
        });
      };

      const handleLeave = () => {
        gsap.to(el, {
          x: 0,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          ease: "elastic.out(1, 0.35)",
          duration: 1.1,
        });
      };

      el.addEventListener("mousemove", handleMove as EventListener);
      el.addEventListener("mouseleave", handleLeave);
      return () => {
        el.removeEventListener("mousemove", handleMove as EventListener);
        el.removeEventListener("mouseleave", handleLeave);
      };
    }, []);

    return (
      <Component
        ref={(node: HTMLElement) => {
          localRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef && node) (forwardedRef as React.MutableRefObject<HTMLElement | null>).current = node;
        }}
        className={cn(
          "cursor-pointer inline-block will-change-transform",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
);
Magnetic.displayName = "Magnetic";

/* ----------------------------------------------------------------
 * Marquee row — values rotate horizontally behind the heading.
 * Strings come from i18n.
 * ---------------------------------------------------------------- */
function MarqueeRow({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-12 px-6">
      {items.flatMap((item, i) => [
        <span key={`item-${i}`} className="text-foreground/85">
          {item}
        </span>,
        <span key={`sep-${i}`} className="text-[var(--brand-pink)]" aria-hidden>
          ✦
        </span>,
      ])}
    </div>
  );
}

/* ----------------------------------------------------------------
 * Curtain footer — replaces the old `CinematicFooter` from the upstream
 * 21st.dev component. Keeps the curtain-reveal trick (clip-path + fixed
 * footer underneath) and the GSAP scroll-triggered parallax, but every
 * piece of copy is locale-aware and the palette is Digizelle.
 * ---------------------------------------------------------------- */
export function CinematicFooter() {
  const tFooter = useTranslations("footer");
  const tCommon = useTranslations("common");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const giantTextRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!wrapperRef.current) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantTextRef.current,
        { y: "10vh", scale: 0.85, opacity: 0 },
        {
          y: "0vh",
          scale: 1,
          opacity: 1,
          ease: "power1.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 90%",
            end: "bottom bottom",
            scrub: 1,
          },
        },
      );

      gsap.fromTo(
        [headingRef.current, contentRef.current],
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.18,
          ease: "power3.out",
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top 50%",
            end: "bottom bottom",
            scrub: 1,
          },
        },
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // i18n bundles
  const marqueeItems = (tFooter.raw("marquee") as string[]) ?? [];
  const navColumns = tFooter.raw("nav") as Record<string, { title: string; links: { label: string; href: string }[] }>;
  const wordmark = tFooter("wordmark");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FOOTER_STYLES }} />
      <div
        ref={wrapperRef}
        className="dz-cinematic-footer-wrap relative h-[100vh] w-full"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}
      >
        <footer className="dz-cinematic-footer fixed bottom-0 left-0 z-0 flex h-[100vh] w-full flex-col justify-between overflow-hidden">
          {/* Aurora + grid background */}
          <div className="dz-cinematic-aurora pointer-events-none absolute left-1/2 top-1/2 z-0 h-[65vh] w-[85vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] blur-[90px]" />
          <div className="dz-cinematic-grid pointer-events-none absolute inset-0 z-0" />

          {/* Giant background wordmark */}
          <div
            ref={giantTextRef}
            className="dz-cinematic-giant pointer-events-none absolute -bottom-[6vh] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap"
          >
            {wordmark}
          </div>

          {/* Diagonal marquee */}
          <div className="dz-cinematic-marquee absolute left-0 top-12 z-10 w-full -rotate-2 scale-110 overflow-hidden border-y border-white/15 bg-[rgba(20,12,52,0.55)] py-4 backdrop-blur-md shadow-2xl">
            <div className="flex w-max animate-footer-scroll-marquee text-xs md:text-sm font-bold tracking-[0.32em] uppercase text-white/85">
              <MarqueeRow items={marqueeItems} />
              <MarqueeRow items={marqueeItems} />
            </div>
          </div>

          {/* Center content */}
          <div className="relative z-10 mt-24 flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 mx-auto">
            <h2
              ref={headingRef}
              className="dz-cinematic-heading mb-10 text-center text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter"
            >
              {tFooter("heading")}
            </h2>

            <div ref={contentRef} className="flex w-full flex-col items-center gap-8">
              {/* Primary CTAs */}
              <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                <Magnetic
                  as={Link}
                  href="/contact"
                  className="dz-cinematic-pill --primary"
                  aria-label={tFooter("ctaJoin")}
                >
                  <span>{tFooter("ctaJoin")}</span>
                </Magnetic>
                <Magnetic
                  as={Link}
                  href="/mentora"
                  className="dz-cinematic-pill"
                >
                  <span>{tFooter("ctaMentora")}</span>
                </Magnetic>
                <Magnetic
                  as={Link}
                  href="/community"
                  className="dz-cinematic-pill"
                >
                  <span>{tFooter("ctaCommunity")}</span>
                </Magnetic>
              </div>

              {/* Nav columns */}
              <nav
                aria-label={tFooter("navAriaLabel")}
                className="grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-4 md:gap-2 mt-2"
              >
                {Object.entries(navColumns).map(([key, col]) => (
                  <div key={key} className="flex flex-col gap-2 text-center md:text-left">
                    <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                      {col.title}
                    </h3>
                    <ul className="flex flex-col gap-1.5 text-sm font-medium">
                      {col.links.map((l) => (
                        <li key={l.href}>
                          <Link
                            href={l.href}
                            className="text-white/80 hover:text-white transition-colors duration-200"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="relative z-20 flex w-full flex-col items-center justify-between gap-5 px-6 pb-8 md:flex-row md:px-12">
            <div className="order-2 text-[10px] md:text-xs font-semibold uppercase tracking-widest text-white/55 md:order-1">
              {tFooter("copyright", { year: new Date().getFullYear() })}
            </div>

            <Magnetic
              as="button"
              type="button"
              onClick={scrollToTop}
              aria-label={tCommon("backToTop")}
              className="dz-cinematic-arrow order-1 md:order-2"
            >
              <svg className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </Magnetic>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------
 * Scoped styles — kept inline so the footer is self-contained and
 * doesn't depend on tailwind tokens that may shift in dark mode.
 * ---------------------------------------------------------------- */
const FOOTER_STYLES = `
.dz-cinematic-footer {
  background:
    radial-gradient(80% 60% at 18% 10%, rgba(115,1,255,0.55), transparent 70%),
    radial-gradient(70% 60% at 80% 0%, rgba(244,111,177,0.40), transparent 65%),
    linear-gradient(180deg, #1a1240 0%, #0d0823 100%);
  color: #fff;
  font-family: var(--font-signika), 'Signika', 'SF Pro Display', system-ui, sans-serif;
}

.dz-cinematic-aurora {
  background: radial-gradient(circle at 50% 50%, rgba(163,75,245,0.55) 0%, rgba(115,1,255,0.30) 35%, transparent 70%);
  animation: dz-cinematic-breathe 9s ease-in-out infinite alternate;
}

.dz-cinematic-grid {
  background-size: 64px 64px;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 25%, #000 75%, transparent);
}

.dz-cinematic-giant {
  font-size: clamp(120px, 22vw, 360px);
  line-height: 0.78;
  font-weight: 900;
  letter-spacing: -0.05em;
  color: transparent;
  -webkit-text-stroke: 1px rgba(255,255,255,0.10);
  background: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 60%);
  -webkit-background-clip: text;
  background-clip: text;
}

.dz-cinematic-heading {
  background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.45) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 30px rgba(255,255,255,0.18));
}

@keyframes dz-cinematic-breathe {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.55; }
  100% { transform: translate(-50%, -50%) scale(1.12); opacity: 0.95; }
}
@keyframes dz-cinematic-marq {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@keyframes dz-cinematic-heart {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(244,111,177,0.55)); }
  15%, 45% { transform: scale(1.18); filter: drop-shadow(0 0 12px rgba(244,111,177,0.85)); }
  30% { transform: scale(1); }
}

.animate-footer-scroll-marquee { animation: dz-cinematic-marq 38s linear infinite; }
.animate-footer-heartbeat { animation: dz-cinematic-heart 2s cubic-bezier(0.25,1,0.5,1) infinite; }

/* Liquid pill — adapted to dark cinematic palette */
.dz-cinematic-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(255,255,255,0.95);
  text-decoration: none;
  background: linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%);
  border: 1px solid rgba(255,255,255,0.14);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.18) inset,
    0 -1px 1px rgba(0,0,0,0.30) inset,
    0 14px 40px -12px rgba(0,0,0,0.45);
  transition: all 0.45s cubic-bezier(0.16,1,0.3,1);
  cursor: pointer;
}
.dz-cinematic-pill::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 50%, rgba(163,75,245,0.50) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.dz-cinematic-pill:hover {
  background: linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%);
  border-color: rgba(255,255,255,0.30);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.30) inset,
    0 -1px 1px rgba(0,0,0,0.30) inset,
    0 22px 50px -14px rgba(115,1,255,0.55);
}
.dz-cinematic-pill.--primary {
  background: linear-gradient(145deg, rgba(115,1,255,0.95) 0%, rgba(163,75,245,0.85) 100%);
  border-color: rgba(255,255,255,0.30);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.45) inset,
    0 -1px 1px rgba(0,0,0,0.30) inset,
    0 16px 40px -10px rgba(115,1,255,0.65);
}
.dz-cinematic-pill.--static { cursor: default; }
.dz-cinematic-pill.--static:hover { transform: none; }

.dz-cinematic-arrow {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%);
  border: 1px solid rgba(255,255,255,0.18);
  color: rgba(255,255,255,0.85);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
  transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
  cursor: pointer;
}
.dz-cinematic-arrow:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.45);
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .dz-cinematic-marquee { top: 6px; }
  .dz-cinematic-heading { font-size: 36px !important; }
  .dz-cinematic-pill { padding: 10px 18px; font-size: 0.8rem; }
}
@media (prefers-reduced-motion: reduce) {
  .dz-cinematic-aurora,
  .animate-footer-scroll-marquee,
  .animate-footer-heartbeat { animation: none !important; }
}
`;

export default CinematicFooter;
