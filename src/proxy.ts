import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';

import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

// Renamed from `src/middleware.ts` to `src/proxy.ts` per the Next.js
// 16 deprecation: https://nextjs.org/docs/messages/middleware-to-proxy.
// Behaviour is identical — Next.js recognises the default export under
// either filename today, but `middleware.ts` emits a deprecation
// warning on every build. Renaming silences it and aligns with the
// future-stable convention.
//
// We wrap the auth middleware so we can inject a `x-pathname` header
// into the request. Server components / layouts can then read it via
// `headers()` to know which route is being rendered — Next.js does
// not expose the request pathname server-side by default. This is the
// canonical workaround documented across the App Router community.
//
// The `authorized` callback in authConfig still runs first; this
// callback only fires for requests that passed the auth gate (or
// don't need it). Unauthorized requests are auto-redirected by
// Auth.js to the `signIn` page, so they never reach this wrapper.
export default auth((req) => {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|images|.*\\.(?:png|jpg|jpeg|svg|webp|ico)|robots.txt|sitemap.xml|manifest.webmanifest|favicon.ico).*)',
  ],
};
