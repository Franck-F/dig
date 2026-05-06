import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js configuration.
 *
 * No Prisma, no bcrypt — both incompatible with the Edge runtime used by
 * Next.js middleware. The full configuration (DB-backed providers + adapter)
 * is composed in `src/auth.ts`, which runs only on the Node runtime.
 *
 * See: https://authjs.dev/guides/edge-compatibility
 *
 * Generate AUTH_SECRET with: openssl rand -base64 32
 */
export const authConfig = {
  pages: { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt' },
  // Providers that need the DB live in `src/auth.ts`.
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },

    /**
     * signIn — last gate before a session is issued.
     *
     * - OAuth providers: always allowed; the provider has already verified
     *   the email. The first-time `emailVerified` stamp is set in the
     *   `events.signIn` handler in `src/auth.ts` (Node-only, needs Prisma).
     * - Credentials: when `authorize()` returns a user that has a
     *   passwordHash but no `emailVerified`, reject the sign-in. The UI
     *   short-circuits this path in `signIn` action by checking
     *   `emailVerified` before calling NextAuth, so this is a defence in
     *   depth.
     */
    async signIn({ user, account }) {
      if (account?.provider !== 'credentials') return true;
      // `user` here is whatever `authorize()` returned. Our authorize
      // already filters unverified users, but keep this guard.
      const u = user as { emailVerified?: Date | null } | null;
      if (u && u.emailVerified === null) return false;
      return true;
    },

    /**
     * redirect — controls the post-login destination.
     *
     * Auth.js calls this with `url` = the requested callbackUrl (or the
     * page the user came from). If the URL is same-origin we honour it;
     * otherwise default to `/app` (the post-login Hub).
     */
    async redirect({ url, baseUrl }) {
      try {
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
      } catch {
        /* fall through to default */
      }
      return `${baseUrl}/app`;
    },

    /**
     * Route protection — runs in middleware (Edge).
     * Edge constraint: no DB access, so we only check auth presence here.
     * Role-dependent gates (e.g. mentor-only `/mentora/dashboard/availability`)
     * are enforced at page level via `getCurrentRoleProfile()`.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const isProtected =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/admin') ||
        pathname.startsWith('/app') ||
        pathname.startsWith('/mentora/dashboard') ||
        pathname.startsWith('/mentora/admin') ||
        pathname === '/mentora/onboarding' ||
        pathname === '/mentora/become-a-mentor' ||
        // Community surfaces — public read remains anonymous; these paths
        // require an authenticated session.
        pathname === '/community/onboarding' ||
        pathname === '/community/posts/new' ||
        pathname === '/community/bookmarks' ||
        pathname === '/community/settings' ||
        pathname === '/community/notifications' ||
        /^\/community\/posts\/[^/]+\/edit$/.test(pathname) ||
        /^\/community\/challenges\/[^/]+\/submit$/.test(pathname) ||
        pathname.startsWith('/community/admin');

      if (isProtected) return isLoggedIn;
      return true;
    },
  },
} satisfies NextAuthConfig;
