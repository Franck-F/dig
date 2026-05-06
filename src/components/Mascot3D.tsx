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
  style?: React.CSSProperties;
  phrases?: string[];
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
