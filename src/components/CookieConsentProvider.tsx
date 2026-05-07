'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CookieConsent = {
  essential: true;
  preferences: boolean;
  analytics: boolean;
};

export type StoredConsent = CookieConsent & { decidedAt: string };

type CookieConsentContextValue = {
  consent: CookieConsent | null;
  hasDecided: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  setPartial: (partial: { preferences?: boolean; analytics?: boolean }) => void;
  openPreferences: () => void;
  closePreferences: () => void;
  isPreferencesOpen: boolean;
  isHydrated: boolean;
};

const STORAGE_KEY = 'digizelle-cookie-consent';

/**
 * CNIL recommendation 2020-091 §2.3.1 — proof of consent must be kept
 * fresh. The recommended ceiling is 13 months from the user's last action
 * on the banner; after that we treat the saved choice as expired and
 * re-prompt. We round to milliseconds so the comparison is unambiguous.
 */
const CONSENT_TTL_MS = 13 * 30 * 24 * 60 * 60 * 1000;

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function persist(consent: CookieConsent): StoredConsent {
  const payload: StoredConsent = {
    essential: true,
    preferences: consent.preferences,
    analytics: consent.analytics,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* noop — storage unavailable */
  }
  return payload;
}

function readStored(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      essential: true,
      preferences: Boolean(parsed.preferences),
      analytics: Boolean(parsed.analytics),
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [hasDecided, setHasDecided] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount. Honours the 13-month TTL
  // recommended by the CNIL — an expired record is treated as if the user
  // never decided, so the banner re-shows on next page load.
  // setState-in-effect is intrinsic here: SSR doesn't have access to
  // localStorage so we genuinely need to run after mount.
  useEffect(() => {
    const stored = readStored();
    if (stored) {
      const decidedAt = Date.parse(stored.decidedAt);
      const isExpired = Number.isFinite(decidedAt) && Date.now() - decidedAt > CONSENT_TTL_MS;
      if (isExpired) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* noop */
        }
      } else {
        setConsent({ essential: true, preferences: stored.preferences, analytics: stored.analytics });
        setHasDecided(true);
      }
    }
    setIsHydrated(true);
  }, []);

  const acceptAll = useCallback(() => {
    const next: CookieConsent = { essential: true, preferences: true, analytics: true };
    persist(next);
    setConsent(next);
    setHasDecided(true);
    setIsPreferencesOpen(false);
  }, []);

  const rejectAll = useCallback(() => {
    const next: CookieConsent = { essential: true, preferences: false, analytics: false };
    persist(next);
    setConsent(next);
    setHasDecided(true);
    setIsPreferencesOpen(false);
  }, []);

  const setPartial = useCallback(
    (partial: { preferences?: boolean; analytics?: boolean }) => {
      const base: CookieConsent = consent ?? { essential: true, preferences: true, analytics: false };
      const next: CookieConsent = {
        essential: true,
        preferences: partial.preferences ?? base.preferences,
        analytics: partial.analytics ?? base.analytics,
      };
      persist(next);
      setConsent(next);
      setHasDecided(true);
      setIsPreferencesOpen(false);
    },
    [consent],
  );

  const openPreferences = useCallback(() => setIsPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setIsPreferencesOpen(false), []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      hasDecided,
      acceptAll,
      rejectAll,
      setPartial,
      openPreferences,
      closePreferences,
      isPreferencesOpen,
      isHydrated,
    }),
    [consent, hasDecided, acceptAll, rejectAll, setPartial, openPreferences, closePreferences, isPreferencesOpen, isHydrated],
  );

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent must be used inside <CookieConsentProvider>');
  return ctx;
}
