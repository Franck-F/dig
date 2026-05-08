import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

// Re-export under the name Next.js expects so the static analyzer
// recognises this file as middleware in Next 16.
export default auth;

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|images|.*\\.(?:png|jpg|jpeg|svg|webp|ico)|robots.txt|sitemap.xml|manifest.webmanifest|favicon.ico).*)',
  ],
};
