'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { routing, type Locale } from '@/i18n/routing';

/**
 * Persist the user's locale choice. Setter for the `NEXT_LOCALE`
 * cookie that `src/i18n/request.ts` reads on every render.
 *
 * Why a server action and not a `Set-Cookie` from a route handler?
 * Calling this from the client lets us call `revalidatePath('/')`
 * in the same round-trip, so the next render uses the new locale
 * without a hard reload.
 *
 * Cookie scope:
 *  - 1-year lifetime (`maxAge: 365 * 24 * 3600`)
 *  - `sameSite: 'lax'` so a top-level navigation (Google → site)
 *    still sees the cookie
 *  - `secure: true` in production. Skipped in dev so localhost works
 *    without HTTPS
 *  - `httpOnly: false` — the cookie is read by `next-intl/server` on
 *    the server side AND can be read client-side if we ever add a
 *    client-rendered locale display. No sensitive data lives here.
 */
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!(routing.locales as readonly string[]).includes(locale)) {
    return { ok: false };
  }
  const cookieStore = await cookies();
  cookieStore.set('NEXT_LOCALE', locale as Locale, {
    maxAge: 365 * 24 * 3600,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
    path: '/',
  });
  // The cookie change only takes effect on the NEXT request — force
  // a re-render so the user sees the switch immediately.
  revalidatePath('/');
  return { ok: true };
}
