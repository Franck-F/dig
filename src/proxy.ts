import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

// Renamed from `src/middleware.ts` to `src/proxy.ts` per the Next.js
// 16 deprecation: https://nextjs.org/docs/messages/middleware-to-proxy.
// Behaviour is identical — Next.js recognises the default export under
// either filename today, but `middleware.ts` emits a deprecation
// warning on every build. Renaming silences it and aligns with the
// future-stable convention.
export default auth;

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|images|.*\\.(?:png|jpg|jpeg|svg|webp|ico)|robots.txt|sitemap.xml|manifest.webmanifest|favicon.ico).*)',
  ],
};
