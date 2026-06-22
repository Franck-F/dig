'use client';

import { useState } from 'react';
import Header from './Header';
import { CinematicFooter } from './motion-footer';
import { useTheme } from './ThemeProvider';

type FrameProps = {
  active?: string;
  children: React.ReactNode;
  /**
   * Hide the cinematic footer on this route. Used by short, focused
   * pages (login, signup, 2FA) where the footer would push the form
   * below the fold and add visual noise without bringing useful
   * navigation cues — those are already in the Header.
   */
  hideFooter?: boolean;
};

export default function Frame({ active, children, hideFooter }: FrameProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [skipFocused, setSkipFocused] = useState(false);

  return (
    <div className={`dz-frame ${isDark ? '--dark' : '--soft'}`} data-screen-label={active}>
      <a
        href="#main-content"
        onFocus={() => setSkipFocused(true)}
        onBlur={() => setSkipFocused(false)}
        style={skipFocused ? SKIP_LINK_VISIBLE : SKIP_LINK_HIDDEN}
      >
        Aller au contenu principal
      </a>
      <Header />
      {/* display:contents keeps the existing visual layout byte-for-byte while
          exposing a <main> landmark + skip-link target (WCAG 2.4.1 / 1.3.1). */}
      <main id="main-content" tabIndex={-1} style={{ display: 'contents' }}>
        {children}
      </main>
      {!hideFooter && <CinematicFooter />}
    </div>
  );
}

const SKIP_LINK_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  left: -9999,
  top: 0,
  width: 1,
  height: 1,
  overflow: 'hidden',
};

const SKIP_LINK_VISIBLE: React.CSSProperties = {
  position: 'fixed',
  left: 12,
  top: 12,
  zIndex: 2000,
  padding: '10px 16px',
  borderRadius: 10,
  background: '#7301FF',
  color: '#fff',
  fontWeight: 700,
  fontSize: 14,
  textDecoration: 'none',
};
