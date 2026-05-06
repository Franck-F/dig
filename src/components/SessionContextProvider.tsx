'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Lightweight client-side session context.
 *
 * The full session is resolved server-side in `app/layout.tsx` via `auth()`
 * and just enough surface (name + role flag) is forwarded here so client
 * components like `Header` can branch on auth state without polling
 * `/api/auth/session` (which is what `next-auth/react`'s `SessionProvider`
 * does and which we don't want for a marketing-heavy site).
 */

export type SessionInfo = {
  isAuthenticated: boolean;
  name: string | null;
  initial: string | null;
  role: 'STUDENT' | 'MENTOR' | 'PARTNER' | 'ADMIN' | null;
  hasMentorProfile: boolean;
  hasMenteeProfile: boolean;
};

const empty: SessionInfo = {
  isAuthenticated: false,
  name: null,
  initial: null,
  role: null,
  hasMentorProfile: false,
  hasMenteeProfile: false,
};

const Ctx = createContext<SessionInfo>(empty);

export function SessionContextProvider({
  value,
  children,
}: {
  value: SessionInfo;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientSession(): SessionInfo {
  return useContext(Ctx);
}
