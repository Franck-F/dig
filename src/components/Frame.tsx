'use client';

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

  return (
    <div className={`dz-frame ${isDark ? '--dark' : '--soft'}`} data-screen-label={active}>
      <Header />
      {children}
      {!hideFooter && <CinematicFooter />}
    </div>
  );
}
