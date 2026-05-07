'use client';

import { useEffect, useRef } from 'react';

/**
 * Lock keyboard focus inside a container while it's open. Used by every
 * modal/dialog in the app to satisfy WCAG 2.1.1 Keyboard + 2.4.3 Focus
 * Order — without it, Tab cycles to elements behind the dialog (which
 * users can't see), and a screen reader user can find herself
 * navigating outside the modal she just opened.
 *
 * Behaviour:
 *  - On open: capture the previously-focused element, focus the first
 *    focusable element inside the container.
 *  - While open: Tab and Shift+Tab wrap inside the container.
 *  - On close: restore focus to whatever was focused before open.
 *
 * Returns a ref callback to attach to the dialog root. The ref is
 * intentionally a callback rather than a normal `useRef` so callers
 * can use it without a useEffect to wire up focus on first render.
 *
 * Usage:
 * ```tsx
 * const dialogRef = useFocusTrap(open);
 * return open ? <div ref={dialogRef} role="dialog" aria-modal="true">…</div> : null;
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
): (node: T | null) => void {
  const nodeRef = useRef<T | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const node = nodeRef.current;
    if (!node) return;

    // Remember whoever had focus when the modal opened so we can
    // restore it on close.
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;

    // Move focus to the first focusable element inside the modal. If
    // none, focus the dialog root itself (it must have tabIndex=-1
    // for that to work — we set it programmatically as a fallback).
    const focusables = getFocusable(node);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      node.tabIndex = -1;
      node.focus();
    }

    // Tab key wrapping. We capture in the bubbling phase so element-
    // level handlers (e.g. native form behaviour) still run first.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = getFocusable(node);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !node.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const target = restoreRef.current;
      restoreRef.current = null;
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
    };
  }, [isOpen]);

  return (node) => {
    nodeRef.current = node;
  };
}

/**
 * Selectors for elements considered keyboard-focusable. Mirrors the
 * conventional list used by react-aria et al. — disabled, aria-hidden
 * and negative tabindex are excluded explicitly.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      !el.hasAttribute('aria-hidden') &&
      el.offsetParent !== null,
  );
}
