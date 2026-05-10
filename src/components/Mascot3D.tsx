'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

type Mascot3DProps = {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  intensity?: number;
  float?: boolean;
  glow?: boolean;
  priority?: boolean;
  /**
   * Forwarded to Next.js Image's `sizes` so responsive variants are
   * picked correctly. Defaults to `(max-width: 900px) 80vw, 580px` to
   * match the hero grid on the home page.
   */
  sizes?: string;
  style?: React.CSSProperties;
  /**
   * If provided, hovering (or tapping) the mascot pops up speech
   * bubbles — multiple at a time, drawn at fixed cardinal slots
   * around the mascot so they don't overlap. Bubbles fade out
   * automatically after a few seconds.
   */
  phrases?: string[];
};

/**
 * Pre-generated 10×10 LQIP blur placeholders, base64 PNG, one per
 * mascot file. Generated once via sharp (see commit notes) and inlined
 * here so the hero LCP image fades in from a coloured blur instead of
 * a blank rect — no extra network round-trip and no per-render cost.
 */
const MASCOT_BLUR_DATA_URLS: Record<string, string> = {
  '/images/robot-mascotte.png':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAANlBMVEVQMYCHYMVzVbNWRZnJtNI+On0QGD9DN4GIXcuHV8qAYrd/WsFhRqS4qMCrlMqVcdrMl/+be8vBQP1uAAAADnRSTlMB749P/WsNJZxdx3a1+3b1zSkAAAAJcEhZcwAALiMAAC4jAXilP3YAAABESURBVHicTcRJEsAgCATAYRFQI+r/P+shqZR9aODmfzXqF6dm7anZ0cbIYFUNWNskQrsZnFa4xyKH8RSgTwasPOXtcgBoDgH6hdJuIwAAAABJRU5ErkJggg==',
  '/images/robot-mascotte-1.png':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAMFBMVEWOdaVVT5NoTayKXcfKm+qhf8mgZ9zFqMmqn7yOc79OW4Z8XLiBUMR8Vr17aqt5WLvE0KULAAAAD3RSTlMBJjbZ/f32/v4fUl/Be93WIwchAAAACXBIWXMAAC4jAAAuIwF4pT92AAAARUlEQVR4nDWMyQ0AIQwDDTk503+3iLD7sUYj2wCA0m8mrVUfVWGWkU7d3fX6RmZmVFJvkf2Vp+p8NII5cgb0iP+4ETUAB0iHAXYheLpFAAAAAElFTkSuQmCC',
  '/images/robot-mascotte-2.png':
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAMAAAC67D+PAAAAOVBMVEVMaXFDO4eKZcG1qbl7UL91VLiKXcokMWVIO4uDVMaddNSRbdrBjPCSYdKNeLHSnfqzl8nKtNqkisHaSsO0AAAAEHRSTlMAVfz4lOyrHzJZ/g74ytz+iRuQKQAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAENJREFUeJw1jFkOACEMQhntprNV73/YidPKB7wQAgBAj+W/VDc1kZY0x+jB96zVJZaPe7FYUC95YfxeWcKY99tJtPIDTQwBbHygSHMAAAAASUVORK5CYII=',
};

/** Fixed slots so bubbles stack cleanly around the mascot rather
 *  than piling on top of each other. Each call cycles through them
 *  in order, then loops.
 *
 *  Coordinates are deliberately INSIDE the wrap (positive offsets)
 *  so the bubbles don't clip into the sticky navbar above or the
 *  hero text on the left. They sit near the mascot's head area
 *  (vertical 8–35 % is where the faces actually are in the PNG). */
const BUBBLE_SLOTS: Array<{
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  /** Translate applied so the slot anchor lines up nicely. */
  translate?: string;
  tail: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}> = [
  // Just above the mascots' heads, centred.
  { top: '6%', left: '50%', translate: 'translateX(-50%)', tail: 'bottom-left' },
  // Right of the right mascot's head — bubble points down-left toward it.
  { top: '22%', right: '4%', tail: 'bottom-left' },
  // Left of the left mascot's head — bubble points down-right toward it.
  { top: '22%', left: '4%', tail: 'bottom-right' },
  // Top-left, slightly higher — for a 4th concurrent bubble.
  { top: '8%', left: '12%', tail: 'bottom-right' },
];

type ActiveBubble = {
  id: number;
  text: string;
  slot: number;
  visible: boolean;
};

const MAX_VISIBLE_BUBBLES = 3;
const BUBBLE_LIFETIME_MS = 3500;
const BUBBLE_FADE_MS = 220;

