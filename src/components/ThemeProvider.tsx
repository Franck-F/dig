'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useCookieConsent } from './CookieConsentProvider';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'digizelle-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { consent, isHydrated } = useCookieConsent();
  const [theme, setThemeState] = useState<Theme>('light');
  // Track whether we've already pulled an initial value, so that toggling
  // consent later doesn't clobber the user's current in-session theme.
  const [didInit, setDidInit] = useState(false);

  // Initial read: only consult localStorage if preferences consent is granted,
  // and only to restore an explicit user choice. With no saved choice the
  // default at launch is always light (we deliberately ignore the system's
  // prefers-color-scheme so the app opens in light mode by default).
  // SSR has no DOM/localStorage; the post-mount effect is the only
  // place we can read them, hence setState-in-effect is intrinsic.
  useEffect(() => {
    if (didInit || !isHydrated) return;
    if (typeof window === 'undefined') return;

    const allowStorage = consent?.preferences === true;
    if (allowStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === 'dark' || saved === 'light') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage theme → state sync
        setThemeState(saved);
        setDidInit(true);
        return;
      }
    }
    setDidInit(true);
  }, [consent, isHydrated, didInit]);

  // Apply theme to body, and persist only when preferences consent allows it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('dz-theme-dark', theme === 'dark');

    if (!isHydrated) return;
    if (consent?.preferences === true) {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* noop */
      }
    } else {
      // No consent: ensure no stale theme remains in storage.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
    }
  }, [theme, consent, isHydrated]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
