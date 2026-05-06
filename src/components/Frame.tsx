'use client';

import Header from './Header';
import { CinematicFooter } from './motion-footer';
import { useTheme } from './ThemeProvider';

type FrameProps = {
  active?: string;
  children: React.ReactNode;
};

export default function Frame({ active, children }: FrameProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`dz-frame ${isDark ? '--dark' : '--soft'}`} data-screen-label={active}>
      <Header />
      {children}
      <CinematicFooter />
    </div>
  );
}