export default function Mascot3D({
  src,
  // Empty default ⇒ decorative; callers should pass a translated alt
  // (e.g. t('common.mascotAlt')) when the mascot is the primary visual.
  alt = '',
  width = 320,
  height,
  intensity = 18,
  float = true,
  glow = true,
  priority = false,
  sizes = '(max-width: 900px) 80vw, 580px',
  style,
  phrases,
}: Mascot3DProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const slotIdxRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const tilt = tiltRef.current;
    if (!wrap || !tilt) return;

    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${x * intensity}deg) rotateX(${-y * intensity}deg) translateZ(0)`;
    };
    const onLeave = () => {
      tilt.style.transform = 'rotateY(0) rotateX(0)';
    };

    const frame = (wrap.closest('.dz-frame') as HTMLElement | null) ?? wrap;
    frame.addEventListener('mousemove', onMove);
    frame.addEventListener('mouseleave', onLeave);
    return () => {
      frame.removeEventListener('mousemove', onMove);
      frame.removeEventListener('mouseleave', onLeave);
    };
  }, [intensity]);

  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  /** Spawn a new bubble. Throttled so a single hover doesn't fire a
   *  swarm — at most one bubble every 350ms. */
  const spawnBubble = useCallback(() => {
    if (!phrases || phrases.length === 0) return;
    const now = Date.now();
    if (now - lastSpawnRef.current < 350) return;
    lastSpawnRef.current = now;

    const id = ++idRef.current;
    const text = phrases[Math.floor(Math.random() * phrases.length)];
    const slot = slotIdxRef.current % BUBBLE_SLOTS.length;
    slotIdxRef.current += 1;

    setBubbles((prev) => {
      // Cap concurrent bubbles. When at the cap, evict the oldest
      // (FIFO) — its slot is freed for the new one.
      const next = prev.length >= MAX_VISIBLE_BUBBLES ? prev.slice(1) : prev;
      return [...next, { id, text, slot, visible: false }];
    });

    // Fade in on the next frame so the CSS transition runs.
    const showT = setTimeout(() => {
      setBubbles((prev) => prev.map((b) => (b.id === id ? { ...b, visible: true } : b)));
      timeoutsRef.current.delete(showT);
    }, 16);
    timeoutsRef.current.add(showT);

    // Schedule fade-out + removal.
    const hideT = setTimeout(() => {
      setBubbles((prev) => prev.map((b) => (b.id === id ? { ...b, visible: false } : b)));
      timeoutsRef.current.delete(hideT);
      const removeT = setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== id));
        timeoutsRef.current.delete(removeT);
      }, BUBBLE_FADE_MS);
      timeoutsRef.current.add(removeT);
    }, BUBBLE_LIFETIME_MS);
    timeoutsRef.current.add(hideT);
  }, [phrases]);

  const finalHeight = height ?? width;
  const interactive = Boolean(phrases && phrases.length > 0);

  return (
    <div
      ref={wrapRef}
      className={`dz-mascot-wrap${glow ? ' dz-mascot-glow' : ''}`}
      style={{ width, position: 'relative', cursor: interactive ? 'pointer' : undefined, ...style }}
      onMouseEnter={interactive ? spawnBubble : undefined}
      onMouseMove={interactive ? spawnBubble : undefined}
      onTouchStart={interactive ? spawnBubble : undefined}
      onFocus={interactive ? spawnBubble : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                spawnBubble();
              }
            }
          : undefined
      }
    >
      <div ref={tiltRef} className={`dz-mascot-tilt${float ? ' dz-mascot-float' : ''}`}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={finalHeight}
          priority={priority}
          // Tells the browser to start downloading the LCP image
          // alongside the HTML/CSS instead of after layout. `priority`
          // already implies fetchpriority high in Next.js 16, but we
          // keep this explicit so non-priority callers (secondary
          // mascots) opt in only when they are the LCP.
          fetchPriority={priority ? 'high' : 'auto'}
          sizes={sizes}
          // Coloured 10×10 blur preview while the full image streams
          // in. Falls back to "empty" for callers that pass a custom
          // src not in the pre-baked map.
          placeholder={MASCOT_BLUR_DATA_URLS[src] ? 'blur' : 'empty'}
          blurDataURL={MASCOT_BLUR_DATA_URLS[src]}
          draggable={false}
          className="dz-mascot-img"
          style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none' }}
        />
      </div>
      {bubbles.map((b) => {
        const slot = BUBBLE_SLOTS[b.slot];
        const tail = slot.tail;
        const baseTranslate = slot.translate ?? '';
        const restTransform = b.visible
          ? 'translateY(0) scale(1)'
          : 'translateY(-6px) scale(0.92)';
        const combinedTransform = `${baseTranslate} ${restTransform}`.trim();
        return (
          <div
            key={b.id}
            aria-live="polite"
            className="dz-mascot-bubble"
            style={{
              position: 'absolute',
              top: slot.top,
              right: slot.right,
              bottom: slot.bottom,
              left: slot.left,
              background: 'white',
              borderRadius: 18,
              padding: '10px 16px',
              boxShadow: '0 12px 32px rgba(36,18,80,0.18)',
              border: '1px solid rgba(115,1,255,0.14)',
              fontWeight: 600,
              fontSize: 14,
              color: '#1a1f3a',
              maxWidth: 240,
              lineHeight: 1.35,
              opacity: b.visible ? 1 : 0,
              transform: combinedTransform,
              transition: `opacity ${BUBBLE_FADE_MS}ms ease, transform ${BUBBLE_FADE_MS}ms ease`,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            {b.text}
            <span
              aria-hidden
              style={{
                position: 'absolute',
                bottom: tail.startsWith('bottom') ? -6 : undefined,
                top: tail.startsWith('top') ? -6 : undefined,
                left: tail.endsWith('left') ? 22 : undefined,
                right: tail.endsWith('right') ? 22 : undefined,
                width: 12,
                height: 12,
                background: 'white',
                borderRight:
                  tail === 'bottom-left' || tail === 'top-right'
                    ? '1px solid rgba(115,1,255,0.14)'
                    : 'none',
                borderBottom: tail.startsWith('bottom')
                  ? '1px solid rgba(115,1,255,0.14)'
                  : 'none',
                borderLeft:
                  tail === 'bottom-right' || tail === 'top-left'
                    ? '1px solid rgba(115,1,255,0.14)'
                    : 'none',
                borderTop: tail.startsWith('top') ? '1px solid rgba(115,1,255,0.14)' : 'none',
                transform: 'rotate(45deg)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
