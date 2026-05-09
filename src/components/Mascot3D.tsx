'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [phraseVisible, setPhraseVisible] = useState(false);

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
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!phrases || phrases.length === 0) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const next = phrases[Math.floor(Math.random() * phrases.length)];
    setPhrase(next);
    // Trigger fade-in on next frame
    requestAnimationFrame(() => setPhraseVisible(true));
    timeoutRef.current = setTimeout(() => {
      setPhraseVisible(false);
      timeoutRef.current = setTimeout(() => {
        setPhrase(null);
        timeoutRef.current = null;
      }, 220);
    }, 3000);
  };

  const finalHeight = height ?? width;
  const interactive = Boolean(phrases && phrases.length > 0);

  return (
    <div
      ref={wrapRef}
      className={`dz-mascot-wrap${glow ? ' dz-mascot-glow' : ''}`}
      style={{ width, position: 'relative', cursor: interactive ? 'pointer' : undefined, ...style }}
      onClick={interactive ? handleClick : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
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
      {phrase !== null && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            top: '-10%',
            right: '-8%',
            background: 'white',
            borderRadius: 18,
            padding: '12px 18px',
            boxShadow: '0 12px 32px rgba(36,18,80,0.18)',
            border: '1px solid rgba(115,1,255,0.12)',
            fontWeight: 600,
            fontSize: 15,
            color: '#1a1f3a',
            whiteSpace: 'nowrap',
            opacity: phraseVisible ? 1 : 0,
            transform: phraseVisible ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 220ms ease, transform 220ms ease',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {phrase}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -6,
              left: 22,
              width: 12,
              height: 12,
              background: 'white',
              borderRight: '1px solid rgba(115,1,255,0.12)',
              borderBottom: '1px solid rgba(115,1,255,0.12)',
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      )}
    </div>
  );
}
