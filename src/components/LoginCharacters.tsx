'use client';

// Same rationale as animated-characters-login-page.tsx: cursor-tracking
// pupil refs read during render, drive inline transforms only.
/* eslint-disable react-hooks/refs */

/**
 * Login characters — purple / navy / pink / soft trio that reacts to the user
 * filling in the right-side login form. Inspired by aghasisahakyan1's
 * animated-characters-login-page on 21st.dev, rebuilt for Digizelle:
 *
 *  - 4 stylised body shapes (Digizelle violet / pink / navy / soft) instead of
 *    the upstream cartoon palette.
 *  - Eye tracking on cursor with bounded distance per pupil.
 *  - Idle random blinks per character.
 *  - "Looking at each other" gag triggered when an input is focused.
 *  - "Peek at password" gag when password becomes visible (Eye toggle pressed).
 *  - All DOM listeners are attached at mount and torn down on unmount; no
 *    coupling to LoginForm internals — they communicate via the actual
 *    <input> elements through document-level focus / input events.
 *  - Honors prefers-reduced-motion (no follow / blinks).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

interface EyeProps {
  size: number;
  pupilSize: number;
  maxDistance: number;
  pupilColor?: string;
  whiteColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
  hasWhite?: boolean;
  mouseX: number;
  mouseY: number;
}

function Eye({
  size,
  pupilSize,
  maxDistance,
  pupilColor = '#0F0820',
  whiteColor = '#FFFFFF',
  isBlinking = false,
  forceLookX,
  forceLookY,
  hasWhite = true,
  mouseX,
  mouseY,
}: EyeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pupilPos, setPupilPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (forceLookX !== undefined && forceLookY !== undefined) {
      setPupilPos({ x: forceLookX, y: forceLookY });
      return;
    }
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.min(Math.hypot(dx, dy), maxDistance);
    const angle = Math.atan2(dy, dx);
    setPupilPos({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
  }, [mouseX, mouseY, maxDistance, forceLookX, forceLookY]);

  if (!hasWhite) {
    return (
      <div
        ref={ref}
        style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div
          style={{
            width: pupilSize,
            height: pupilSize,
            background: pupilColor,
            borderRadius: '50%',
            transform: `translate(${pupilPos.x}px, ${pupilPos.y}px)`,
            transition: 'transform 0.12s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: isBlinking ? 2 : size,
        background: whiteColor,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'height 0.12s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.10)',
      }}
    >
      {!isBlinking && (
        <div
          style={{
            width: pupilSize,
            height: pupilSize,
            background: pupilColor,
            borderRadius: '50%',
            transform: `translate(${pupilPos.x}px, ${pupilPos.y}px)`,
            transition: 'transform 0.12s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      )}
    </div>
  );
}

export default function LoginCharacters() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [purpleBlink, setPurpleBlink] = useState(false);
  const [navyBlink, setNavyBlink] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lookingAtEachOther, setLookingAtEachOther] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [purplePeek, setPurplePeek] = useState(false);

  const reduced = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /* Mouse tracking — global so eyes follow even off-stage. */
  useEffect(() => {
    if (reduced) return;
    const handler = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [reduced]);

  /* Idle blinks — random 3-7s schedule per character. */
  useEffect(() => {
    if (reduced) return;
    let purpleTimer: ReturnType<typeof setTimeout>;
    let navyTimer: ReturnType<typeof setTimeout>;

    const schedulePurpleBlink = () => {
      const delay = Math.random() * 4000 + 3000;
      purpleTimer = setTimeout(() => {
        setPurpleBlink(true);
        setTimeout(() => {
          setPurpleBlink(false);
          schedulePurpleBlink();
        }, 140);
      }, delay);
    };
    const scheduleNavyBlink = () => {
      const delay = Math.random() * 4000 + 3500;
      navyTimer = setTimeout(() => {
        setNavyBlink(true);
        setTimeout(() => {
          setNavyBlink(false);
          scheduleNavyBlink();
        }, 140);
      }, delay);
    };

    schedulePurpleBlink();
    scheduleNavyBlink();

    return () => {
      clearTimeout(purpleTimer);
      clearTimeout(navyTimer);
    };
  }, [reduced]);

  /* DOM-level coupling with the form: detect focus on inputs and password
     visibility toggling so the characters can react without prop drilling. */
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const isInput = (el: EventTarget | null): el is HTMLElement => {
      if (!el || !(el as Element).tagName) return false;
      const tag = (el as Element).tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA';
    };

    const onFocus = (e: FocusEvent) => {
      if (isInput(e.target)) setIsTyping(true);
    };
    const onBlur = (e: FocusEvent) => {
      if (isInput(e.target)) {
        setIsTyping(false);
      }
    };

    /* Watch the DOM for any password input flipping its `type` attribute via
       the eye toggle. Uses MutationObserver — no coupling to LoginForm. */
    const passwordInputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[name="password"], input[autocomplete="current-password"], input[autocomplete="new-password"], input#password'));

    const updatePwVisibility = () => {
      const inputs = passwordInputs();
      const visible = inputs.some((i) => i.type === 'text' && i.value.length > 0);
      setPasswordVisible(visible);
    };

    const observer = new MutationObserver(updatePwVisibility);
    const inputs = passwordInputs();
    inputs.forEach((i) => {
      observer.observe(i, { attributes: true, attributeFilter: ['type', 'value'] });
      i.addEventListener('input', updatePwVisibility);
    });

    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);

    return () => {
      observer.disconnect();
      inputs.forEach((i) => i.removeEventListener('input', updatePwVisibility));
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  /* "Looking at each other" gag — fires when typing starts, lasts 800ms */
  useEffect(() => {
    if (!isTyping) {
      setLookingAtEachOther(false);
      return;
    }
    setLookingAtEachOther(true);
    const t = setTimeout(() => setLookingAtEachOther(false), 800);
    return () => clearTimeout(t);
  }, [isTyping]);

  /* Sneaky peek — purple peeks at the visible password every 2-5s */
  useEffect(() => {
    if (!passwordVisible || reduced) {
      setPurplePeek(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setPurplePeek(true);
        setTimeout(() => {
          setPurplePeek(false);
          schedule();
        }, 700);
      }, Math.random() * 3000 + 2000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [passwordVisible, reduced]);

  /* Body lean computed from mouse delta vs each character's center */
  const lean = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, skew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 3;
    const dx = mouse.x - cx;
    const dy = mouse.y - cy;
    return {
      faceX: Math.max(-15, Math.min(15, dx / 22)),
      faceY: Math.max(-10, Math.min(10, dy / 32)),
      skew: Math.max(-6, Math.min(6, -dx / 130)),
    };
  };

  const purpleRef = useRef<HTMLDivElement>(null);
  const navyRef = useRef<HTMLDivElement>(null);
  const pinkRef = useRef<HTMLDivElement>(null);
  const softRef = useRef<HTMLDivElement>(null);

  const purpleLean = lean(purpleRef);
  const navyLean = lean(navyRef);
  const pinkLean = lean(pinkRef);
  const softLean = lean(softRef);

  /* Digizelle palette — back to front: deep navy → violet → pink (soft) */
  const colors = {
    purple: '#7301FF',     // brand-violet
    navy: '#24325F',       // brand-navy
    pink: '#F46FB1',       // brand-pink
    soft: '#FFB8DC',       // soft pink
  };

  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        height: 380,
      }}
    >
      {/* Soft glow behind the group */}
      <div
        style={{
          position: 'absolute',
          inset: '20% 0 0 0',
          background:
            'radial-gradient(60% 60% at 50% 70%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 65%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />

      {/* Purple — tall, back layer */}
      <div
        ref={purpleRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '14%',
          width: '32%',
          height: isTyping || passwordVisible ? '110%' : '100%',
          backgroundColor: colors.purple,
          borderRadius: '14px 14px 0 0',
          zIndex: 1,
          boxShadow: '0 14px 40px -12px rgba(115,1,255,0.50)',
          transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
          transform: passwordVisible
            ? 'skewX(0deg)'
            : isTyping
              ? `skewX(${purpleLean.skew - 10}deg) translateX(8%)`
              : `skewX(${purpleLean.skew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 22,
            left: passwordVisible ? '14%' : lookingAtEachOther ? '40%' : `${28 + purpleLean.faceX}%`,
            top: passwordVisible ? '12%' : lookingAtEachOther ? '20%' : `${12 + purpleLean.faceY * 0.4}%`,
            transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <Eye
            size={20}
            pupilSize={8}
            maxDistance={5}
            isBlinking={purpleBlink}
            forceLookX={passwordVisible ? (purplePeek ? 4 : -4) : lookingAtEachOther ? 3 : undefined}
            forceLookY={passwordVisible ? (purplePeek ? 5 : -4) : lookingAtEachOther ? 4 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
          <Eye
            size={20}
            pupilSize={8}
            maxDistance={5}
            isBlinking={purpleBlink}
            forceLookX={passwordVisible ? (purplePeek ? 4 : -4) : lookingAtEachOther ? 3 : undefined}
            forceLookY={passwordVisible ? (purplePeek ? 5 : -4) : lookingAtEachOther ? 4 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
        </div>
      </div>

      {/* Navy — slim, middle layer */}
      <div
        ref={navyRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '46%',
          width: '20%',
          height: '78%',
          backgroundColor: colors.navy,
          borderRadius: '10px 10px 0 0',
          zIndex: 2,
          boxShadow: '0 14px 36px -12px rgba(36,50,95,0.65)',
          transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
          transform: passwordVisible
            ? 'skewX(0deg)'
            : lookingAtEachOther
              ? `skewX(${navyLean.skew * 1.4 + 8}deg) translateX(6%)`
              : isTyping
                ? `skewX(${navyLean.skew * 1.5}deg)`
                : `skewX(${navyLean.skew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 14,
            left: passwordVisible ? '12%' : lookingAtEachOther ? '32%' : `${22 + navyLean.faceX * 0.8}%`,
            top: passwordVisible ? '10%' : lookingAtEachOther ? '6%' : `${14 + navyLean.faceY * 0.4}%`,
            transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <Eye
            size={16}
            pupilSize={6}
            maxDistance={4}
            isBlinking={navyBlink}
            forceLookX={passwordVisible ? -4 : lookingAtEachOther ? 0 : undefined}
            forceLookY={passwordVisible ? -4 : lookingAtEachOther ? -3 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
          <Eye
            size={16}
            pupilSize={6}
            maxDistance={4}
            isBlinking={navyBlink}
            forceLookX={passwordVisible ? -4 : lookingAtEachOther ? 0 : undefined}
            forceLookY={passwordVisible ? -4 : lookingAtEachOther ? -3 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
        </div>
      </div>

      {/* Soft pink — semi-circle, front-left */}
      <div
        ref={softRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '44%',
          height: '50%',
          backgroundColor: colors.soft,
          borderRadius: '120px 120px 0 0',
          zIndex: 3,
          boxShadow: '0 16px 40px -14px rgba(255,184,220,0.65)',
          transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
          transform: passwordVisible ? 'skewX(0deg)' : `skewX(${softLean.skew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 24,
            left: passwordVisible ? '20%' : `${32 + softLean.faceX * 0.6}%`,
            top: passwordVisible ? '40%' : `${42 + softLean.faceY * 0.5}%`,
            transition: 'all 0.2s ease-out',
          }}
        >
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            hasWhite={false}
            forceLookX={passwordVisible ? -5 : undefined}
            forceLookY={passwordVisible ? -4 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            hasWhite={false}
            forceLookX={passwordVisible ? -5 : undefined}
            forceLookY={passwordVisible ? -4 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
        </div>
      </div>

      {/* Pink — rounded-top tall, front-right */}
      <div
        ref={pinkRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: '60%',
          width: '26%',
          height: '58%',
          backgroundColor: colors.pink,
          borderRadius: '70px 70px 0 0',
          zIndex: 4,
          boxShadow: '0 16px 40px -14px rgba(244,111,177,0.65)',
          transition: 'all 0.7s cubic-bezier(0.16,1,0.3,1)',
          transform: passwordVisible ? 'skewX(0deg)' : `skewX(${pinkLean.skew}deg)`,
          transformOrigin: 'bottom center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 18,
            left: passwordVisible ? '14%' : `${30 + pinkLean.faceX * 0.6}%`,
            top: passwordVisible ? '20%' : `${22 + pinkLean.faceY * 0.5}%`,
            transition: 'all 0.2s ease-out',
          }}
        >
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            hasWhite={false}
            forceLookX={passwordVisible ? -5 : undefined}
            forceLookY={passwordVisible ? -4 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
          <Eye
            size={12}
            pupilSize={12}
            maxDistance={5}
            hasWhite={false}
            forceLookX={passwordVisible ? -5 : undefined}
            forceLookY={passwordVisible ? -4 : undefined}
            mouseX={mouse.x}
            mouseY={mouse.y}
          />
        </div>
        {/* Smile line */}
        <div
          style={{
            position: 'absolute',
            width: '50%',
            height: 4,
            background: '#0F0820',
            borderRadius: 999,
            left: passwordVisible ? '14%' : `${24 + pinkLean.faceX * 0.5}%`,
            top: passwordVisible ? '50%' : `${52 + pinkLean.faceY * 0.5}%`,
            transition: 'all 0.2s ease-out',
          }}
        />
      </div>
    </div>
  );
}
