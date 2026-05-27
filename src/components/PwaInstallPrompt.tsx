'use client';

import { useEffect, useState } from 'react';

/**
 * Discreet install-as-app prompt.
 *
 * The browser fires `beforeinstallprompt` when the page is installable
 * (manifest + SW + heuristics). We stash the event, surface a small
 * bottom-right card with two buttons:
 *
 *   - "Installer" → calls `event.prompt()` and tracks the outcome.
 *   - "Plus tard" → dismisses for 30 days via localStorage.
 *
 * Hidden entirely on:
 *   - iOS Safari (no support — we'd need a custom A2HS tutorial, not a
 *     prompt, so we skip rather than mislead),
 *   - users who already dismissed within 30 days,
 *   - users running in standalone mode (already installed).
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'digizelle-pwa-install-dismissed-at';
const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function recentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = parseInt(raw, 10);
    if (Number.isNaN(at)) return false;
    return Date.now() - at < DISMISS_WINDOW_MS;
  } catch {
    return false;
  }
}

export default function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Already in standalone mode? Bail.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !event) return null;

  const onInstall = async () => {
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'dismissed') {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          /* localStorage blocked — silent */
        }
      }
    } catch {
      /* prompt() rejected — fall through, hide either way */
    } finally {
      setVisible(false);
      setEvent(null);
    }
  };

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* localStorage blocked — silent */
    }
    setVisible(false);
    setEvent(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Installer l’application Digizelle"
      style={{
        position: 'fixed',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        right: 'max(16px, env(safe-area-inset-right))',
        zIndex: 1000,
        maxWidth: 320,
        padding: 16,
        borderRadius: 16,
        background: 'rgba(15, 10, 46, 0.95)',
        color: '#ffffff',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontFamily: 'var(--font-signika), system-ui, sans-serif',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
        Installer Digizelle
      </div>
      <p style={{ fontSize: 13, margin: '0 0 12px', opacity: 0.85, lineHeight: 1.4 }}>
        Accédez à votre espace mentorat depuis votre écran d’accueil, sans navigateur.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onInstall}
          style={{
            flex: '1 1 auto',
            padding: '8px 14px',
            background: '#7301FF',
            color: '#ffffff',
            border: 'none',
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Installer
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            flex: '0 0 auto',
            padding: '8px 12px',
            background: 'transparent',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 999,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
